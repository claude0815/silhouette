import { describe, expect, it } from 'vitest';
import { svgZuDxf } from './aus-svg';

describe('svgZuDxf', () => {
  it('exportiert die Pfade des SVG-Dokuments in mm, y gespiegelt an der Dokumenthöhe', () => {
    const { dxf, hinweise } = svgZuDxf(
      '<svg width="40mm" height="20mm" viewBox="0 0 4 2"><path d="M 0 0 L 4 0 L 4 2 Z"/></svg>',
    );
    expect(hinweise).toEqual([]);
    // DXF immer paarweise lesen (Gruppencode, Wert): Ein y-Wert „20“ sieht sonst aus wie der Code 20.
    const zeilen = dxf.split('\r\n');
    const paare: Array<[string, string]> = [];
    for (let i = 0; i + 1 < zeilen.length; i += 2) paare.push([zeilen[i]!, zeilen[i + 1]!]);
    const abVertex = paare.slice(paare.findIndex(([c, w]) => c === '0' && w === 'VERTEX'));
    const koordinaten = abVertex.filter(([c]) => c === '10' || c === '20').map(([, w]) => w);
    // (0|0) → (0|20), (40|0) → (40|20), (40|20) → (40|0); der Schlusspunkt entfällt (geschlossen)
    expect(koordinaten).toEqual(['0', '20', '40', '20', '40', '0']);
  });
});
