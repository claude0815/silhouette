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
  /**
   * Warteschlange: Jeder Zugriff wartet, bis der vorige fertig ist. Sonst könnte z. B. eine
   * regelmäßige Statusabfrage mitten in einen Auftrag geraten und dessen Antwort „stehlen“.
   */
  private kette: Promise<unknown> = Promise.resolve();
  private laufend = 0;
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

  get istVerbunden(): boolean {
    return this.verbunden;
  }

  /** Läuft gerade ein Zugriff (oder wartet einer)? Dann z. B. keine zusätzliche Statusabfrage starten. */
  get beschaeftigt(): boolean {
    return this.laufend > 0;
  }

  /** Führt f aus, sobald alle vorigen Zugriffe fertig sind. */
  private exklusiv<T>(f: () => Promise<T>): Promise<T> {
    this.laufend++;
    const ergebnis = this.kette.then(f, f);
    this.kette = ergebnis.catch(() => undefined).finally(() => this.laufend--);
    return ergebnis;
  }

  /** Initialisiert das Gerät und fragt Modell und Firmware ab. */
  connect(): Promise<void> {
    return this.exklusiv(() => this.verbindeIntern());
  }

  private async verbindeIntern(): Promise<void> {
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

  status(): Promise<StatusAntwort> {
    return this.exklusiv(() => this.statusIntern());
  }

  private async statusIntern(): Promise<StatusAntwort> {
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

  send(job: CutJob, optionen: SendeOptionen = {}): Promise<void> {
    if (!this.verbunden || !this.profilIntern) return Promise.reject(new CutterFehler('Der Cutter ist nicht verbunden.'));
    // Befehle zuerst vollständig erzeugen: Fehler im Auftrag fallen auf, bevor sich etwas bewegt.
    let befehle: string[];
    try {
      befehle = auftragZuBefehlen(job, this.profilIntern);
    } catch (e) {
      return Promise.reject(e);
    }
    return this.sendeBefehle(befehle, optionen);
  }

  /** Sendet eine fertige Befehlsfolge (z. B. eine Testfahrt), mit Statusprüfung vorher und Abbruchmöglichkeit. */
  sendeBefehle(befehle: readonly string[], optionen: SendeOptionen = {}): Promise<void> {
    if (!this.verbunden) return Promise.reject(new CutterFehler('Der Cutter ist nicht verbunden.'));
    this.abbrechen = false;
    return this.exklusiv(() => this.sendeIntern(befehle, optionen));
  }

  private async sendeIntern(befehle: readonly string[], optionen: SendeOptionen): Promise<void> {
    if (this.abbrechen) throw new AbbruchFehler();
    const bloecke = inBloeckeTeilen(befehleZuBytes(befehle), this.blockgroesse);
    const gesamt = bloecke.reduce((s, b) => s + b.length, 0);

    const vorher = await this.statusIntern();
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

  /**
   * Sendet ESC EOT (Initialisieren). Für den Machbarkeitstest: Wie reagiert das Gerät,
   * wenn das mitten in einem Auftrag kommt? Bricht auch das Senden weiterer Blöcke ab.
   */
  async zuruecksetzen(): Promise<void> {
    this.abbrechen = true;
    await this.schreibe(BEFEHL_INITIALISIEREN, 'Zurücksetzen');
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
      const { status, roh } = await this.statusIntern();
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
