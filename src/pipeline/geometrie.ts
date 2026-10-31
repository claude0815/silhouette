/** Kleine Geometrie-Hilfen für die Oberfläche. */
import type { Punkt } from './bilder';

/**
 * Liegt p im Vieleck? Strahlverfahren: Von p aus nach rechts schauen und zählen,
 * wie oft man eine Kante kreuzt. Ungerade = innen. (Dasselbe Prinzip wie fill-rule="evenodd".)
 */
export function imVieleck(p: Punkt, vieleck: readonly Punkt[]): boolean {
  let innen = false;
  for (let i = 0, j = vieleck.length - 1; i < vieleck.length; j = i++) {
    const a = vieleck[i]!;
    const b = vieleck[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) innen = !innen;
  }
  return innen;
}

/** Index der Form, in deren Fläche p liegt (innerhalb der Außenkontur, nicht in einem Loch). */
export function formAnPunkt(formen: readonly { aussen: Punkt[]; loecher: Punkt[][] }[], p: Punkt): number | null {
  for (let i = formen.length - 1; i >= 0; i--) {
    const f = formen[i]!;
    if (imVieleck(p, f.aussen) && !f.loecher.some((l) => imVieleck(p, l))) return i;
  }
  return null;
}
