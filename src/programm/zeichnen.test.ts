import { describe, expect, it } from 'vitest';
import { pruefe } from '../checks/cutter-checks';
import { programme } from '../i18n/programme.de';
import { leseSvg } from '../svg/dokument';
import { fuehreAus, MAX_FORMEN } from './zeichnen';

describe('SVG per Programm', () => {
  it('erzeugt ein SVG in mm aus Funktionsaufrufen', () => {
    const r = fuehreAus('papier(80, 40);\nrechteck(10, 10, 20, 10);\nkreis(60, 20, 8, { fuellung: "black" });');
    expect(r.fehler).toBeUndefined();
    expect(r.formen).toBe(2);
    expect(r.svg).toContain('width="80mm" height="40mm" viewBox="0 0 80 40"');
    expect(r.svg).toContain('<circle cx="60" cy="20" r="8" fill="black" stroke="black"/>');
    const dok = leseSvg(r.svg);
    expect(dok.hinweise.filter((h) => h.art === 'fehler')).toEqual([]);
    expect(dok.pfade).toHaveLength(2);
  });

  it('Schleifen und Mathematik', () => {
    const r = fuehreAus('for (let i = 0; i < 5; i++) kreis(10 + i * 20, 20, 5);\nausgabe("fertig", 5);');
    expect(r.formen).toBe(5);
    expect(r.ausgaben).toEqual(['fertig 5']);
  });

  it('console.log landet in der Ausgabe', () => {
    expect(fuehreAus('console.log("hallo", [1, 2])').ausgaben).toEqual(['hallo [1,2]']);
  });

  it('verständliche Fehler bei falschen Werten', () => {
    expect(fuehreAus('kreis(10, 10, -3)').fehler?.text).toMatch(/Radius r muss größer als 0/);
    expect(fuehreAus('rechteck(10, "zehn", 5, 5)').fehler?.text).toMatch(/2\. Wert ist keine Zahl/);
    expect(fuehreAus('vieleck([[0, 0]])').fehler?.text).toMatch(/mindestens zwei Punkten/);
  });

  it('JavaScript-Fehler werden gemeldet; was davor gezeichnet wurde, bleibt', () => {
    const r = fuehreAus('kreis(10, 10, 5);\nkreiss(20, 20, 5);');
    expect(r.fehler?.text).toMatch(/ReferenceError: kreiss is not defined/);
    expect(r.formen).toBe(1);
  });

  it('begrenzt die Zahl der Formen', () => {
    expect(fuehreAus(`for (let i = 0; i < ${MAX_FORMEN + 10}; i++) kreis(1, 1, 1);`).fehler?.text).toMatch(/Zu viele Formen/);
  });

  it('Anführungszeichen werden entfernt: Es lässt sich kein zusätzliches Attribut einschleusen', () => {
    const r = fuehreAus('pfad(\'M 0 0 L 10 10" onload="x\');');
    const pfad = leseSvg(r.svg).elemente.find((e) => e.name === 'path')!;
    expect(pfad.attribute.map((a) => a.name)).toEqual(['d', 'fill', 'stroke']);
  });

  it('alle Vorlagen laufen fehlerfrei und erzeugen schneidbare Formen', () => {
    for (const v of programme) {
      const r = fuehreAus(v.code);
      expect(r.fehler, v.id).toBeUndefined();
      const dok = leseSvg(r.svg);
      expect(dok.hinweise.filter((h) => h.art === 'fehler'), v.id).toEqual([]);
      const ausserhalb = pruefe(dok, { bereich: { breite: 304.8, hoehe: 304.8 } }).find((b) => b.id === 'ausserhalbDokument')!;
      expect(ausserhalb.anzahl, v.id).toBe(0);
    }
  });
});
