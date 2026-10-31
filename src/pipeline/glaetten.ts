/**
 * Schritt 7: Glätten mit kubischen Bézier-Kurven.
 *
 * Eine kubische Bézier-Kurve verbindet zwei Punkte P0 und P3 und wird von zwei
 * Kontrollpunkten C1 und C2 „gezogen“. Sie beginnt in Richtung C1 und kommt aus
 * Richtung C2 an, geht aber in der Regel nicht durch die Kontrollpunkte:
 *
 *     B(t) = (1−t)³·P0 + 3(1−t)²t·C1 + 3(1−t)t²·C2 + t³·P3,   t von 0 bis 1
 *
 * In SVG ist das der Pfadbefehl  C c1x,c1y c2x,c2y p3x,p3y.
 *
 * Wie werden die Kontrollpunkte gewählt? An jedem Punkt P_i soll die Kurve ohne Knick
 * weiterlaufen. Dafür nehmen wir als Richtung (Tangente) die Richtung vom Vorgänger
 * zum Nachfolger: P_{i+1} − P_{i−1} (wie bei Catmull-Rom-Splines). Die Kontrollpunkte
 * liegen auf dieser Tangente, und zwar ein Drittel der jeweiligen Kantenlänge entfernt,
 * mal der Glättungsstärke. So schwingt die Kurve auch bei ungleich langen Kanten
 * nicht über.
 *
 * Echte Ecken sollen spitz bleiben (sonst wird ein „L“ rund). Knickt die Kontur an einem
 * Punkt stärker als `eckenWinkel`, bekommt er keine Tangente: Die Kontrollpunkte liegen
 * dann auf dem Punkt selbst, und die Kurve kommt spitz an.
 */
import type { Punkt } from './bilder';

export interface BezierSegment {
  c1: Punkt;
  c2: Punkt;
  /** Endpunkt; der Anfangspunkt ist der Endpunkt des vorigen Segments. */
  p: Punkt;
}

/** Geschlossener Pfad aus Bézier-Segmenten. */
export interface Bezierpfad {
  start: Punkt;
  segmente: BezierSegment[];
}

export interface GlaettOptionen {
  /** 0 = gerade Linien, 1 = volle Glättung. */
  staerke: number;
  /** Knickwinkel in Grad, ab dem ein Punkt als Ecke gilt. */
  eckenWinkel: number;
}

export const STANDARD_GLAETTUNG: GlaettOptionen = { staerke: 1, eckenWinkel: 70 };

const minus = (a: Punkt, b: Punkt): Punkt => ({ x: a.x - b.x, y: a.y - b.y });
const laenge = (v: Punkt) => Math.hypot(v.x, v.y);

/** Knickwinkel in Grad am Punkt b zwischen den Kanten a→b und b→c (0 = geradeaus). */
export function knickwinkel(a: Punkt, b: Punkt, c: Punkt): number {
  const u = minus(b, a);
  const v = minus(c, b);
  const lu = laenge(u);
  const lv = laenge(v);
  if (lu === 0 || lv === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Glättet eine geschlossene Kontur (letzter Punkt nicht wiederholt) zu einem Bézier-Pfad. */
export function glaette(punkte: readonly Punkt[], optionen: GlaettOptionen = STANDARD_GLAETTUNG): Bezierpfad {
  const n = punkte.length;
  const p = (i: number) => punkte[((i % n) + n) % n]!;

  // Einheitstangente je Punkt; an Ecken (0 | 0)
  const tangenten = punkte.map((_, i) => {
    if (knickwinkel(p(i - 1), p(i), p(i + 1)) > optionen.eckenWinkel) return { x: 0, y: 0 };
    const t = minus(p(i + 1), p(i - 1));
    const l = laenge(t);
    return l === 0 ? { x: 0, y: 0 } : { x: t.x / l, y: t.y / l };
  });

  const k = optionen.staerke / 3;
  const segmente: BezierSegment[] = [];
  for (let i = 0; i < n; i++) {
    const a = p(i);
    const b = p(i + 1);
    const arm = laenge(minus(b, a)) * k;
    const ta = tangenten[i]!;
    const tb = tangenten[(i + 1) % n]!;
    segmente.push({
      c1: { x: a.x + ta.x * arm, y: a.y + ta.y * arm },
      c2: { x: b.x - tb.x * arm, y: b.y - tb.y * arm },
      p: b,
    });
  }
  return { start: p(0), segmente };
}

/** Punkt auf einer kubischen Bézier-Kurve für t von 0 bis 1 (Formel oben). */
export function bezierPunkt(p0: Punkt, c1: Punkt, c2: Punkt, p3: Punkt, t: number): Punkt {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y };
}

/** Ist das Segment eigentlich eine gerade Linie (Kontrollpunkte auf den Endpunkten)? */
export function istGerade(von: Punkt, s: BezierSegment): boolean {
  const gleich = (a: Punkt, b: Punkt) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  return gleich(von, s.c1) && gleich(s.p, s.c2);
}
