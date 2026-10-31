/**
 * Das Attribut transform: Verschieben, Drehen, Skalieren, Scheren.
 *
 * Jede Transformation lässt sich als Matrix schreiben (affine Abbildung):
 *
 *     ⎛x'⎞   ⎛a c e⎞ ⎛x⎞
 *     ⎜y'⎟ = ⎜b d f⎟ ⎜y⎟        also  x' = a·x + c·y + e,   y' = b·x + d·y + f
 *     ⎝1 ⎠   ⎝0 0 1⎠ ⎝1⎠
 *
 * Mehrere Transformationen nacheinander ergeben das Produkt ihrer Matrizen.
 * In „translate(10 0) rotate(45)“ wird zuerst gedreht, dann verschoben – die rechte
 * Transformation wirkt zuerst auf den Punkt. Bei verschachtelten Gruppen <g> gilt
 * dasselbe: Die Matrix der äußeren Gruppe steht links.
 */
import type { Punkt } from '../cutter/types';

export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const EINHEITSMATRIX: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Produkt m · n: Erst wirkt n, dann m. */
export function mal(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function wende(m: Matrix, p: Punkt): Punkt {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** Umkehrmatrix, z. B. um einen Mausklick in die Koordinaten eines Elements umzurechnen. */
export function invertiere(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return EINHEITSMATRIX;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

/** Größter Streckfaktor der Matrix (für Toleranzen beim Zerlegen von Kurven). */
export function massstab(m: Matrix): number {
  return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) || 1;
}

export function istEinheit(m: Matrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

/** Liest ein transform-Attribut. Unbekanntes wird als Fehler gemeldet, der Rest gilt trotzdem. */
export function leseTransform(text: string): { matrix: Matrix; fehler?: string } {
  let ergebnis = EINHEITSMATRIX;
  let fehler: string | undefined;
  const muster = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let gelesen = '';
  while ((m = muster.exec(text)) !== null) {
    gelesen += m[0];
    const name = m[1]!;
    const w = m[2]!.trim() === '' ? [] : m[2]!.trim().split(/[\s,]+/).map(Number);
    if (w.some((x) => !Number.isFinite(x))) {
      fehler = `Ungültige Zahl in ${name}(…).`;
      continue;
    }
    const rad = (grad: number) => (grad * Math.PI) / 180;
    let t: Matrix | null = null;
    switch (name) {
      case 'translate':
        t = { ...EINHEITSMATRIX, e: w[0] ?? 0, f: w[1] ?? 0 };
        break;
      case 'scale':
        t = { ...EINHEITSMATRIX, a: w[0] ?? 1, d: w[1] ?? w[0] ?? 1 };
        break;
      case 'rotate': {
        const cos = Math.cos(rad(w[0] ?? 0));
        const sin = Math.sin(rad(w[0] ?? 0));
        const drehung = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        if (w.length >= 3) {
          // Drehen um (cx | cy): hinschieben, drehen, zurückschieben
          const cx = w[1]!;
          const cy = w[2]!;
          t = mal(mal({ ...EINHEITSMATRIX, e: cx, f: cy }, drehung), { ...EINHEITSMATRIX, e: -cx, f: -cy });
        } else t = drehung;
        break;
      }
      case 'skewX':
        t = { ...EINHEITSMATRIX, c: Math.tan(rad(w[0] ?? 0)) };
        break;
      case 'skewY':
        t = { ...EINHEITSMATRIX, b: Math.tan(rad(w[0] ?? 0)) };
        break;
      case 'matrix':
        if (w.length === 6) t = { a: w[0]!, b: w[1]!, c: w[2]!, d: w[3]!, e: w[4]!, f: w[5]! };
        else fehler = 'matrix(…) braucht 6 Zahlen.';
        break;
      default:
        fehler = `Unbekannte Transformation „${name}“.`;
    }
    if (t) ergebnis = mal(ergebnis, t);
  }
  if (!fehler && text.replace(/[\s,]/g, '') !== gelesen.replace(/[\s,]/g, '')) fehler = 'transform enthält unlesbaren Text.';
  return { matrix: ergebnis, fehler };
}
