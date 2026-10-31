import { describe, expect, it } from 'vitest';
import { invertiere, leseTransform, mal, wende } from './transform';

const nah = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

describe('transform', () => {
  it('verschiebt, skaliert und dreht', () => {
    nah(wende(leseTransform('translate(10, 5)').matrix, { x: 1, y: 1 }), 11, 6);
    nah(wende(leseTransform('scale(2)').matrix, { x: 3, y: 4 }), 6, 8);
    // y zeigt nach unten: 90° dreht (1|0) nach (0|1), also im Uhrzeigersinn auf dem Bildschirm
    nah(wende(leseTransform('rotate(90)').matrix, { x: 1, y: 0 }), 0, 1);
    nah(wende(leseTransform('rotate(180 5 5)').matrix, { x: 0, y: 0 }), 10, 10);
  });

  it('die rechte Transformation wirkt zuerst', () => {
    // erst drehen, dann verschieben
    nah(wende(leseTransform('translate(10 0) rotate(90)').matrix, { x: 1, y: 0 }), 10, 1);
    // erst verschieben, dann drehen
    nah(wende(leseTransform('rotate(90) translate(10 0)').matrix, { x: 1, y: 0 }), 0, 11);
  });

  it('die Umkehrmatrix macht alles rückgängig', () => {
    const m = leseTransform('translate(3 4) rotate(30) scale(2 0.5) skewX(10)').matrix;
    nah(wende(mal(invertiere(m), m), { x: 7, y: -2 }), 7, -2);
  });

  it('meldet Fehler, wendet den Rest aber an', () => {
    const r = leseTransform('translate(5) wobble(3)');
    expect(r.fehler).toMatch(/Unbekannte Transformation/);
    nah(wende(r.matrix, { x: 0, y: 0 }), 5, 0);
    expect(leseTransform('matrix(1 0 0)').fehler).toMatch(/6 Zahlen/);
  });
});
