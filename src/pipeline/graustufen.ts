/**
 * Schritt 2: Farbe in Helligkeit umrechnen.
 *
 * Jedes Pixel hat drei Farbwerte R (rot), G (grün) und B (blau) von 0 bis 255.
 * Daraus wird ein einziger Helligkeitswert (Grauwert) von 0 bis 255.
 */
import type { Farbbild, Graubild } from './bilder';

export type GrauVerfahren = 'mittelwert' | 'luminanz';

/**
 * Gewichte der Luminanz nach ITU-R BT.601 (Fernsehnorm, auch in vielen Bildprogrammen):
 * Das Auge empfindet Grün am hellsten und Blau am dunkelsten.
 * Die drei Gewichte ergeben zusammen 1.
 */
export const LUMINANZ = { r: 0.299, g: 0.587, b: 0.114 } as const;

/** Die Formel als Text, für die Anzeige in der Oberfläche. */
export function formel(verfahren: GrauVerfahren): string {
  return verfahren === 'mittelwert'
    ? 'Grau = (R + G + B) / 3'
    : `Grau = ${LUMINANZ.r} · R + ${LUMINANZ.g} · G + ${LUMINANZ.b} · B`;
}

/** Grauwert eines einzelnen Pixels. */
export function grauwert(r: number, g: number, b: number, verfahren: GrauVerfahren): number {
  const wert = verfahren === 'mittelwert' ? (r + g + b) / 3 : LUMINANZ.r * r + LUMINANZ.g * g + LUMINANZ.b * b;
  return Math.round(wert);
}

/**
 * Wandelt ein Farbbild in ein Graubild um.
 *
 * Durchsichtige Pixel (Alpha < 255) werden so behandelt, als lägen sie auf weißem Papier:
 * Ein ganz durchsichtiges Pixel wird weiß, also Hintergrund. Das passt zu PNG-Logos
 * mit transparentem Hintergrund.
 */
export function zuGraustufen(bild: Farbbild, verfahren: GrauVerfahren = 'luminanz'): Graubild {
  const { breite, hoehe, daten } = bild;
  const grau = new Uint8Array(breite * hoehe);
  for (let i = 0; i < grau.length; i++) {
    const r = daten[4 * i]!;
    const g = daten[4 * i + 1]!;
    const b = daten[4 * i + 2]!;
    const a = daten[4 * i + 3]! / 255;
    const wert = grauwert(r, g, b, verfahren);
    // Mischen mit Weiß (255) im Verhältnis der Deckkraft
    grau[i] = Math.round(a * wert + (1 - a) * 255);
  }
  return { breite, hoehe, daten: grau };
}
