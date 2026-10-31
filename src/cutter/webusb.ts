/**
 * Übertragung per USB-Kabel mit WebUSB (nur Chrome und Edge).
 *
 * Endpunkte laut inkscape-silhouette, silhouette/Transport.py (Commit f376a08):
 * Bulk OUT 0x01, Bulk IN 0x82, Interface 0. Hier werden die Endpunkte aber nicht
 * fest angenommen, sondern aus der Gerätebeschreibung gesucht und protokolliert –
 * das ist für den Machbarkeitstest aufschlussreicher.
 */
import { VENDOR_ID_CAMEO5_ALPHA, VENDOR_ID_GRAPHTEC } from './profile';
import { Empfangspuffer, type Transport } from './transport';
import type { ProtokollEintrag } from './types';

/** Filter für die Geräteauswahl des Browsers: nur Graphtec/Silhouette. */
export const USB_FILTER: USBDeviceFilter[] = [
  { vendorId: VENDOR_ID_GRAPHTEC },
  { vendorId: VENDOR_ID_CAMEO5_ALPHA },
];

/** Die Teile von USBDevice, die hier gebraucht werden. So lässt sich das Gerät in Tests nachbilden. */
export type UsbGeraet = Pick<
  USBDevice,
  | 'vendorId'
  | 'productId'
  | 'productName'
  | 'manufacturerName'
  | 'serialNumber'
  | 'opened'
  | 'configuration'
  | 'open'
  | 'close'
  | 'selectConfiguration'
  | 'claimInterface'
  | 'releaseInterface'
  | 'transferIn'
  | 'transferOut'
>;

export interface UsbEndpunkte {
  interfaceNummer: number;
  rein: number;
  raus: number;
  paketgroesse: number;
}

/** Sucht ein Interface mit je einem Bulk-Endpunkt für Senden und Empfangen. */
export function findeEndpunkte(konfiguration: USBConfiguration): UsbEndpunkte | null {
  for (const iface of konfiguration.interfaces) {
    const alt = iface.alternate;
    const rein = alt.endpoints.find((e) => e.type === 'bulk' && e.direction === 'in');
    const raus = alt.endpoints.find((e) => e.type === 'bulk' && e.direction === 'out');
    if (rein && raus) {
      return {
        interfaceNummer: iface.interfaceNumber,
        rein: rein.endpointNumber,
        raus: raus.endpointNumber,
        paketgroesse: rein.packetSize || 64,
      };
    }
  }
  return null;
}

/** Fehler mit einer Erklärung für Schülerinnen, Schüler und Lehrkräfte. */
export class VerbindungsFehler extends Error {
  override name = 'VerbindungsFehler';
  constructor(
    message: string,
    /** Was man tun kann. */
    readonly tipp?: string,
    /** Die ursprüngliche Meldung des Browsers. */
    readonly technisch?: string,
  ) {
    super(message);
  }
}

const hex = (n: number) => '0x' + n.toString(16).padStart(4, '0');

/**
 * Übersetzt Fehler von WebUSB in verständliche Meldungen.
 * `schritt` sagt, wobei der Fehler auftrat.
 */
export function erklaereUsbFehler(fehler: unknown, schritt: 'auswahl' | 'oeffnen' | 'belegen' | 'uebertragen'): VerbindungsFehler {
  const name = fehler instanceof Error ? fehler.name : '';
  const technisch = fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler);
  if (schritt === 'auswahl' && name === 'NotFoundError') {
    return new VerbindungsFehler(
      'Es wurde kein Gerät ausgewählt.',
      'Ist der Cutter eingeschaltet und per USB-Kabel verbunden? Erscheint er nicht in der Liste, ' +
        'belegt unter Windows meist der Druckertreiber das Gerät.',
      technisch,
    );
  }
  if (name === 'SecurityError') {
    return new VerbindungsFehler(
      'Der Browser verweigert den Zugriff auf das Gerät.',
      'Die Seite muss über HTTPS oder localhost laufen. Manche Geräteklassen sperrt Chrome für WebUSB grundsätzlich.',
      technisch,
    );
  }
  if (schritt === 'oeffnen' || schritt === 'belegen') {
    return new VerbindungsFehler(
      'Das Gerät ist belegt und lässt sich nicht öffnen.',
      'Silhouette Studio schließen (auch im Hintergrund) und den Cutter kurz aus- und wieder einschalten. ' +
        'Unter Windows belegt der Druckertreiber das Gerät; WebUSB geht dort nur nach einem Treibertausch ' +
        'auf WinUSB (z. B. mit Zadig, Adminrechte nötig). Alternativen: Bluetooth oder DXF-Export.',
      technisch,
    );
  }
  return new VerbindungsFehler('Die Übertragung per USB ist fehlgeschlagen.', 'Kabel prüfen und neu verbinden.', technisch);
}

export interface WebUsbOptionen {
  onProtokoll?: (eintrag: ProtokollEintrag) => void;
  /** Wird aufgerufen, wenn die Verbindung unerwartet abbricht. */
  onGetrennt?: (grund: string) => void;
}

export class WebUsbTransport implements Transport {
  readonly art = 'USB';
  private readonly puffer = new Empfangspuffer();
  private offen = false;
  private endpunkte: UsbEndpunkte | null = null;

  constructor(
    readonly geraet: UsbGeraet,
    private readonly optionen: WebUsbOptionen = {},
  ) {}

  get geraetename(): string {
    return this.geraet.productName || `USB-Gerät ${hex(this.geraet.vendorId)}:${hex(this.geraet.productId)}`;
  }

  /** Lässt die Nutzerin bzw. den Nutzer im Browser ein Gerät auswählen. */
  static async waehle(usb: USB, optionen: WebUsbOptionen = {}): Promise<WebUsbTransport> {
    let geraet: USBDevice;
    try {
      geraet = await usb.requestDevice({ filters: USB_FILTER });
    } catch (e) {
      throw erklaereUsbFehler(e, 'auswahl');
    }
    const transport = new WebUsbTransport(geraet, optionen);
    await transport.oeffne();
    return transport;
  }

  /** Öffnet das Gerät, belegt das Interface und startet das Lesen im Hintergrund. */
  async oeffne(): Promise<void> {
    const g = this.geraet;
    this.info(
      `Gerät: ${g.manufacturerName ?? '?'} ${g.productName ?? '?'}, ` +
        `Hersteller ${hex(g.vendorId)}, Produkt ${hex(g.productId)}, Seriennummer ${g.serialNumber ?? '–'}`,
    );
    try {
      if (!g.opened) await g.open();
      if (!g.configuration) await g.selectConfiguration(1);
    } catch (e) {
      throw erklaereUsbFehler(e, 'oeffnen');
    }
    const ep = g.configuration && findeEndpunkte(g.configuration);
    if (!ep) {
      await g.close().catch(() => undefined);
      throw new VerbindungsFehler(
        'Das Gerät hat keine passenden Bulk-Endpunkte.',
        'Ist es wirklich ein Silhouette-Cutter? Bitte das Protokoll für die Auswertung kopieren.',
      );
    }
    this.info(
      `Interface ${ep.interfaceNummer}, Endpunkt OUT ${ep.raus}, IN ${ep.rein}, Paketgröße ${ep.paketgroesse} Byte`,
    );
    try {
      await g.claimInterface(ep.interfaceNummer);
    } catch (e) {
      await g.close().catch(() => undefined);
      throw erklaereUsbFehler(e, 'belegen');
    }
    this.endpunkte = ep;
    this.offen = true;
    void this.leseschleife();
  }

  async schreibe(bytes: Uint8Array): Promise<void> {
    if (!this.offen || !this.endpunkte) throw new VerbindungsFehler('Die USB-Verbindung ist nicht offen.');
    let ergebnis: USBOutTransferResult;
    try {
      ergebnis = await this.geraet.transferOut(this.endpunkte.raus, bytes as Uint8Array<ArrayBuffer>);
    } catch (e) {
      throw erklaereUsbFehler(e, 'uebertragen');
    }
    if (ergebnis.status !== 'ok' || ergebnis.bytesWritten !== bytes.length) {
      throw new VerbindungsFehler(
        `USB-Übertragung unvollständig: ${ergebnis.bytesWritten} von ${bytes.length} Byte (Status „${ergebnis.status}“).`,
      );
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
    this.puffer.schliessen();
    try {
      if (this.endpunkte) await this.geraet.releaseInterface(this.endpunkte.interfaceNummer);
      await this.geraet.close();
    } catch {
      // Beim Schließen sind Fehler egal, z. B. wenn das Kabel schon gezogen ist.
    }
  }

  /**
   * Liest ständig im Hintergrund und legt alles im Empfangspuffer ab.
   * Eine einzelne, hängende Leseanfrage pro Antwort würde sonst die nächste Antwort verschlucken.
   */
  private async leseschleife(): Promise<void> {
    const ep = this.endpunkte!;
    while (this.offen) {
      try {
        const r = await this.geraet.transferIn(ep.rein, ep.paketgroesse);
        if (r.data && r.data.byteLength > 0) {
          this.puffer.hinzufuegen(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
        }
      } catch (e) {
        if (!this.offen) return; // regulär geschlossen
        this.offen = false;
        this.puffer.schliessen();
        const grund = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        this.optionen.onProtokoll?.({ zeit: Date.now(), richtung: 'fehler', text: `USB-Lesen beendet: ${grund}` });
        this.optionen.onGetrennt?.(grund);
        return;
      }
    }
  }

  private info(text: string): void {
    this.optionen.onProtokoll?.({ zeit: Date.now(), richtung: 'info', text });
  }
}
