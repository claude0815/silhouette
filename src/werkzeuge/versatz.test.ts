import { describe, expect, it } from 'vitest';
import type { Punkt } from '../cutter/types';
import { leseSvg } from '../svg/dokument';
import { abstandsquadrate, rastere, versatzInSvg, versetze } from './versatz';

const svg = (inhalt: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="200mm" viewBox="0 0 200 200">\n${inhalt}\n</svg>`;

function rahmen(k: Punkt[]) {
  const xs = k.map((p) => p.x);
  const ys = k.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function flaeche(k: Punkt[]) {
  let a = 0;
  k.forEach((p, i) => {
    const q = k[(i + 1) % k.length]!;
    a += p.x * q.y - q.x * p.y;
  });
  return Math.abs(a) / 2;
}

describe('abstandsquadrate', () => {
  it('stimmt mit der Rechnung „jeder gegen jeden“ überein', () => {
    let zufall = 7;
    const naechste = () => ((zufall = (zufall * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const breite = 23;
    const hoehe = 17;
    const daten = new Uint8Array(breite * hoehe).map(() => (naechste() < 0.08 ? 1 : 0));
    const d = abstandsquadrate({ breite, hoehe, daten }, 1);
    for (let y = 0; y < hoehe; y++)
      for (let x = 0; x < breite; x++) {
        let best = Infinity;
        for (let v = 0; v < hoehe; v++)
          for (let u = 0; u < breite; u++) if (daten[v * breite + u]) best = Math.min(best, (u - x) ** 2 + (v - y) ** 2);
        expect(d[y * breite + x]).toBe(best);
      }
  });

  it('liefert unendlich, wenn es kein Ziel gibt', () => {
    const d = abstandsquadrate({ breite: 3, hoehe: 2, daten: new Uint8Array(6) }, 1);
    expect([...d].every((w) => w === Infinity)).toBe(true);
  });
});

describe('rastere', () => {
  it('füllt ein Quadrat und lässt ein Loch frei (gerade-ungerade)', () => {
    const aussen = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const loch = [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }];
    const r = rastere([aussen, loch], 0, 0, 10, 10, 1);
    const summe = r.daten.reduce((s, v) => s + v, 0);
    expect(summe).toBe(100 - 16);
    expect(r.daten[5 * 10 + 5]).toBe(0);
  });
});

describe('versetze', () => {
  it('vergrößert ein Quadrat nach außen mit runden Ecken', () => {
    const dok = leseSvg(svg('<rect x="50" y="50" width="20" height="20"/>'));
    const e = versetze(dok, { abstandMm: 5 })!;
    expect(e.konturen).toHaveLength(1);
    const r = rahmen(e.konturen[0]!);
    expect(r.x0).toBeCloseTo(45, 0);
    expect(r.x1 - r.x0).toBeCloseTo(30, 0);
    expect(r.y1 - r.y0).toBeCloseTo(30, 0);
    // Quadrat + vier Randstreifen + vier Viertelkreise
    expect(flaeche(e.konturen[0]!)).toBeCloseTo(400 + 4 * 20 * 5 + Math.PI * 25, -1);
  });

  it('verkleinert ein Quadrat nach innen', () => {
    const dok = leseSvg(svg('<rect x="50" y="50" width="20" height="20"/>'));
    const r = rahmen(versetze(dok, { abstandMm: -2 })!.konturen[0]!);
    expect(r.x0).toBeCloseTo(52, 0);
    expect(r.x1 - r.x0).toBeCloseTo(16, 0);
  });

  it('macht aus einem Kreis einen größeren Kreis', () => {
    const dok = leseSvg(svg('<circle cx="100" cy="100" r="10"/>'));
    const k = versetze(dok, { abstandMm: 3 })!.konturen[0]!;
    for (const p of k) expect(Math.hypot(p.x - 100, p.y - 100)).toBeGreaterThan(12.8);
    for (const p of k) expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(13.2);
  });

  it('lässt nahe Formen verschmelzen', () => {
    const dok = leseSvg(svg('<rect x="10" y="10" width="10" height="10"/>\n<rect x="24" y="10" width="10" height="10"/>'));
    expect(versetze(dok, { abstandMm: 1 })!.konturen).toHaveLength(2);
    expect(versetze(dok, { abstandMm: 3 })!.konturen).toHaveLength(1);
  });

  it('lässt kleine Löcher verschwinden', () => {
    const dok = leseSvg(svg('<path fill-rule="evenodd" d="M 10 10 H 50 V 50 H 10 Z M 28 28 H 32 V 32 H 28 Z"/>'));
    expect(versetze(dok, { abstandMm: 1 })!.konturen).toHaveLength(2);
    expect(versetze(dok, { abstandMm: 3 })!.konturen).toHaveLength(1);
  });

  it('beachtet die Auswahl und ignoriert offene Linien', () => {
    const dok = leseSvg(svg('<path d="M 0 0 L 50 50"/>\n<rect x="60" y="60" width="10" height="10"/>'));
    expect(versetze(dok, { abstandMm: 2, pfade: [0] })).toBeNull();
    expect(versetze(dok, { abstandMm: 2 })!.konturen).toHaveLength(1);
  });

  it('vergröbert das Raster bei großen Formen', () => {
    const dok = leseSvg(svg('<rect x="0" y="0" width="200" height="200"/>'));
    const e = versetze(dok, { abstandMm: 2, maxZellen: 100_000 })!;
    expect(e.zelle).toBeGreaterThan(0.1);
    expect(e.raster.breite * e.raster.hoehe).toBeLessThan(110_000);
  });
});

describe('versatzInSvg', () => {
  const text = svg('  <rect x="50" y="50" width="20" height="20"/>');
  const dok = leseSvg(text);
  const e = versetze(dok, { abstandMm: 2 })!;

  it('fügt einen neuen Pfad an und behält das Original', () => {
    const neu = versatzInSvg(text, dok, e.konturen, { abstandMm: 2, ersetzen: false });
    expect(neu).toContain('<rect');
    expect(neu).toContain('2 mm nach außen');
    const d2 = leseSvg(neu);
    expect(d2.pfade).toHaveLength(2);
  });

  it('ersetzt auf Wunsch das Original', () => {
    const neu = versatzInSvg(text, dok, e.konturen, { abstandMm: 2, ersetzen: true });
    expect(neu).not.toContain('<rect');
    expect(leseSvg(neu).pfade).toHaveLength(1);
  });
});
