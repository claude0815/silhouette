import { describe, expect, it } from 'vitest';
import { de } from './de';

describe('Texte', () => {
  it('enthält keine leeren Einträge', () => {
    const leer: string[] = [];
    const pruefe = (obj: object, pfad: string) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          if (v.trim() === '') leer.push(`${pfad}${k}`);
        } else pruefe(v as object, `${pfad}${k}.`);
      }
    };
    pruefe(de, '');
    expect(leer).toEqual([]);
  });
});
