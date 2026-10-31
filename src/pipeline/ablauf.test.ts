import { describe, expect, it } from 'vitest';
import type { Farbbild } from './bilder';
import { ersterGeaenderterSchritt, fuehreAus, STANDARD } from './ablauf';

/** 20 × 20 Pixel: weißer Grund, schwarzer Ring, ein Störpixel. */
function testbild(): Farbbild {
  const n = 20;
  const daten = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - 9.5, y - 9.5);
      const dunkel = (r > 4 && r < 8) || (x === 1 && y === 1);
      const i = 4 * (y * n + x);
      daten[i] = daten[i + 1] = daten[i + 2] = dunkel ? 10 : 245;
      daten[i + 3] = 255;
    }
  return { breite: n, hoehe: n, daten };
}

describe('Ablaufsteuerung', () => {
  it('findet den ersten geänderten Schritt', () => {
    expect(ersterGeaenderterSchritt(STANDARD, { ...STANDARD })).toBe(9);
    expect(ersterGeaenderterSchritt(STANDARD, { ...STANDARD, toleranz: 2 })).toBe(6);
    expect(ersterGeaenderterSchritt(STANDARD, { ...STANDARD, toleranz: 2, invertieren: true })).toBe(3);
  });

  it('rechnet alle Schritte und liefert ein SVG mit einem Ring', () => {
    const { ergebnis: r, ab } = fuehreAus(testbild(), STANDARD);
    expect(ab).toBe(1);
    expect(r.entfernteFlecken).toBe(1);
    expect(r.konturen.map((k) => k.aussen).sort()).toEqual([false, true]);
    expect(r.vereinfacht).toHaveLength(1);
    expect(r.vereinfacht[0]!.loecher).toHaveLength(1);
    expect(r.punkteVereinfacht).toBeLessThan(r.punkteRoh);
    expect(r.svg.text).toContain('fill-rule="evenodd"');
    expect(r.svg.text).toContain(' C '); // geglättet
    expect(Object.keys(r.zeiten)).toHaveLength(7);
  });

  it('rechnet nur ab dem geänderten Schritt neu und behält frühere Teile', () => {
    const bild = testbild();
    const erst = fuehreAus(bild, STANDARD);
    const neu = { ...STANDARD, glaetten: false };
    const zweit = fuehreAus(bild, neu, { einstellungen: STANDARD, ergebnis: erst.ergebnis });
    expect(zweit.ab).toBe(7);
    expect(zweit.ergebnis.konturen).toBe(erst.ergebnis.konturen); // dasselbe Objekt, nicht neu berechnet
    expect(zweit.ergebnis.geglaettet).toBeNull();
    expect(zweit.ergebnis.svg.text).not.toContain(' C ');
  });

  it('rechnet bei einem neuen Bild alles neu', () => {
    const erst = fuehreAus(testbild(), STANDARD);
    const zweit = fuehreAus(testbild(), STANDARD, { einstellungen: STANDARD, ergebnis: erst.ergebnis });
    expect(zweit.ab).toBe(1);
  });

  it('Schwellwert von Hand und ohne Entrauschen', () => {
    const e = { ...STANDARD, schwelleAutomatisch: false, schwelle: 5, entrauschen: false };
    const { ergebnis: r } = fuehreAus(testbild(), e);
    expect(r.schwelle).toBe(5);
    expect(r.binaer.daten.every((v) => v === 0)).toBe(true); // nichts ist dunkler als 5
    expect(r.konturen).toHaveLength(0);
    expect(r.svg.text).not.toContain('<path');
  });
});
