import { describe, expect, it } from 'vitest';
import { leseSvg } from './dokument';
import { einpassen, motivRahmen, setzeGroesseUndLage } from './groesse';

const nah = (a: number, b: number) => expect(a).toBeCloseTo(b, 2);

describe('setzeGroesseUndLage', () => {
  const text = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">\n  <rect x="10" y="20" width="40" height="20"/>\n</svg>';
  const dok = leseSvg(text);

  it('kennt den Rahmen des Motivs', () => {
    expect(motivRahmen(dok)).toEqual({ x: 10, y: 20, breite: 40, hoehe: 20 });
  });

  it('verdoppelt das Motiv und legt es an die gewünschte Stelle; die Pfade bleiben gleich', () => {
    const neu = setzeGroesseUndLage(text, dok, { x: 5, y: 5, breite: 80 })!;
    expect(neu).toContain('<rect x="10" y="20" width="40" height="20"/>');
    const r = motivRahmen(leseSvg(neu))!;
    nah(r.x, 5);
    nah(r.y, 5);
    nah(r.breite, 80);
    nah(r.hoehe, 40);
    const d = leseSvg(neu);
    // Rand rechts (50 mm) und unten (20 mm) bleibt erhalten
    nah(d.breiteMm, 5 + 80 + 50);
    nah(d.hoeheMm, 5 + 40 + 20);
    expect(d.hinweise.filter((h) => h.art === 'fehler')).toEqual([]);
  });

  it('verkleinert auch Dokumente mit anderer Einheit und verschobener viewBox', () => {
    const t2 = '<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="2in" viewBox="-50 -50 400 200"><circle cx="0" cy="0" r="50"/></svg>';
    const d = leseSvg(t2);
    const vorher = motivRahmen(d)!;
    const neu = setzeGroesseUndLage(t2, d, { x: 0, y: 0, breite: vorher.breite / 2 })!;
    const r = motivRahmen(leseSvg(neu))!;
    nah(r.x, 0);
    nah(r.y, 0);
    nah(r.breite, vorher.breite / 2);
    nah(r.hoehe, vorher.hoehe / 2);
  });

  it('ergänzt eine fehlende viewBox', () => {
    const t3 = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect x="0" y="0" width="96" height="48"/></svg>';
    const neu = setzeGroesseUndLage(t3, leseSvg(t3), { x: 10, y: 10, breite: 50 })!;
    expect(neu).toContain('viewBox=');
    const r = motivRahmen(leseSvg(neu))!;
    nah(r.breite, 50);
    nah(r.hoehe, 25);
    nah(r.x, 10);
  });

  it('beachtet Gruppen mit transform', () => {
    const t4 = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><g transform="translate(30 30) scale(2)"><rect width="10" height="5"/></g></svg>';
    const neu = setzeGroesseUndLage(t4, leseSvg(t4), { x: 0, y: 0, breite: 60 })!;
    const r = motivRahmen(leseSvg(neu))!;
    nah(r.x, 0);
    nah(r.breite, 60);
    nah(r.hoehe, 30);
  });

  it('liefert null ohne Formen', () => {
    const leer = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"></svg>';
    expect(setzeGroesseUndLage(leer, leseSvg(leer), { x: 0, y: 0, breite: 5 })).toBeNull();
  });
});

describe('einpassen', () => {
  it('nutzt die knappere Richtung und lässt den Rand frei', () => {
    expect(einpassen({ x: 3, y: 3, breite: 40, hoehe: 20 }, { breite: 300, hoehe: 100 }, 10)).toEqual({ x: 10, y: 10, breite: 160 });
  });
});
