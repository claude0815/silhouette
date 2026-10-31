import { describe, expect, it } from 'vitest';
import { STANDARD } from '../pipeline/ablauf';
import type { Farbbild } from '../pipeline/bilder';
import { Rechendienst, verbinde, type Antwort, type Auftrag } from './dienst';

const bild = (): Farbbild => {
  const daten = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  for (let i = 0; i < 4 * 30; i += 4) daten[i] = daten[i + 1] = daten[i + 2] = 0; // drei schwarze Zeilen
  return { breite: 10, hoehe: 10, daten };
};

describe('Rechendienst', () => {
  it('meldet einen Fehler ohne Bild', () => {
    const a = new Rechendienst().bearbeite({ art: 'rechne', nummer: 1, einstellungen: STANDARD });
    expect(a).toEqual({ art: 'fehler', nummer: 1, text: 'Es ist noch kein Bild geladen.' });
  });

  it('schickt beim ersten Mal alles außer dem Bild, danach nur das Neue', () => {
    const d = new Rechendienst();
    const erst = d.bearbeite({ art: 'rechne', nummer: 1, bild: bild(), einstellungen: STANDARD });
    if (erst.art !== 'ergebnis') throw new Error(erst.text);
    expect(erst.ab).toBe(1);
    expect(erst.teil.bild).toBeUndefined();
    expect(erst.teil.grau).toBeDefined();
    expect(erst.teil.svg?.text).toContain('<path');

    const zweit = d.bearbeite({ art: 'rechne', nummer: 2, einstellungen: { ...STANDARD, breiteMm: 50 } });
    if (zweit.art !== 'ergebnis') throw new Error(zweit.text);
    expect(zweit.ab).toBe(8);
    expect(Object.keys(zweit.teil).sort()).toEqual(['svg', 'zeiten']);
  });
});

describe('verbinde', () => {
  it('bearbeitet nach einer Pause nur den neuesten Auftrag, behält aber das Bild', async () => {
    let empfaenger: (a: Auftrag) => void = () => undefined;
    const antworten: Antwort[] = [];
    verbinde((f) => (empfaenger = f), (a) => antworten.push(a));
    empfaenger({ art: 'rechne', nummer: 1, bild: bild(), einstellungen: STANDARD });
    empfaenger({ art: 'rechne', nummer: 2, einstellungen: { ...STANDARD, toleranz: 2 } });
    empfaenger({ art: 'rechne', nummer: 3, einstellungen: { ...STANDARD, toleranz: 3 } });
    await new Promise((r) => setTimeout(r, 20));
    expect(antworten.map((a) => [a.art, a.nummer])).toEqual([['ergebnis', 3]]);
  });
});
