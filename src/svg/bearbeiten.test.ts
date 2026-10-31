import { describe, expect, it } from 'vitest';
import { befehlsGriffe, codeZahl, ziehePunkt } from './bearbeiten';
import { lesePfad } from './pfad';

describe('Griffe', () => {
  it('Endpunkte und Kontrollpunkte mit ihren Zahlen', () => {
    const g = befehlsGriffe(lesePfad('M 10 10 C 20 0 30 0 40 10 H 60 Z'));
    expect(g.map((x) => [x.befehl, x.rolle, x.p.x, x.p.y, x.x, x.y])).toEqual([
      [0, 'ende', 10, 10, 0, 1],
      [1, 'kontrolle1', 20, 0, 0, 1],
      [1, 'kontrolle2', 30, 0, 2, 3],
      [1, 'ende', 40, 10, 4, 5],
      [2, 'ende', 60, 10, 0, null], // H hat nur eine x-Zahl
    ]);
  });

  it('relative Befehle beziehen sich auf den Punkt davor', () => {
    const g = befehlsGriffe(lesePfad('M 10 10 l 5 0 l 0 5'));
    expect(g.map((x) => x.p)).toEqual([
      { x: 10, y: 10 },
      { x: 15, y: 10 },
      { x: 15, y: 15 },
    ]);
    expect(g[2]!.bezug).toEqual({ x: 15, y: 10 });
  });
});

describe('Punkt ziehen', () => {
  it('ändert nur die Zahlen des gezogenen Punkts', () => {
    const text = '<path d="M 10 10 L 50 10 L 50 50"/>';
    const befehle = lesePfad(text.slice(9, -3)).map((b) => ({
      ...b,
      zahlen: b.zahlen.map((z) => ({ start: z.start + 9, ende: z.ende + 9 })),
    }));
    const griff = befehlsGriffe(befehle)[1]!;
    expect(ziehePunkt(text, befehle, griff, { x: 42.123, y: 7 })).toBe('<path d="M 10 10 L 42.12 7 L 50 50"/>');
  });

  it('schreibt bei relativen Befehlen den Abstand', () => {
    const d = 'M 10 10 l 5 0';
    const befehle = lesePfad(d);
    const griff = befehlsGriffe(befehle)[1]!;
    expect(ziehePunkt(d, befehle, griff, { x: 20, y: 13 })).toBe('M 10 10 l 10 3');
  });

  it('bei H ändert sich nur x', () => {
    const d = 'M 0 0 H 30';
    const befehle = lesePfad(d);
    expect(ziehePunkt(d, befehle, befehlsGriffe(befehle)[1]!, { x: 12, y: 99 })).toBe('M 0 0 H 12');
  });

  it('Zahlen für den Code', () => {
    expect(codeZahl(1.005)).toBe('1');
    expect(codeZahl(-0.001)).toBe('0');
    expect(codeZahl(12.3456)).toBe('12.35');
  });
});
