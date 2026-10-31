import { describe, expect, it } from 'vitest';
import { istGeschlossen } from '../export/dxf';
import { erzeugeSvg } from '../pipeline/svg-erzeugen';
import { laengeInMm, leseElemente, leseSvg, svgZuPolylinien } from './dokument';
import { alsLinienzug, alsTeilpfade, befehlsGeometrie, lesePfad, naechsterBefehl, PfadFehler } from './pfad';

describe('lesePfad', () => {
  it('liest Befehle mit ihrer Stelle im Text', () => {
    const d = 'M 10 20 L 30,40 Z';
    const b = lesePfad(d);
    expect(b.map((x) => x.typ)).toEqual(['M', 'L', 'Z']);
    expect(d.slice(b[1]!.start, b[1]!.ende)).toBe('L 30,40');
  });

  it('versteht knappe Schreibweisen', () => {
    // „-“ trennt Zahlen, „.5“ beginnt eine neue Zahl, Wiederholung nach M wird zu L
    const b = lesePfad('M0-1.5.5 1 2 3z');
    expect(b.map((x) => [x.typ, x.relativ, x.werte])).toEqual([
      ['M', false, [0, -1.5]],
      ['L', false, [0.5, 1]],
      ['L', false, [2, 3]],
      ['Z', true, []],
    ]);
    expect(() => lesePfad('M0-1.5.5 1 2 3 4z')).toThrow(PfadFehler); // eine Zahl zu viel
  });

  it('meldet Fehler mit Position', () => {
    try {
      lesePfad('M 0 0 L 5');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PfadFehler);
      expect((e as PfadFehler).position).toBe(6);
      expect((e as PfadFehler).message).toMatch(/L erwartet 2 Zahlen/);
    }
    expect(() => lesePfad('L 1 1')).toThrow(/mit M beginnen/);
    expect(() => lesePfad('M 0 0 A 5 5 0 0 1 10 10')).toThrow(/Bögen/);
    expect(() => lesePfad('M 0 0 # 1')).toThrow(/Unerwartetes Zeichen/);
  });
});

describe('Teilpfade und Linienzüge', () => {
  it('rechnet relative Befehle, H und V in absolute Punkte um', () => {
    const [tp] = alsTeilpfade(lesePfad('m 10 10 h 5 v 5 l -5 0 z'));
    expect(alsLinienzug(tp!, 0.1)).toEqual([
      { x: 10, y: 10 },
      { x: 15, y: 10 },
      { x: 15, y: 15 },
      { x: 10, y: 15 },
      { x: 10, y: 10 },
    ]);
    expect(tp!.geschlossen).toBe(true);
  });

  it('zerlegt Kurven, feiner bei kleinerer Toleranz, und bleibt nahe an der Kurve', () => {
    // Viertelkreis mit Radius 100 als kubische Bézier-Näherung (k = 0,5523)
    const [tp] = alsTeilpfade(lesePfad('M 100 0 C 100 55.23 55.23 100 0 100'));
    const grob = alsLinienzug(tp!, 1);
    const fein = alsLinienzug(tp!, 0.01);
    expect(fein.length).toBeGreaterThan(grob.length);
    for (const p of fein) expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 0);
    expect(fein.at(-1)).toEqual({ x: 0, y: 100 });
  });

  it('Q, T und S werden zu kubischen Kurven', () => {
    const tps = alsTeilpfade(lesePfad('M 0 0 Q 5 10 10 0 T 20 0 M 0 0 C 0 5 5 5 5 0 S 10 -5 10 0'));
    expect(tps.flatMap((t) => t.abschnitte.map((a) => a.typ))).toEqual(['C', 'C', 'C', 'C']);
    // T spiegelt den Kontrollpunkt (5|10) am Punkt (10|0) zu (15|-10)
    const t = tps[0]!.abschnitte[1]!;
    if (t.typ !== 'C') throw new Error();
    expect(t.c1.x).toBeCloseTo(10 + (2 / 3) * 5);
    expect(t.c1.y).toBeCloseTo((2 / 3) * -10);
  });
});

describe('leseSvg', () => {
  it('findet Elemente und Attributwerte mit Position', () => {
    const text = '<svg a="1"><path id="x" d="M 0 0"/></svg>';
    const [svg, pfad] = leseElemente(text);
    expect(svg!.name).toBe('svg');
    const d = pfad!.attribute.find((a) => a.name === 'd')!;
    expect(text.slice(d.start, d.ende)).toBe('M 0 0');
  });

  it('rechnet Längen in mm um', () => {
    expect(laengeInMm('100mm')).toEqual({ mm: 100, einheit: 'mm' });
    expect(laengeInMm('2in')!.mm).toBeCloseTo(50.8);
    expect(laengeInMm('96')!.mm).toBeCloseTo(25.4);
    expect(laengeInMm('abc')).toBeNull();
  });

  it('Rundlauf: Pipeline-SVG → Linienzüge in mm', () => {
    const quadrat = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const loch = [
      { x: 3, y: 3 },
      { x: 3, y: 7 },
      { x: 7, y: 7 },
      { x: 7, y: 3 },
    ];
    // 10 px Bild auf 50 mm → 5 mm je Pixel, um (10 | 20) mm verschoben
    const svg = erzeugeSvg([{ aussen: quadrat, loecher: [loch] }], {
      bildBreitePx: 10,
      bildHoehePx: 10,
      breiteMm: 50,
      position: { x: 10, y: 20 },
    });
    const dok = leseSvg(svg.text);
    expect(dok.hinweise).toEqual([]);
    expect(dok.breiteMm).toBe(60);
    expect(dok.pfade[0]!.id).toBe('form-1');
    const linien = svgZuPolylinien(dok);
    expect(linien).toHaveLength(2);
    expect(linien.every(istGeschlossen)).toBe(true);
    expect(linien[0]!.slice(0, 3)).toEqual([
      { x: 10, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 70 },
    ]);
  });

  it('Befehlspositionen beziehen sich auf den Dokumenttext', () => {
    const text = '<svg width="10mm" height="10mm" viewBox="0 0 10 10"><path d="M 1 1 L 5 5"/></svg>';
    const b = leseSvg(text).pfade[0]!.befehle[1]!;
    expect(text.slice(b.start, b.ende)).toBe('L 5 5');
  });

  it('gibt Hinweise statt abzubrechen', () => {
    const dok = leseSvg('<svg width="100" height="50"><rect x="1"/><path d="M 0 0 L"/><path d="M 0 0 L 96 0"/></svg>');
    const texte = dok.hinweise.map((h) => h.text).join(' | ');
    expect(texte).toMatch(/Keine viewBox/);
    expect(texte).toMatch(/width ohne Einheit mm/);
    expect(texte).toMatch(/<rect> wird erst in Stufe 2/);
    expect(texte).toMatch(/L erwartet 2 Zahlen/);
    // Der gültige Pfad wird trotzdem gelesen: 96 px = 25,4 mm
    expect(svgZuPolylinien(dok)[0]!.at(-1)!.x).toBeCloseTo(25.4);
  });

  it('viewBox mit Versatz und anderer Einheit', () => {
    const dok = leseSvg('<svg width="20mm" height="10mm" viewBox="100 50 200 100"><path d="M 100 50 L 300 150"/></svg>');
    expect(svgZuPolylinien(dok)[0]).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ]);
  });
});

describe('Geometrie je Befehl', () => {
  const befehle = lesePfad('M 0 0 L 10 0 C 15 0 15 10 10 10 Z');

  it('ordnet jedem Befehl zu, was er zeichnet', () => {
    const g = befehlsGeometrie(befehle);
    expect(g.get(0)).toEqual({ art: 'punkt', p: { x: 0, y: 0 } });
    expect(g.get(1)).toEqual({ art: 'strecke', von: { x: 0, y: 0 }, p: { x: 10, y: 0 } });
    expect(g.get(2)?.art).toBe('kurve');
    // Z schließt mit einer Strecke zurück zum Anfang
    expect(g.get(3)).toEqual({ art: 'strecke', von: { x: 10, y: 10 }, p: { x: 0, y: 0 } });
  });

  it('findet den Befehl zur Stelle unter dem Mauszeiger', () => {
    const g = befehlsGeometrie(befehle);
    expect(naechsterBefehl(g, { x: 5, y: 0.3 }, 0.1)).toBe(1); // auf der oberen Strecke
    expect(naechsterBefehl(g, { x: 13.8, y: 5 }, 0.1)).toBe(2); // am Bauch der Kurve
    expect(naechsterBefehl(g, { x: 5, y: 5.2 }, 0.1)).toBe(3); // auf der Schlussdiagonale
  });
});
