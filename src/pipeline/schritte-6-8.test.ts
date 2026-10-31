import { describe, expect, it } from 'vitest';
import { binaerAusText, type Punkt } from './bilder';
import { bezierPunkt, glaette, istGerade, knickwinkel } from './glaetten';
import { findeKonturen, gruppiere } from './konturen';
import { erzeugeSvg, svgZahl, teilpfad } from './svg-erzeugen';
import { abstandZurStrecke, douglasPeucker, vereinfacheGeschlossen } from './vereinfachen';

const P = (x: number, y: number): Punkt => ({ x, y });

describe('Douglas-Peucker', () => {
  it('misst den Abstand zur Strecke, nicht zur Geraden', () => {
    expect(abstandZurStrecke(P(5, 3), P(0, 0), P(10, 0))).toBe(3);
    expect(abstandZurStrecke(P(13, 4), P(0, 0), P(10, 0))).toBe(5); // hinter dem Ende
  });

  it('entfernt Punkte, die fast auf einer Geraden liegen', () => {
    const linie = [P(0, 0), P(1, 0.1), P(2, -0.1), P(3, 0.05), P(4, 0)];
    expect(douglasPeucker(linie, 0.2)).toEqual([P(0, 0), P(4, 0)]);
    expect(douglasPeucker(linie, 0.01)).toHaveLength(5);
  });

  it('behält deutliche Ecken', () => {
    const haken = [P(0, 0), P(5, 0), P(10, 0), P(10, 5), P(10, 10)];
    expect(douglasPeucker(haken, 0.5)).toEqual([P(0, 0), P(10, 0), P(10, 10)]);
  });

  it('macht aus der Kontur eines Pixelquadrats ein Viereck mit Ecken', () => {
    const [k] = findeKonturen(binaerAusText(['....', '.##.', '.##.', '....']));
    expect(k!.punkte).toHaveLength(8);
    const v = vereinfacheGeschlossen(k!.punkte, 0.1);
    // Marching Squares schneidet die Ecken ab: ein Achteck. Mit großer Toleranz ein Viereck.
    expect(v).toHaveLength(8);
    expect(vereinfacheGeschlossen(k!.punkte, 0.5)).toHaveLength(4);
  });

  it('lässt immer mindestens drei Punkte übrig', () => {
    const [k] = findeKonturen(binaerAusText(['#']));
    expect(vereinfacheGeschlossen(k!.punkte, 100)).toHaveLength(3);
  });

  it('schafft auch sehr lange Konturen ohne Stapelüberlauf', () => {
    const kreis = Array.from({ length: 200_000 }, (_, i) => {
      const w = (2 * Math.PI * i) / 200_000;
      return P(1000 * Math.cos(w), 1000 * Math.sin(w));
    });
    const v = vereinfacheGeschlossen(kreis, 0.5);
    expect(v.length).toBeGreaterThan(50);
    expect(v.length).toBeLessThan(200);
  });
});

describe('Glätten', () => {
  it('misst Knickwinkel', () => {
    expect(knickwinkel(P(0, 0), P(1, 0), P(2, 0))).toBe(0);
    expect(knickwinkel(P(0, 0), P(1, 0), P(1, 1))).toBeCloseTo(90);
  });

  it('Stärke 0 ergibt gerade Linien', () => {
    const quadrat = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];
    const pfad = glaette(quadrat, { staerke: 0, eckenWinkel: 70 });
    let von = pfad.start;
    for (const s of pfad.segmente) {
      expect(istGerade(von, s)).toBe(true);
      von = s.p;
    }
    expect(von).toEqual(pfad.start);
  });

  it('Ecken bleiben spitz, flache Knicke werden rund', () => {
    // Quadrat: 90°-Ecken bleiben gerade Linien
    const quadrat = glaette([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], { staerke: 1, eckenWinkel: 70 });
    expect(quadrat.segmente.every((s, i) => istGerade(i === 0 ? quadrat.start : quadrat.segmente[i - 1]!.p, s))).toBe(true);
    // Zwölfeck (30°-Knicke): wird rund, die Kurve bleibt nahe am Kreis
    const zwoelfeck = Array.from({ length: 12 }, (_, i) => P(10 * Math.cos((i * Math.PI) / 6), 10 * Math.sin((i * Math.PI) / 6)));
    const rund = glaette(zwoelfeck, { staerke: 1, eckenWinkel: 70 });
    let von = rund.start;
    for (const s of rund.segmente) {
      expect(istGerade(von, s)).toBe(false);
      const mitte = bezierPunkt(von, s.c1, s.c2, s.p, 0.5);
      expect(Math.hypot(mitte.x, mitte.y)).toBeCloseTo(10, 0); // Radius ≈ 10, deutlich näher als die Sehne (9,66)
      von = s.p;
    }
  });

  it('die Kurve geht durch Anfang und Ende', () => {
    const p = bezierPunkt(P(0, 0), P(1, 5), P(4, 5), P(5, 0), 0);
    expect(p).toEqual(P(0, 0));
    expect(bezierPunkt(P(0, 0), P(1, 5), P(4, 5), P(5, 0), 1)).toEqual(P(5, 0));
  });
});

describe('SVG erzeugen', () => {
  it('formatiert Zahlen ohne überflüssige Nullen', () => {
    expect(svgZahl(1.5)).toBe('1.5');
    expect(svgZahl(2)).toBe('2');
    expect(svgZahl(1 / 3)).toBe('0.33');
    expect(svgZahl(-0.001)).toBe('0');
  });

  it('Vieleck und Bézier-Pfad als Pfaddaten', () => {
    const pt = (p: Punkt) => `${p.x} ${p.y}`;
    expect(teilpfad([P(0, 0), P(1, 0), P(1, 1)], pt)).toBe('M 0 0 L 1 0 L 1 1 Z');
    const kurve = glaette([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], { staerke: 1, eckenWinkel: 120 });
    expect(teilpfad(kurve, pt)).toMatch(/^M 0 0 C .* Z$/);
  });

  it('erzeugt ein Dokument in mm mit evenodd für Löcher', () => {
    const bild = binaerAusText(['......', '.####.', '.#..#.', '.####.', '......']);
    const formen = gruppiere(findeKonturen(bild)).map((f) => ({
      aussen: vereinfacheGeschlossen(f.aussen.punkte, 0.3),
      loecher: f.loecher.map((l) => vereinfacheGeschlossen(l.punkte, 0.3)),
    }));
    const svg = erzeugeSvg(formen, { bildBreitePx: 6, bildHoehePx: 5, breiteMm: 60, position: P(10, 5) });
    expect(svg.massstab).toBe(10);
    expect(svg.breiteMm).toBe(70);
    expect(svg.hoeheMm).toBe(55);
    expect(svg.text).toMatchInlineSnapshot(`
      "<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="55mm" viewBox="0 0 70 55">
        <path id="form-1" fill-rule="evenodd" d="M 20 20 L 25 15 L 55 15 L 60 20 L 60 40 L 55 45 L 25 45 L 20 40 Z M 30 30 L 35 35 L 45 35 L 50 30 L 45 25 L 35 25 Z"/>
      </svg>
      "
    `);
    // Zwei Teilpfade in einem <path>: außen und Loch
    expect(svg.text.match(/M /g)).toHaveLength(2);
  });
});
