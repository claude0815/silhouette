import { describe, expect, it } from 'vitest';
import { VENDOR_ID_GRAPHTEC, profilFuerName, profilFuerUsb, schneidebereichMm, profile } from './profile';

describe('Geräteprofile', () => {
  it('findet die Modelle der Schule per USB-Produkt-ID', () => {
    expect(profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x1137)?.name).toBe('Cameo 4');
    expect(profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x1141)?.name).toBe('Cameo 5 Plus');
    expect(profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x113a)?.name).toBe('Portrait 3');
    expect(profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x9999)).toBeUndefined();
  });

  it('erkennt Bluetooth-Namen und Firmware-Antworten, spezielle Namen zuerst', () => {
    expect(profilFuerName('CAMEO 4 V1.10    ')?.id).toBe('cameo4');
    expect(profilFuerName('CAMEO 4 PLUS-123456')?.id).toBe('cameo4plus');
    expect(profilFuerName('cameo 5 plus')?.id).toBe('cameo5plus');
    expect(profilFuerName('CAMEO 5 ALPHA-000000')?.id).toBe('cameo5alpha');
    expect(profilFuerName('PORTRAIT3 V1.04')?.id).toBe('portrait3');
    expect(profilFuerName('Silhouette V1.10')).toBeUndefined();
  });

  it('hat eindeutige IDs', () => {
    const ids = profile.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('berechnet den Schneidebereich aus Matte und Gerät', () => {
    const cameo4 = profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x1137)!;
    const portrait3 = profilFuerUsb(VENDOR_ID_GRAPHTEC, 0x113a)!;
    expect(schneidebereichMm(cameo4, 'cameo-12x12')).toEqual({ breite: 304.8, hoehe: 304.8 });
    expect(schneidebereichMm(portrait3, 'cameo-12x12').breite).toBe(203);
    expect(schneidebereichMm(cameo4, 'keine')).toEqual({ breite: 304.8, hoehe: 3000 });
  });
});
