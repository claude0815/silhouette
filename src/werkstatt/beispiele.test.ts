import { describe, expect, it } from 'vitest';
import { leseSvg } from '../svg/dokument';
import { beispiele } from './beispiele';

describe('Beispiele und Aufgaben', () => {
  it('jedes Beispiel lässt sich fehlerfrei lesen', () => {
    for (const b of beispiele) {
      const dok = leseSvg(b.svg);
      expect(dok.hinweise.filter((h) => h.art === 'fehler'), b.id).toEqual([]);
      expect(dok.pfade.length, b.id).toBeGreaterThan(0);
    }
  });

  for (const b of beispiele) {
    for (const a of b.aufgaben) {
      it(`${b.id}/${a.id}: hat Prüfung und Lösung; ungelöst am Anfang, gelöst mit der Lösung`, () => {
        expect(a.pruefe, 'Prüfung fehlt').toBeDefined();
        expect(a.loesung, 'Lösung fehlt').toBeDefined();
        expect(a.pruefe!(leseSvg(b.svg))).toBe(false);
        const loesung = leseSvg(a.loesung!);
        expect(loesung.hinweise.filter((h) => h.art === 'fehler')).toEqual([]);
        expect(a.pruefe!(loesung)).toBe(true);
      });
    }
  }

  it('die ids sind eindeutig', () => {
    const ids = beispiele.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
