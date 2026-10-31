import { describe, expect, it } from 'vitest';
import { GpglCutter } from './gpgl-cutter';
import { erklaereUsbFehler, findeEndpunkte, WebUsbTransport, type UsbGeraet } from './webusb';

/** Nachgebildete USB-Konfiguration wie beim Silhouette: Interface 0, OUT 1, IN 2. */
function konfiguration(): USBConfiguration {
  const endpunkt = (endpointNumber: number, direction: USBDirection) =>
    ({ endpointNumber, direction, type: 'bulk', packetSize: 64 }) as USBEndpoint;
  const alternate = { endpoints: [endpunkt(1, 'out'), endpunkt(2, 'in')] } as unknown as USBAlternateInterface;
  return { configurationValue: 1, interfaces: [{ interfaceNumber: 0, alternate, alternates: [alternate] }] } as unknown as USBConfiguration;
}

/** Ein Gerät, das auf ESC ENQ mit "0" und auf FG mit "CAMEO 4 V1.10" antwortet. */
class FalschesGeraet implements UsbGeraet {
  vendorId = 0x0b4d;
  productId = 0x1137;
  productName = 'CAMEO 4';
  manufacturerName = 'Silhouette';
  serialNumber = '123';
  opened = false;
  configuration: USBConfiguration | null = null;
  gesendet: string[] = [];
  belegt = false;
  oeffnenScheitert = false;
  private antworten: Uint8Array[] = [];
  private wartend: ((r: USBInTransferResult) => void) | null = null;
  private abbruch: ((e: Error) => void) | null = null;

  async open() {
    if (this.oeffnenScheitert) throw new DOMException('Access denied.', 'SecurityError');
    this.opened = true;
  }
  async close() {
    this.opened = false;
    this.abbruch?.(new DOMException('The device was disconnected.', 'NotFoundError'));
  }
  async selectConfiguration() {
    this.configuration = konfiguration();
  }
  async claimInterface() {
    if (this.belegt) throw new DOMException('Unable to claim interface.', 'NetworkError');
  }
  async releaseInterface() {}
  async transferOut(_ep: number, daten: BufferSource): Promise<USBOutTransferResult> {
    const text = new TextDecoder().decode(daten as Uint8Array);
    this.gesendet.push(text);
    if (text === '\x1b\x05') this.antworte('0\x03');
    if (text === 'FG\x03') this.antworte('CAMEO 4 V1.10    \x03');
    return { status: 'ok', bytesWritten: (daten as Uint8Array).byteLength };
  }
  transferIn(): Promise<USBInTransferResult> {
    const naechste = this.antworten.shift();
    if (naechste) return Promise.resolve(this.ergebnis(naechste));
    return new Promise((resolve, reject) => {
      this.wartend = resolve;
      this.abbruch = reject;
    });
  }
  private antworte(text: string) {
    const bytes = new TextEncoder().encode(text);
    if (this.wartend) {
      const w = this.wartend;
      this.wartend = null;
      // Wie echte Hardware: in zwei Paketen
      w(this.ergebnis(bytes.subarray(0, 2)));
      this.antworten.push(bytes.subarray(2));
    } else this.antworten.push(bytes);
  }
  private ergebnis(bytes: Uint8Array): USBInTransferResult {
    return { status: 'ok', data: new DataView(bytes.slice().buffer) };
  }
}

describe('findeEndpunkte', () => {
  it('findet Interface 0 mit OUT 1 und IN 2', () => {
    expect(findeEndpunkte(konfiguration())).toEqual({ interfaceNummer: 0, raus: 1, rein: 2, paketgroesse: 64 });
  });
});

describe('WebUsbTransport', () => {
  it('verbindet, erkennt das Modell und fragt den Status ab', async () => {
    const geraet = new FalschesGeraet();
    const transport = new WebUsbTransport(geraet);
    await transport.oeffne();
    const cutter = new GpglCutter(transport);
    await cutter.connect();
    expect(cutter.profil?.id).toBe('cameo4');
    expect(cutter.name).toBe('Cameo 4 (USB)');
    expect((await cutter.status()).status).toBe('bereit');
    expect(geraet.gesendet).toEqual(['\x1b\x04', 'FG\x03', '\x1b\x05']);
    await cutter.disconnect();
    expect(geraet.opened).toBe(false);
  });

  it('erklärt ein belegtes Gerät verständlich', async () => {
    const geraet = new FalschesGeraet();
    geraet.belegt = true;
    await expect(new WebUsbTransport(geraet).oeffne()).rejects.toThrow(/belegt/);
    expect(geraet.opened).toBe(false);
  });

  it('erklärt einen gesperrten Zugriff', async () => {
    const geraet = new FalschesGeraet();
    geraet.oeffnenScheitert = true;
    await expect(new WebUsbTransport(geraet).oeffne()).rejects.toThrow(/verweigert/);
  });
});

describe('erklaereUsbFehler', () => {
  it('nennt bei abgebrochener Auswahl den Windows-Treiber als mögliche Ursache', () => {
    const f = erklaereUsbFehler(new DOMException('No device selected.', 'NotFoundError'), 'auswahl');
    expect(f.message).toBe('Es wurde kein Gerät ausgewählt.');
    expect(f.tipp).toMatch(/Windows/);
    expect(f.technisch).toBe('NotFoundError: No device selected.');
  });
});
