import { describe, expect, it } from 'vitest';
import { leseSvg } from '../svg/dokument';
import { pruefe, type Befund, type PruefId } from './cutter-checks';

const BEREICH = { breite: 304.8, hoehe: 304.8 };
const pruefeSvg = (inhalt: string, kopf = 'width="100mm" height="100mm" viewBox="0 0 100 100"') =>
  pruefe(leseSvg(`<svg ${kopf}>${inhalt}</svg>`), { bereich: BEREICH });
const finde = (b: Befund[], id: PruefId) => b.find((x) => x.id === id)!;

describe('Cutter-Checks', () => {
  it('leeres Dokument', () => {
    expect(pruefeSvg('')).toEqual([expect.objectContaining({ id: 'leer', stufe: 'warnung' })]);
  });

  it('Füllungen werden als Hinweis gemeldet', () => {
    const b = pruefeSvg('<rect width="10" height="10"/><rect width="10" height="10" fill="none" stroke="red"/>');
    expect(finde(b, 'fuellung')).toMatchObject({ anzahl: 1, stufe: 'info', pfade: [0] });
  });

  it('offene Pfade: Warnung nur bei gefüllten Formen', () => {
    const linie = pruefeSvg('<path d="M 10 10 L 50 10" fill="none" stroke="black"/>');
    expect(finde(linie, 'offen')).toMatchObject({ anzahl: 1, stufe: 'info' });
    const form = pruefeSvg('<path d="M 10 10 L 50 10 L 50 50"/>');
    expect(finde(form, 'offen')).toMatchObject({ anzahl: 1, stufe: 'warnung' });
    expect(finde(form, 'offen').stellen).toHaveLength(2); // Anfang und Ende
  });

  it('fast geschlossene Pfade mit kleiner Lücke', () => {
    const b = pruefeSvg('<path d="M 10 10 L 50 10 L 50 50 L 10.3 10"/>');
    expect(finde(b, 'fastGeschlossen')).toMatchObject({ anzahl: 1, stufe: 'warnung' });
    expect(finde(b, 'fastGeschlossen').wert).toBeCloseTo(0.3);
    expect(finde(b, 'offen').anzahl).toBe(0);
    // Ende genau am Anfang, ohne Z: für den Cutter geschlossen
    expect(finde(pruefeSvg('<path d="M 10 10 L 50 10 L 10 10"/>'), 'fastGeschlossen').anzahl).toBe(0);
  });

  it('Löcher und Inseln: das Innere eines „O“', () => {
    const b = pruefeSvg('<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="15"/><circle cx="50" cy="50" r="5"/>');
    // Kreis 15 liegt in Kreis 30 (Tiefe 1 = Loch), Kreis 5 in beiden (Tiefe 2 = wieder Form)
    expect(finde(b, 'loecher')).toMatchObject({ anzahl: 1, pfade: [1] });
    expect(finde(b, 'inseln').anzahl).toBe(1);
  });

  it('doppelte Teilstücke, auch in Gegenrichtung', () => {
    const b = pruefeSvg('<rect x="10" y="10" width="20" height="20"/><path d="M 30 30 L 30 10"/>');
    expect(finde(b, 'doppelt')).toMatchObject({ anzahl: 1, stufe: 'warnung', pfade: [1] });
  });

  it('winzige Teilstücke, gemessen in mm nach viewBox und transform', () => {
    const b = pruefeSvg('<path d="M 10 10 L 10.05 10 L 50 50 Z"/>');
    expect(finde(b, 'winzig').anzahl).toBe(1);
    // 1 Einheit = 0,25 mm und scale(0.1): 0,5 Einheiten → 0,0125 mm
    const klein = pruefeSvg('<g transform="scale(0.1)"><path d="M 0 0 L 0.5 0 L 300 300 Z"/></g>', 'width="100mm" height="100mm" viewBox="0 0 400 400"');
    expect(finde(klein, 'winzig').anzahl).toBe(1);
    // Kurven werden nicht als viele winzige Stücke gezählt
    expect(finde(pruefeSvg('<circle cx="50" cy="50" r="20"/>'), 'winzig').anzahl).toBe(0);
  });

  it('außerhalb der Matte und des Dokuments', () => {
    const b = pruefeSvg('<rect x="-5" y="10" width="20" height="20"/><rect x="290" y="10" width="20" height="20"/>');
    expect(finde(b, 'ausserhalbMatte')).toMatchObject({ anzahl: 2, stufe: 'warnung' });
    expect(finde(b, 'ausserhalbDokument')).toMatchObject({ anzahl: 2, stufe: 'info' });
  });

  it('ein sauberes Dokument hat nur grüne Befunde – bis auf den Hinweis zur Füllung', () => {
    const b = pruefeSvg('<rect x="10" y="10" width="20" height="20" fill="none" stroke="black"/>');
    expect(b.filter((x) => x.stufe !== 'ok')).toEqual([]);
  });
});
