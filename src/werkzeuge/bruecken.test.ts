import { describe, expect, it } from 'vitest';
import { pruefe } from '../checks/cutter-checks';
import { vorzeichenFlaeche } from '../pipeline/konturen';
import { leseSvg, svgKonturen } from '../svg/dokument';
import { entferneStreifen, schneideAb, setzeBruecken } from './bruecken';

const quadrat = (a: number, b: number) => [
  { x: a, y: a },
  { x: b, y: a },
  { x: b, y: b },
  { x: a, y: b },
];
const flaeche = (v: { x: number; y: number }[][]) => v.reduce((s, k) => s + Math.abs(vorzeichenFlaeche(k)), 0);

describe('Fläche an einer Geraden abschneiden', () => {
  it('ein Quadrat wird zum Rechteck', () => {
    const [r] = schneideAb([quadrat(0, 10)], 4, 'links');
    expect(Math.abs(vorzeichenFlaeche(r!))).toBeCloseTo(40);
    expect(Math.max(...r!.map((p) => p.x))).toBeCloseTo(4);
  });

  it('ein Rahmen wird an der Geraden in ein „C“ verwandelt (Loch und Außenkontur verbunden)', () => {
    const rahmen = [quadrat(0, 10), quadrat(3, 7)];
    const links = schneideAb(rahmen, 5, 'links');
    expect(links).toHaveLength(1); // ein zusammenhängendes C
    expect(flaeche(links)).toBeCloseTo(100 / 2 - 16 / 2);
  });

  it('ein Streifen durch einen Rahmen ergibt zwei Teile mit der richtigen Fläche', () => {
    const teile = entferneStreifen([quadrat(0, 10), quadrat(3, 7)], 4, 6);
    expect(teile).toHaveLength(2);
    // Rahmenfläche 84, Streifen nimmt oben und unten je 2 × 3 weg
    expect(flaeche(teile)).toBeCloseTo(84 - 12);
  });

  it('Punkte genau auf der Geraden machen keine Probleme', () => {
    const teile = entferneStreifen([quadrat(0, 10), quadrat(4, 6)], 4, 6);
    expect(flaeche(teile)).toBeCloseTo(96 - 2 * 2 * 4, 3);
  });
});

describe('Brücken setzen', () => {
  const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="70mm" viewBox="0 0 70 70">
  <rect x="2" y="2" width="5" height="5" fill="none" stroke="black"/>
  <path fill-rule="evenodd" d="M 10 35 A 25 25 0 1 1 60 35 A 25 25 0 1 1 10 35 Z M 22 35 A 13 13 0 1 1 48 35 A 13 13 0 1 1 22 35 Z"/>
</svg>
`;

  it('hält die Insel fest: keine Inseln mehr, alles geschlossen, Fläche um zwei Brücken kleiner', () => {
    const vorher = leseSvg(ring);
    const r = setzeBruecken(ring, vorher, { breiteMm: 2, richtung: 'senkrecht' })!;
    expect(r.inseln).toBe(1);
    const nachher = leseSvg(r.text);
    expect(nachher.hinweise.filter((h) => h.art === 'fehler')).toEqual([]);
    const befunde = pruefe(nachher, { bereich: { breite: 300, hoehe: 300 } });
    expect(befunde.find((b) => b.id === 'inseln')!.anzahl).toBe(0);
    expect(befunde.find((b) => b.id === 'offen')!.anzahl).toBe(0);
    expect(befunde.find((b) => b.id === 'doppelt')!.anzahl).toBe(0);

    const ringFlaeche = Math.PI * (25 * 25 - 13 * 13);
    const teile = svgKonturen(nachher).filter((k) => k.pfad === nachher.pfade.length - 1).map((k) => k.punkte.slice(0, -1));
    expect(teile).toHaveLength(2); // zwei C-förmige Hälften
    // Zwei Brücken von 2 mm Breite und 12 mm Ringbreite (genähert; der Kreis ist an der Brücke leicht gekrümmt)
    expect(flaeche(teile)).toBeCloseTo(ringFlaeche - 2 * 2 * 12, -1);
  });

  it('lässt andere Elemente unverändert stehen', () => {
    const r = setzeBruecken(ring, leseSvg(ring), { breiteMm: 2, richtung: 'waagerecht' })!;
    expect(r.text).toContain('<rect x="2" y="2" width="5" height="5" fill="none" stroke="black"/>');
    expect(r.text).toContain('<!-- Brücken: 2 mm, waagerecht');
    // waagerecht: die Teile liegen oben und unten
    const nachher = leseSvg(r.text);
    const ys = svgKonturen(nachher)
      .filter((k) => k.pfad === nachher.pfade.length - 1)
      .map((k) => Math.max(...k.punkte.map((p) => p.y)));
    expect(Math.min(...ys)).toBeLessThan(35);
  });

  it('ohne Inseln gibt es nichts zu tun', () => {
    const ohne = '<svg width="10mm" height="10mm" viewBox="0 0 10 10"><rect width="5" height="5"/></svg>';
    expect(setzeBruecken(ohne, leseSvg(ohne), { breiteMm: 2, richtung: 'senkrecht' })).toBeNull();
  });

  it('auch ein „8“ mit zwei Löchern und eine viewBox in anderer Einheit', () => {
    const acht = `<svg width="40mm" height="80mm" viewBox="0 0 400 800">
  <path fill-rule="evenodd" d="M 0 0 H 400 V 800 H 0 Z M 100 100 H 300 V 350 H 100 Z M 100 450 H 300 V 700 H 100 Z"/>
</svg>`;
    const r = setzeBruecken(acht, leseSvg(acht), { breiteMm: 3, richtung: 'senkrecht' })!;
    expect(r.inseln).toBe(2);
    const befunde = pruefe(leseSvg(r.text), { bereich: { breite: 300, hoehe: 300 } });
    expect(befunde.find((b) => b.id === 'inseln')!.anzahl).toBe(0);
  });
});
