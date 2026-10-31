import { describe, expect, it } from 'vitest';
import { dxfZahl, istGeschlossen, polylinienZuDxf } from './dxf';
import { rechteck, testformen } from './testformen';

/** Zerlegt DXF-Text in Paare aus Gruppencode und Wert. */
function paare(dxf: string): Array<[number, string]> {
  const zeilen = dxf.split('\r\n');
  expect(zeilen.pop()).toBe(''); // Datei endet mit CR LF
  expect(zeilen.length % 2).toBe(0);
  const ergebnis: Array<[number, string]> = [];
  for (let i = 0; i < zeilen.length; i += 2) ergebnis.push([Number(zeilen[i]), zeilen[i + 1]!]);
  return ergebnis;
}

const linie = [
  { x: 0, y: 0 },
  { x: 10, y: 5 },
];

describe('dxfZahl', () => {
  it('nutzt den Punkt und rundet auf 4 Stellen', () => {
    expect(dxfZahl(1.5)).toBe('1.5');
    expect(dxfZahl(1 / 3)).toBe('0.3333');
    expect(dxfZahl(-0.00001)).toBe('0');
    expect(dxfZahl(304.8)).toBe('304.8');
  });
});

describe('istGeschlossen', () => {
  it('erkennt geschlossene und offene Pfade', () => {
    expect(istGeschlossen(rechteck(0, 0, 1, 1))).toBe(true);
    expect(istGeschlossen(linie)).toBe(false);
  });
});

describe('polylinienZuDxf', () => {
  it('erzeugt eine vollständige R12-Datei in mm', () => {
    const p = paare(polylinienZuDxf([linie]));
    expect(p.slice(0, 4)).toEqual([
      [0, 'SECTION'],
      [2, 'HEADER'],
      [9, '$ACADVER'],
      [1, 'AC1009'],
    ]);
    expect(p).toContainEqual([9, '$INSUNITS']);
    expect(p.at(-1)).toEqual([0, 'EOF']);
  });

  it('spiegelt y, damit die Zeichnung nicht auf dem Kopf steht', () => {
    const p = paare(polylinienZuDxf([linie], { hoeheMm: 20 }));
    // Koordinaten nach dem ersten VERTEX (davor steht der Platzhalter der POLYLINE)
    const ersterVertex = p.findIndex(([c, w]) => c === 0 && w === 'VERTEX');
    const koordinaten = p.slice(ersterVertex).filter(([c]) => c === 10 || c === 20);
    expect(koordinaten.map(([, w]) => w)).toEqual(['0', '20', '10', '15']);
  });

  it('markiert geschlossene Pfade und lässt den doppelten Endpunkt weg', () => {
    const p = paare(polylinienZuDxf([rechteck(0, 0, 10, 10)]));
    const start = p.findIndex(([c, w]) => c === 0 && w === 'POLYLINE');
    expect(p.slice(start).find(([c]) => c === 70)).toEqual([70, '1']);
    expect(p.filter(([c, w]) => c === 0 && w === 'VERTEX')).toHaveLength(4);
  });

  it('kann jedes Teilstück als LINE schreiben', () => {
    const dxf = polylinienZuDxf([rechteck(0, 0, 10, 10)], { variante: 'linien' });
    const p = paare(dxf);
    expect(p.filter(([c, w]) => c === 0 && w === 'LINE')).toHaveLength(4);
    expect(p.some(([, w]) => w === 'POLYLINE')).toBe(false);
  });

  it('überspringt Pfade mit weniger als zwei Punkten', () => {
    const p = paare(polylinienZuDxf([[{ x: 1, y: 1 }], []]));
    expect(p.some(([, w]) => w === 'POLYLINE')).toBe(false);
  });

  it('kleines Beispiel als Schnappschuss', () => {
    expect(polylinienZuDxf([linie], { hoeheMm: 5 }).split('\r\n')).toMatchInlineSnapshot(`
      [
        "0",
        "SECTION",
        "2",
        "HEADER",
        "9",
        "$ACADVER",
        "1",
        "AC1009",
        "9",
        "$INSUNITS",
        "70",
        "4",
        "9",
        "$MEASUREMENT",
        "70",
        "1",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        "0",
        "POLYLINE",
        "8",
        "0",
        "66",
        "1",
        "10",
        "0",
        "20",
        "0",
        "30",
        "0",
        "70",
        "0",
        "0",
        "VERTEX",
        "8",
        "0",
        "10",
        "0",
        "20",
        "5",
        "0",
        "VERTEX",
        "8",
        "0",
        "10",
        "10",
        "20",
        "0",
        "0",
        "SEQEND",
        "8",
        "0",
        "0",
        "ENDSEC",
        "0",
        "EOF",
        "",
      ]
    `);
  });
});

describe('testformen', () => {
  it('liegen alle in 200 × 70 mm', () => {
    for (const p of testformen().flatMap((f) => f.pfade).flat()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(70);
    }
  });
});
