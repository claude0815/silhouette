import { describe, expect, it } from 'vitest';
import { binaerAlsText, binaerAusText, type Farbbild, type Graubild } from './bilder';
import { entrausche, findeBereiche } from './entrauschen';
import { formel, grauwert, zuGraustufen } from './graustufen';
import { binarisiere, histogramm, otsu } from './schwellwert';

function farbbild(pixel: Array<[number, number, number, number]>, breite: number): Farbbild {
  return { breite, hoehe: pixel.length / breite, daten: new Uint8ClampedArray(pixel.flat()) };
}

function graubild(werte: number[], breite = werte.length): Graubild {
  return { breite, hoehe: werte.length / breite, daten: Uint8Array.from(werte) };
}

describe('Graustufen', () => {
  it('Mittelwert und Luminanz unterscheiden sich bei reinen Farben', () => {
    expect(grauwert(255, 0, 0, 'mittelwert')).toBe(85);
    expect(grauwert(0, 255, 0, 'mittelwert')).toBe(85);
    // Grün wirkt heller als Blau
    expect(grauwert(0, 255, 0, 'luminanz')).toBe(150);
    expect(grauwert(0, 0, 255, 'luminanz')).toBe(29);
    expect(grauwert(255, 255, 255, 'luminanz')).toBe(255);
  });

  it('setzt durchsichtige Pixel auf weißes Papier', () => {
    const bild = farbbild(
      [
        [0, 0, 0, 255],
        [0, 0, 0, 0],
        [0, 0, 0, 128],
      ],
      3,
    );
    expect(Array.from(zuGraustufen(bild).daten)).toEqual([0, 255, 127]);
  });

  it('nennt die Formel', () => {
    expect(formel('mittelwert')).toBe('Grau = (R + G + B) / 3');
    expect(formel('luminanz')).toContain('0.587 · G');
  });
});

describe('Histogramm und Schwellwert', () => {
  it('zählt Grauwerte', () => {
    const h = histogramm(graubild([0, 0, 7, 255]));
    expect(h[0]).toBe(2);
    expect(h[7]).toBe(1);
    expect(h[255]).toBe(1);
    expect(h.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('dunkle Pixel werden Vordergrund, invertieren dreht das um', () => {
    const g = graubild([10, 127, 128, 250]);
    expect(Array.from(binarisiere(g, 128).daten)).toEqual([1, 1, 0, 0]);
    expect(Array.from(binarisiere(g, 128, true).daten)).toEqual([0, 0, 1, 1]);
  });

  it('Otsu findet das Tal zwischen zwei Bergen', () => {
    // 100 Pixel um 40, 100 Pixel um 200
    const werte = [...Array(100)].flatMap((_, i) => [38 + (i % 5), 198 + (i % 5)]);
    const t = otsu(histogramm(graubild(werte)));
    expect(t).toBeGreaterThan(42);
    expect(t).toBeLessThanOrEqual(198);
    const bin = binarisiere(graubild(werte), t);
    expect(bin.daten.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('Otsu liefert bei einfarbigen und leeren Bildern einen gültigen Wert', () => {
    expect(otsu(histogramm(graubild([90, 90, 90])))).toBe(128);
    expect(otsu(new Uint32Array(256))).toBe(128);
  });
});

describe('Zusammenhängende Bereiche', () => {
  it('Vordergrund: Pixel, die sich nur an der Ecke berühren, sind getrennt', () => {
    const { bereiche } = findeBereiche(binaerAusText(['#.', '.#']));
    expect(bereiche.filter((b) => b.wert === 1)).toHaveLength(2);
    // Der Hintergrund dagegen ist über die Ecke verbunden (8er-Nachbarschaft)
    expect(bereiche.filter((b) => b.wert === 0)).toHaveLength(1);
  });

  it('erkennt Löcher daran, dass sie den Rand nicht berühren', () => {
    const { bereiche } = findeBereiche(binaerAusText(['.....', '.###.', '.#.#.', '.###.', '.....']));
    const hintergrund = bereiche.filter((b) => b.wert === 0);
    expect(hintergrund.map((b) => [b.flaeche, b.amRand])).toEqual([
      [16, true],
      [1, false],
    ]);
  });
});

describe('Entrauschen', () => {
  const bild = binaerAusText([
    '#.........', //
    '...####...',
    '...#..#...',
    '...####.#.',
    '..........',
  ]);

  it('entfernt kleine Flecken und füllt kleine Löcher', () => {
    const e = entrausche(bild, 3);
    expect(binaerAlsText(e.bild)).toEqual([
      '..........', //
      '...####...',
      '...####...',
      '...####...',
      '..........',
    ]);
    expect(e.entfernteFlecken.map((b) => b.flaeche)).toEqual([1, 1]);
    expect(e.gefuellteLoecher.map((b) => b.flaeche)).toEqual([2]);
  });

  it('lässt große Bereiche stehen und verändert das Original nicht', () => {
    const vorher = binaerAlsText(bild);
    const e = entrausche(bild, 2);
    expect(binaerAlsText(e.bild)[2]).toBe('...#..#...'); // Loch mit 2 Pixeln bleibt
    expect(binaerAlsText(bild)).toEqual(vorher);
  });

  it('entfernt auch Flecken, die in kleinen Löchern sitzen', () => {
    const e = entrausche(binaerAusText(['.......', '.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.', '.......']), 10);
    expect(binaerAlsText(e.bild).slice(1, 6)).toEqual(Array(5).fill('.#####.'));
  });

  it('Mindestfläche 1 oder weniger ändert nichts', () => {
    expect(binaerAlsText(entrausche(bild, 1).bild)).toEqual(binaerAlsText(bild));
  });
});
