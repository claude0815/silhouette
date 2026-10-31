import { describe, expect, it } from 'vitest';
import { begrenzeRechteck, schneideZu, type Farbbild } from './bilder';

/** 4 × 3 Pixel, Rotwert = Pixelnummer */
const bild: Farbbild = {
  breite: 4,
  hoehe: 3,
  daten: Uint8ClampedArray.from({ length: 48 }, (_, i) => (i % 4 === 0 ? i / 4 : 255)),
};
const rotwerte = (b: Farbbild) => Array.from({ length: b.breite * b.hoehe }, (_, i) => b.daten[4 * i]);

describe('Zuschnitt', () => {
  it('schneidet den Ausschnitt Zeile für Zeile aus', () => {
    const z = schneideZu(bild, { x: 1, y: 1, breite: 2, hoehe: 2 });
    expect([z.breite, z.hoehe]).toEqual([2, 2]);
    expect(rotwerte(z)).toEqual([5, 6, 9, 10]);
  });

  it('begrenzt auf das Bild, auch bei rückwärts aufgezogenem Rechteck', () => {
    expect(begrenzeRechteck({ x: 3, y: 2, breite: -10, hoehe: -10 }, 4, 3)).toEqual({ x: 0, y: 0, breite: 3, hoehe: 2 });
    expect(begrenzeRechteck({ x: 2, y: 1, breite: 50, hoehe: 50 }, 4, 3)).toEqual({ x: 2, y: 1, breite: 2, hoehe: 2 });
    expect(begrenzeRechteck({ x: 9, y: 9, breite: 0, hoehe: 0 }, 4, 3)).toEqual({ x: 3, y: 2, breite: 1, hoehe: 1 });
  });
});
