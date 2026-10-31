import { describe, expect, it } from 'vitest';
import {
  BLE_DIENST,
  BLE_LESEN,
  BLE_SCHREIBEN,
  BLE_STEUERUNG,
  BluetoothTransport,
  bluetoothAuswahl,
  type BleDienst,
  type BleGatt,
  type BleGeraet,
  type BleMerkmal,
} from './bluetooth';
import { GpglCutter } from './gpgl-cutter';

class FalschesMerkmal implements BleMerkmal {
  value: DataView | undefined;
  geschrieben: Uint8Array[] = [];
  benachrichtigt = false;
  scheitertNochMal = 0;
  private hoerer: Array<(e: Event) => void> = [];
  constructor(private readonly beimSchreiben?: (b: Uint8Array) => void) {}
  async startNotifications() {
    this.benachrichtigt = true;
  }
  async writeValueWithResponse(daten: BufferSource) {
    if (this.scheitertNochMal > 0) {
      this.scheitertNochMal--;
      throw new DOMException('GATT operation failed.', 'NetworkError');
    }
    const b = new Uint8Array(daten as Uint8Array);
    this.geschrieben.push(b);
    this.beimSchreiben?.(b);
  }
  addEventListener(_typ: 'characteristicvaluechanged', f: (e: Event) => void) {
    this.hoerer.push(f);
  }
  melde(text: string) {
    this.value = new DataView(new TextEncoder().encode(text).buffer);
    for (const f of this.hoerer) f({ target: this } as unknown as Event);
  }
}

/** Ein BLE-Cutter: antwortet über LESEN, sobald über SCHREIBEN eine Abfrage vollständig ist. */
function falschesGeraet(mitDienst = true) {
  const lesen = new FalschesMerkmal();
  const steuerung = new FalschesMerkmal();
  let eingang = '';
  const schreiben = new FalschesMerkmal((b) => {
    eingang += new TextDecoder().decode(b);
    if (eingang.endsWith('\x1b\x05')) lesen.melde('0\x03');
    if (eingang.endsWith('FG\x03')) lesen.melde('CAMEO 5 V1.02\x03');
  });
  const merkmale: Record<string, FalschesMerkmal> = {
    [BLE_LESEN]: lesen,
    [BLE_STEUERUNG]: steuerung,
    [BLE_SCHREIBEN]: schreiben,
  };
  const dienst: BleDienst = { getCharacteristic: async (uuid) => merkmale[uuid]! };
  const gatt: BleGatt = {
    connected: true,
    connect: async () => gatt,
    disconnect: () => undefined,
    getPrimaryService: async (uuid) => {
      if (!mitDienst || uuid !== BLE_DIENST) throw new DOMException('No Services matching UUID found.', 'NotFoundError');
      return dienst;
    },
  };
  const geraet: BleGeraet = {
    id: 'abc',
    name: 'CAMEO 5-123456',
    gatt,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  return { geraet, lesen, steuerung, schreiben };
}

describe('BluetoothTransport', () => {
  it('führt den Handschlag aus: Benachrichtigungen, dann ESC EOT an alle drei Merkmale', async () => {
    const f = falschesGeraet();
    const transport = new BluetoothTransport(f.geraet, { einschwingzeitMs: 0 });
    await transport.oeffne();
    expect(f.lesen.benachrichtigt && f.steuerung.benachrichtigt).toBe(true);
    for (const m of [f.lesen, f.steuerung, f.schreiben]) {
      expect(Array.from(m.geschrieben[0]!)).toEqual([0x1b, 0x04]);
    }
  });

  it('erkennt das Modell und fragt den Status ab', async () => {
    const f = falschesGeraet();
    const transport = new BluetoothTransport(f.geraet, { einschwingzeitMs: 0 });
    await transport.oeffne();
    const cutter = new GpglCutter(transport);
    await cutter.connect();
    expect(cutter.profil?.id).toBe('cameo5');
    expect((await cutter.status()).status).toBe('bereit');
  });

  it('schreibt in Stücken von höchstens 20 Byte', async () => {
    const f = falschesGeraet();
    const transport = new BluetoothTransport(f.geraet, { einschwingzeitMs: 0 });
    await transport.oeffne();
    f.schreiben.geschrieben = [];
    await transport.schreibe(new Uint8Array(45).fill(65));
    expect(f.schreiben.geschrieben.map((b) => b.length)).toEqual([20, 20, 5]);
  });

  it('wiederholt bei vollem Puffer', async () => {
    const f = falschesGeraet();
    const transport = new BluetoothTransport(f.geraet, { einschwingzeitMs: 0, wiederholPauseMs: 1 });
    await transport.oeffne();
    f.schreiben.geschrieben = [];
    f.schreiben.scheitertNochMal = 2;
    await transport.schreibe(new Uint8Array(5));
    expect(f.schreiben.geschrieben).toHaveLength(1);
  });

  it('erklärt einen fehlenden Dienst als möglichen Hinweis auf klassisches Bluetooth', async () => {
    const f = falschesGeraet(false);
    await expect(new BluetoothTransport(f.geraet, { einschwingzeitMs: 0 }).oeffne()).rejects.toThrow(
      /erwarteten Silhouette-Dienst/,
    );
  });
});

describe('bluetoothAuswahl', () => {
  it('filtert nach Dienst und Namen, erlaubt aber auch alle Geräte', () => {
    expect(bluetoothAuswahl(false)).toMatchObject({ optionalServices: [BLE_DIENST] });
    expect(bluetoothAuswahl(true)).toEqual({ acceptAllDevices: true, optionalServices: [BLE_DIENST] });
  });
});
