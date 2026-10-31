import { describe, expect, it } from 'vitest';
import { formAnPunkt, imVieleck } from './geometrie';

const quadrat = (a: number, b: number) => [
  { x: a, y: a },
  { x: b, y: a },
  { x: b, y: b },
  { x: a, y: b },
];

describe('Geometrie', () => {
  it('Punkt im Vieleck', () => {
    expect(imVieleck({ x: 5, y: 5 }, quadrat(0, 10))).toBe(true);
    expect(imVieleck({ x: 15, y: 5 }, quadrat(0, 10))).toBe(false);
  });

  it('Form an einem Punkt, Löcher zählen nicht dazu', () => {
    const formen = [{ aussen: quadrat(0, 10), loecher: [quadrat(3, 7)] }];
    expect(formAnPunkt(formen, { x: 1, y: 1 })).toBe(0);
    expect(formAnPunkt(formen, { x: 5, y: 5 })).toBeNull();
    expect(formAnPunkt(formen, { x: 20, y: 20 })).toBeNull();
  });
});
