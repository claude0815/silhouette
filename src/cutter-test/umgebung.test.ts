import { describe, expect, it } from 'vitest';
import { pruefeUmgebung } from './umgebung';

describe('pruefeUmgebung', () => {
  it('erkennt fehlende Schnittstellen', () => {
    expect(pruefeUmgebung({ isSecureContext: false, navigator: {} })).toEqual({
      sichererKontext: false,
      webUsb: false,
      webBluetooth: false,
    });
  });

  it('erkennt vorhandene Schnittstellen', () => {
    const navigator = { usb: {} as USB, bluetooth: {} as Bluetooth };
    expect(pruefeUmgebung({ isSecureContext: true, navigator })).toEqual({
      sichererKontext: true,
      webUsb: true,
      webBluetooth: true,
    });
  });
});
