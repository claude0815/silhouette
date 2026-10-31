/**
 * Ein Cutter, der GPGL über einen beliebigen Transport spricht.
 * WebUSB, Web Bluetooth und die Simulation unterscheiden sich nur im Transport.
 *
 * Ablauf und Wartezeiten folgen inkscape-silhouette, silhouette/Graphtec.py
 * (initialize, status, wait_for_ready, safe_write), Commit f376a08,
 * (c) 2013,2014 jw@suse.de, (c) 2016 juewei@fabmail.org, (c) 2016 Alexander Wenger,
 * (c) 2017 Johann Gail, „Distribute under GPLv2 or ask“.
 */
import {
  ABFRAGE_VERSION,
  BEFEHL_INITIALISIEREN,
  BEFEHL_STATUS,
  auftragZuBefehlen,
  befehleZuBytes,
  bytesAlsText,
  inBloeckeTeilen,
  werteStatusAus,
} from './gpgl';
import { profilFuerName, unbekanntesProfil, type GeraeteProfil } from './profile';
import type { Transport } from './transport';
import type { Cutter, CutJob, ProtokollEintrag, SendeOptionen, StatusAntwort } from './types';

export interface GpglCutterOptionen {
  /** Profil, falls schon bekannt (z. B. aus der USB-Produkt-ID). Sonst aus der FG-Antwort. */
  profil?: GeraeteProfil;
  /** Wird für jede gesendete und empfangene Nachricht aufgerufen. */
  onProtokoll?: (eintrag: ProtokollEintrag) => void;
  /** Blockgröße beim Senden in Byte. */
  blockgroesse?: number;
  /** Pause zwischen zwei Statusabfragen beim Warten, in ms. */
  abfrageIntervallMs?: number;
  /** So lange wird höchstens gewartet, bis das Gerät wieder bereit ist, in ms. */
  bereitTimeoutMs?: number;
}

/** Fehler im Betrieb, mit einer Meldung für die Oberfläche. */
export class CutterFehler extends Error {
  override name = 'CutterFehler';
}

export class AbbruchFehler extends CutterFehler {
  override name = 'AbbruchFehler';
  constructor() {
    super('Der Auftrag wurde abgebrochen.');
  }
}

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GpglCutter implements Cutter {
  private profilIntern: GeraeteProfil | undefined;
  private firmwareIntern: string | undefined;
  private abbrechen = false;
  private verbunden = false;
  private readonly blockgroesse: number;
  private readonly abfrageIntervallMs: number;
  private readonly bereitTimeoutMs: number;

  constructor(
    private readonly transport: Transport,
    private readonly optionen: GpglCutterOptionen = {},
  ) {
    this.profilIntern = optionen.profil;
    this.blockgroesse = optionen.blockgroesse ?? 1024;
    this.abfrageIntervallMs = optionen.abfrageIntervallMs ?? 50;
    this.bereitTimeoutMs = optionen.bereitTimeoutMs ?? 120_000;
  }

  get name(): string {
    const modell = this.profilIntern?.name ?? this.transport.geraetename ?? 'Cutter';
    return `${modell} (${this.transport.art})`;
  }

  get profil(): GeraeteProfil | undefined {
    return this.profilIntern;
  }

  /** Antwort auf FG, z. B. "CAMEO 4 V1.10". */
  get firmware(): string | undefined {
    return this.firmwareIntern;
  }

  /** Initialisiert das Gerät und fragt Modell und Firmware ab. */
  async connect(): Promise<void> {
    this.transport.leereEingang();
    await this.schreibe(BEFEHL_INITIALISIEREN, 'Initialisieren');
    const version = await this.frage(befehleZuBytes([ABFRAGE_VERSION]), 'Version abfragen', 10_000);
    this.firmwareIntern = version ?? undefined;
    if (!this.profilIntern) {
      this.profilIntern =
        (version && profilFuerName(version)) ||
        unbekanntesProfil(0, 0, version ? `Unbekanntes Gerät (${version})` : undefined);
    }
    this.verbunden = true;
    this.protokolliere('info', `Verbunden: ${this.name}${version ? `, Firmware „${version}“` : ''}`);
  }

  async status(): Promise<StatusAntwort> {
    this.transport.leereEingang();
    await this.schreibe(BEFEHL_STATUS, 'Status abfragen');
    const antwort = await this.transport.lese(5000);
    if (!antwort) {
      this.protokolliere('fehler', 'Keine Antwort auf die Statusabfrage.');
      return { status: 'unbekannt', roh: '' };
    }
    this.protokolliere('empfangen', bytesAlsText(antwort), antwort);
    return werteStatusAus(antwort);
  }

  async send(job: CutJob, optionen: SendeOptionen = {}): Promise<void> {
    if (!this.verbunden || !this.profilIntern) {
      throw new CutterFehler('Der Cutter ist nicht verbunden.');
    }
    this.abbrechen = false;

    // Befehle zuerst vollständig erzeugen: Fehler im Auftrag fallen auf, bevor sich etwas bewegt.
    const befehle = auftragZuBefehlen(job, this.profilIntern);
    const bloecke = inBloeckeTeilen(befehleZuBytes(befehle), this.blockgroesse);
    const gesamt = bloecke.reduce((s, b) => s + b.length, 0);

    const vorher = await this.status();
    if (vorher.status === 'keine-matte') {
      throw new CutterFehler('Es ist keine Matte bzw. kein Material eingelegt.');
    }
    if (vorher.status !== 'bereit') await this.warteBisBereit();

    let gesendet = 0;
    for (const block of bloecke) {
      if (this.abbrechen) throw new AbbruchFehler();
      await this.schreibe(block);
      gesendet += block.length;
      optionen.onFortschritt?.(gesendet, gesamt);
      await this.warteBisBereit();
    }
    this.protokolliere('info', `Auftrag übertragen: ${befehle.length} Befehle, ${gesamt} Byte.`);
  }

  async cancel(): Promise<void> {
    this.abbrechen = true;
    this.protokolliere('info', 'Abbruch angefordert: Es werden keine weiteren Blöcke gesendet.');
  }

  async disconnect(): Promise<void> {
    this.abbrechen = true;
    this.verbunden = false;
    await this.transport.schliesse();
    this.protokolliere('info', 'Verbindung getrennt.');
  }

  /** Fragt den Status ab, bis das Gerät „bereit“ meldet (wait_for_ready in Graphtec.py). */
  private async warteBisBereit(): Promise<void> {
    const ende = Date.now() + this.bereitTimeoutMs;
    for (;;) {
      const { status, roh } = await this.status();
      if (status === 'bereit') return;
      if (this.abbrechen) throw new AbbruchFehler();
      if (status === 'keine-matte') {
        throw new CutterFehler('Das Material wurde entfernt oder ist nicht mehr eingelegt.');
      }
      if (status === 'unbekannt' && roh === '') {
        throw new CutterFehler('Das Gerät antwortet nicht mehr.');
      }
      if (Date.now() > ende) {
        throw new CutterFehler('Das Gerät ist nicht rechtzeitig fertig geworden.');
      }
      await warte(this.abfrageIntervallMs);
    }
  }

  private async frage(bytes: Uint8Array, info: string, timeoutMs: number): Promise<string | null> {
    this.transport.leereEingang();
    await this.schreibe(bytes, info);
    const antwort = await this.transport.lese(timeoutMs);
    if (!antwort) {
      this.protokolliere('fehler', `Keine Antwort: ${info}`);
      return null;
    }
    this.protokolliere('empfangen', bytesAlsText(antwort), antwort);
    return new TextDecoder().decode(antwort.subarray(0, antwort.length - 1)).trim();
  }

  private async schreibe(bytes: Uint8Array, info?: string): Promise<void> {
    this.protokolliere('gesendet', (info ? `${info}: ` : '') + bytesAlsText(bytes), bytes);
    await this.transport.schreibe(bytes);
  }

  private protokolliere(richtung: ProtokollEintrag['richtung'], text: string, bytes?: Uint8Array) {
    this.optionen.onProtokoll?.({ zeit: Date.now(), richtung, text, bytes });
  }
}
