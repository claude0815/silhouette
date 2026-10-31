/**
 * Übertragung per Bluetooth Low Energy mit Web Bluetooth (nur Chrome und Edge).
 *
 * UUIDs, Ablauf beim Verbinden und Stückelung in 20 Byte stammen aus
 * inkscape-silhouette, silhouette/BLETransport.py (Commit f376a08),
 * (c) 2026 inkscape-silhouette contributors, „Distribute under GPLv2 or ask“;
 * dort abgeglichen mit bob-takuya/cameo-cut (MIT).
 *
 * Achtung: Web Bluetooth kann nur BLE, kein klassisches Bluetooth (RFCOMM).
 */
import { BEFEHL_INITIALISIEREN, bytesAlsText } from './gpgl';
import { Empfangspuffer, type Transport } from './transport';
import type { ProtokollEintrag } from './types';
import { VerbindungsFehler } from './webusb';

export const BLE_DIENST = 'e2088282-4fde-42f9-bb22-6ec3c7ed8f91';
/** Hierhin werden Befehle geschrieben. */
export const BLE_SCHREIBEN = '6d92661d-f429-4d67-929b-28e7a9780912';
/** Hierüber kommen Antworten auf Abfragen. */
export const BLE_LESEN = '8dcf199a-30e7-4bd4-beb6-beb57dca866c';
/** Hierüber meldet das Gerät Zustandswechsel wie "1" (in Bewegung) und "0" (bereit). */
export const BLE_STEUERUNG = '61490654-b5b4-458c-a867-9e15bc1471e0';

/** Größte Nutzlast pro Schreibvorgang. */
export const BLE_STUECK = 20;

export interface BluetoothOptionen {
  onProtokoll?: (eintrag: ProtokollEintrag) => void;
  onGetrennt?: (grund: string) => void;
  /** Wartezeit nach dem Initialisieren in ms (Graphtec: 1 s). */
  einschwingzeitMs?: number;
  /** Pause vor einem neuen Versuch, wenn der Puffer des Geräts voll ist, in ms. */
  wiederholPauseMs?: number;
}

/**
 * Optionen für die Geräteauswahl.
 * `alleZeigen`: alle Bluetooth-Geräte in der Nähe anbieten. Für den Machbarkeitstest wichtig,
 * falls ein Cutter den Dienst nicht in der Werbung nennt oder anders heißt als erwartet.
 */
export function bluetoothAuswahl(alleZeigen: boolean): RequestDeviceOptions {
  if (alleZeigen) return { acceptAllDevices: true, optionalServices: [BLE_DIENST] };
  return {
    filters: [{ services: [BLE_DIENST] }, { namePrefix: 'CAMEO' }, { namePrefix: 'PORTRAIT' }, { namePrefix: 'Silhouette' }],
    optionalServices: [BLE_DIENST],
  };
}

export function erklaereBluetoothFehler(fehler: unknown, schritt: 'auswahl' | 'verbinden' | 'dienst' | 'uebertragen'): VerbindungsFehler {
  const name = fehler instanceof Error ? fehler.name : '';
  const technisch = fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler);
  if (schritt === 'auswahl' && name === 'NotFoundError') {
    return new VerbindungsFehler(
      'Es wurde kein Gerät ausgewählt.',
      'Ist Bluetooth am Cutter eingeschaltet und das Gerät nicht gerade mit Silhouette Studio oder einem ' +
        'Tablet verbunden? Wird es nicht gefunden, „Alle Bluetooth-Geräte anzeigen“ versuchen.',
      technisch,
    );
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new VerbindungsFehler(
      'Der Zugriff auf Bluetooth wurde nicht erlaubt.',
      'Unter macOS: Systemeinstellungen → Datenschutz & Sicherheit → Bluetooth, dort Chrome bzw. Edge erlauben. ' +
        'Die Seite muss über HTTPS oder localhost laufen.',
      technisch,
    );
  }
  if (schritt === 'dienst') {
    return new VerbindungsFehler(
      'Das Gerät bietet den erwarteten Silhouette-Dienst nicht an.',
      'Möglicherweise spricht dieses Modell nur klassisches Bluetooth, das Web Bluetooth nicht unterstützt. ' +
        'Das ist ein wichtiges Ergebnis für den Machbarkeitstest – bitte Modell und Protokoll notieren.',
      technisch,
    );
  }
  if (schritt === 'verbinden') {
    return new VerbindungsFehler(
      'Die Bluetooth-Verbindung kam nicht zustande.',
      'Cutter näher an den Rechner stellen, Silhouette Studio schließen und es noch einmal versuchen.',
      technisch,
    );
  }
  return new VerbindungsFehler('Die Übertragung per Bluetooth ist fehlgeschlagen.', 'Neu verbinden.', technisch);
}

/** Die Teile von BluetoothDevice, die hier gebraucht werden (für Tests nachbildbar). */
export interface BleGeraet {
  readonly id: string;
  readonly name?: string | undefined;
  readonly gatt?: BleGatt | undefined;
  addEventListener(typ: 'gattserverdisconnected', f: () => void): void;
  removeEventListener(typ: 'gattserverdisconnected', f: () => void): void;
}
export interface BleGatt {
  readonly connected: boolean;
  connect(): Promise<BleGatt>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleDienst>;
}
export interface BleDienst {
  getCharacteristic(uuid: string): Promise<BleMerkmal>;
}
export interface BleMerkmal {
  readonly value?: DataView | undefined;
  startNotifications(): Promise<unknown>;
  writeValueWithResponse(daten: BufferSource): Promise<void>;
  addEventListener(typ: 'characteristicvaluechanged', f: (e: Event) => void): void;
}

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class BluetoothTransport implements Transport {
  readonly art = 'Bluetooth';
  private readonly puffer = new Empfangspuffer();
  private schreiben: BleMerkmal | null = null;
  private offen = false;
  private readonly beiTrennung = () => this.getrennt('Das Gerät hat die Bluetooth-Verbindung beendet.');

  constructor(
    readonly geraet: BleGeraet,
    private readonly optionen: BluetoothOptionen = {},
  ) {}

  get geraetename(): string {
    return this.geraet.name || 'Bluetooth-Gerät ohne Namen';
  }

  static async waehle(bluetooth: Bluetooth, alleZeigen: boolean, optionen: BluetoothOptionen = {}): Promise<BluetoothTransport> {
    let geraet: BluetoothDevice;
    try {
      geraet = await bluetooth.requestDevice(bluetoothAuswahl(alleZeigen));
    } catch (e) {
      throw erklaereBluetoothFehler(e, 'auswahl');
    }
    const transport = new BluetoothTransport(geraet as unknown as BleGeraet, optionen);
    await transport.oeffne();
    return transport;
  }

  /** Verbindet, abonniert die Benachrichtigungen und führt den Handschlag aus (wie BLETransport.py). */
  async oeffne(): Promise<void> {
    const g = this.geraet;
    this.info(`Gerät: „${g.name ?? '(ohne Namen)'}“, ID ${g.id}`);
    if (!g.gatt) throw new VerbindungsFehler('Das Gerät unterstützt kein GATT.');

    let gatt: BleGatt;
    try {
      gatt = await g.gatt.connect();
    } catch (e) {
      throw erklaereBluetoothFehler(e, 'verbinden');
    }
    g.addEventListener('gattserverdisconnected', this.beiTrennung);

    let steuerung: BleMerkmal, lesen: BleMerkmal, schreiben: BleMerkmal;
    try {
      const dienst = await gatt.getPrimaryService(BLE_DIENST);
      [steuerung, lesen, schreiben] = await Promise.all([
        dienst.getCharacteristic(BLE_STEUERUNG),
        dienst.getCharacteristic(BLE_LESEN),
        dienst.getCharacteristic(BLE_SCHREIBEN),
      ]);
    } catch (e) {
      g.removeEventListener('gattserverdisconnected', this.beiTrennung);
      gatt.disconnect();
      throw erklaereBluetoothFehler(e, 'dienst');
    }
    this.info('Silhouette-Dienst und alle drei Merkmale gefunden.');

    try {
      // 1. Benachrichtigungen einschalten. Statusmeldungen der Steuerung nur protokollieren,
      //    nicht in die Antworten mischen.
      steuerung.addEventListener('characteristicvaluechanged', (e) => {
        const wert = (e.target as unknown as BleMerkmal).value;
        if (wert) this.info(`Steuerung meldet: ${bytesAlsText(alsBytes(wert))}`);
      });
      lesen.addEventListener('characteristicvaluechanged', (e) => {
        const wert = (e.target as unknown as BleMerkmal).value;
        if (wert) this.puffer.hinzufuegen(alsBytes(wert));
      });
      await steuerung.startNotifications();
      await lesen.startNotifications();

      // 2. Handschlag: ESC EOT an alle drei Merkmale, dann kurz warten und Eingang leeren.
      for (const m of [steuerung, lesen, schreiben]) {
        await m.writeValueWithResponse(BEFEHL_INITIALISIEREN as Uint8Array<ArrayBuffer>);
      }
      await warte(this.optionen.einschwingzeitMs ?? 1000);
      this.puffer.leeren();
    } catch (e) {
      g.removeEventListener('gattserverdisconnected', this.beiTrennung);
      gatt.disconnect();
      throw erklaereBluetoothFehler(e, 'verbinden');
    }

    this.schreiben = schreiben;
    this.offen = true;
    this.info('Bluetooth-Handschlag abgeschlossen.');
  }

  /** Schreibt in Stücken zu 20 Byte, jeweils mit Bestätigung. Bei vollem Puffer bis zu dreimal neu. */
  async schreibe(bytes: Uint8Array): Promise<void> {
    if (!this.offen || !this.schreiben) throw new VerbindungsFehler('Die Bluetooth-Verbindung ist nicht offen.');
    const pause = this.optionen.wiederholPauseMs ?? 100;
    for (let i = 0; i < bytes.length; i += BLE_STUECK) {
      const stueck = bytes.slice(i, i + BLE_STUECK);
      for (let versuch = 0; ; versuch++) {
        try {
          await this.schreiben.writeValueWithResponse(stueck);
          break;
        } catch (e) {
          if (versuch >= 3 || !this.offen) throw erklaereBluetoothFehler(e, 'uebertragen');
          await warte(pause * 2 ** versuch);
        }
      }
    }
  }

  lese(timeoutMs: number): Promise<Uint8Array | null> {
    return this.puffer.lese(timeoutMs);
  }

  leereEingang(): void {
    this.puffer.leeren();
  }

  async schliesse(): Promise<void> {
    if (!this.offen) return;
    this.offen = false;
    this.geraet.removeEventListener('gattserverdisconnected', this.beiTrennung);
    this.puffer.schliessen();
    this.geraet.gatt?.disconnect();
  }

  private getrennt(grund: string): void {
    if (!this.offen) return;
    this.offen = false;
    this.puffer.schliessen();
    this.optionen.onProtokoll?.({ zeit: Date.now(), richtung: 'fehler', text: grund });
    this.optionen.onGetrennt?.(grund);
  }

  private info(text: string): void {
    this.optionen.onProtokoll?.({ zeit: Date.now(), richtung: 'info', text });
  }
}

function alsBytes(wert: DataView): Uint8Array {
  return new Uint8Array(wert.buffer.slice(wert.byteOffset, wert.byteOffset + wert.byteLength));
}
