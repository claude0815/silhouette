import { describe, expect, it } from 'vitest';
import { istGeschlossen } from '../export/dxf';
import { formAlsPfad, leseElemente, leseSvg, svgKonturen, zeichenDaten } from './dokument';

const svg = (inhalt: string, kopf = 'width="100mm" height="100mm" viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${kopf}>${inhalt}</svg>`;

const rahmen = (punkte: { x: number; y: number }[]) => {
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((n) => Math.round(n * 100) / 100);
};

describe('Elementbaum', () => {
  it('kennt Eltern und das Ende des ganzen Elements', () => {
    const text = '<svg><g id="a"><rect/></g><!-- <rect/> --><?x?></svg>';
    const e = leseElemente(text);
    expect(e.map((x) => [x.name, x.eltern])).toEqual([
      ['svg', -1],
      ['g', 0],
      ['rect', 1],
    ]);
    expect(text.slice(e[1]!.start, e[1]!.elementEnde)).toBe('<g id="a"><rect/></g>');
  });

  it('meldet falsch verschachtelte Tags', () => {
    const hinweise: { text: string }[] = [];
    leseElemente('<svg><g><rect></g></svg></path>', hinweise as never);
    const t = hinweise.map((h) => h.text).join(' | ');
    expect(t).toMatch(/<rect> wird nicht geschlossen/);
    expect(t).toMatch(/<\/path> schließt kein offenes Element/);
  });
});

describe('Formen werden zu Pfaden', () => {
  const zahl = (werte: Record<string, number>) => (name: string, standard = NaN) => werte[name] ?? standard;

  it('rect, circle, line, polygon', () => {
    expect(formAlsPfad('rect', zahl({ x: 10, y: 10, width: 40, height: 20 }), '')).toBe('M 10 10 H 50 V 30 H 10 Z');
    expect(formAlsPfad('circle', zahl({ cx: 50, cy: 50, r: 10 }), '')).toBe(
      'M 60 50 A 10 10 0 1 1 40 50 A 10 10 0 1 1 60 50 Z',
    );
    expect(formAlsPfad('line', zahl({ x1: 1, y1: 2, x2: 3, y2: 4 }), '')).toBe('M 1 2 L 3 4');
    expect(formAlsPfad('polygon', zahl({}), '0,0 10,0 5,8')).toBe('M 0 0 L 10 0 L 5 8 Z');
    expect(formAlsPfad('polyline', zahl({}), '0,0 10,0 5,8')).toBe('M 0 0 L 10 0 L 5 8');
    expect(formAlsPfad('rect', zahl({ width: 0, height: 5 }), '')).toBeNull();
  });

  it('abgerundetes Rechteck mit Bögen; rx wird auf die halbe Breite begrenzt', () => {
    const d = formAlsPfad('rect', zahl({ x: 0, y: 0, width: 20, height: 10, rx: 50 }), '')!;
    expect(d).toContain('A 10 5 0 0 1');
  });

  it('Kreis: Kontur liegt auf dem Kreis, Maße in mm', () => {
    const dok = leseSvg(svg('<circle cx="50" cy="50" r="20"/>'));
    expect(dok.pfade[0]!.umgerechnet).toMatch(/^M 70 50 A/);
    const [k] = svgKonturen(dok);
    expect(k!.geschlossen).toBe(true);
    expect(istGeschlossen(k!.punkte)).toBe(true);
    for (const p of k!.punkte) expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(20, 1);
    expect(rahmen(k!.punkte as never)).toEqual([30, 30, 70, 70]);
  });
});

describe('Gruppen, transform und Stil', () => {
  it('wendet verschachtelte Transformationen an', () => {
    const dok = leseSvg(svg('<g transform="translate(50 0)"><rect transform="scale(2)" x="0" y="0" width="10" height="5"/></g>'));
    expect(rahmen(svgKonturen(dok)[0]!.punkte as never)).toEqual([50, 0, 70, 10]);
  });

  it('rechnet viewBox und Einheiten um', () => {
    // 200 Einheiten auf 50 mm: 1 Einheit = 0,25 mm
    const dok = leseSvg(svg('<rect x="0" y="0" width="200" height="40"/>', 'width="50mm" height="10mm" viewBox="0 0 200 40"'));
    expect(rahmen(svgKonturen(dok)[0]!.punkte as never)).toEqual([0, 0, 50, 10]);
  });

  it('erbt fill und stroke, style hat Vorrang', () => {
    const dok = leseSvg(svg('<g fill="none" stroke="red"><path d="M0 0L5 5"/><path style="fill: blue; stroke:none" d="M0 0L5 5"/></g><rect width="5" height="5"/>'));
    expect(dok.pfade.map((p) => p.stil)).toEqual([
      { fuellung: null, kontur: 'red', fuellregel: 'nonzero' },
      { fuellung: 'blue', kontur: null, fuellregel: 'nonzero' },
      { fuellung: 'black', kontur: null, fuellregel: 'nonzero' }, // Standard: schwarz gefüllt
    ]);
  });

  it('überspringt Inhalt von defs und meldet Text', () => {
    const dok = leseSvg(svg('<defs><rect width="5" height="5"/></defs><text>Hallo</text><rect width="5" height="5"/>'));
    expect(dok.pfade).toHaveLength(1);
    expect(dok.hinweise.map((h) => h.text).join()).toMatch(/Text wird nicht geschnitten/);
  });
});

describe('Fehlertoleranz', () => {
  it('zeichnet einen Pfad bis zur Fehlerstelle und markiert sie', () => {
    const text = svg('<path d="M 10 10 L 50 10 L 50 50 Q"/>');
    const dok = leseSvg(text);
    const [f] = dok.hinweise.filter((h) => h.art === 'fehler');
    expect(f!.text).toMatch(/bis zur Fehlerstelle/);
    expect(text[f!.position!]).toBe('Q');
    expect(zeichenDaten(text, dok.pfade[0]!)).toBe('M 10 10 L 50 10 L 50 50');
  });

  it('meldet ungültige Transformation an ihrer Stelle', () => {
    const text = svg('<rect transform="drehe(5)" width="5" height="5"/>');
    const h = leseSvg(text).hinweise.find((x) => x.art === 'fehler')!;
    expect(text.slice(h.position, h.ende)).toBe('drehe(5)');
  });
});
