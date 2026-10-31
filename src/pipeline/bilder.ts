/**
 * Datentypen für die Bildverarbeitung.
 *
 * Ein Rasterbild ist eine Tabelle von Pixeln, Zeile für Zeile hintereinander gespeichert:
 * Das Pixel in Spalte x und Zeile y steht an der Stelle  index = y · breite + x.
 * Die Zählung beginnt oben links bei (0 | 0), y wächst nach unten – wie in SVG.
 */

/** Farbbild wie aus einem Canvas: je Pixel vier Werte R, G, B, A von 0 bis 255. */
export interface Farbbild {
  breite: number;
  hoehe: number;
  /** Länge 4 · breite · hoehe */
  daten: Uint8ClampedArray;
}

/** Graustufenbild: je Pixel ein Helligkeitswert von 0 (schwarz) bis 255 (weiß). */
export interface Graubild {
  breite: number;
  hoehe: number;
  /** Länge breite · hoehe */
  daten: Uint8Array;
}

/**
 * Binärbild (Schwarz-Weiß): je Pixel 0 oder 1.
 * 1 = Vordergrund, also das, was ausgeschnitten wird (meist die dunklen Stellen).
 * 0 = Hintergrund.
 */
export interface Binaerbild {
  breite: number;
  hoehe: number;
  /** Länge breite · hoehe, nur Werte 0 und 1 */
  daten: Uint8Array;
}

/** Ein Punkt in Pixelkoordinaten (Kommazahlen erlaubt). */
export interface Punkt {
  x: number;
  y: number;
}

/** Legt ein Binärbild aus Textzeilen an, z. B. ['.#.', '###'] – praktisch für Tests und Arbeitsblätter. */
export function binaerAusText(zeilen: readonly string[]): Binaerbild {
  const hoehe = zeilen.length;
  const breite = zeilen[0]?.length ?? 0;
  const daten = new Uint8Array(breite * hoehe);
  zeilen.forEach((zeile, y) => {
    if (zeile.length !== breite) throw new Error(`Zeile ${y} hat ${zeile.length} statt ${breite} Zeichen.`);
    for (let x = 0; x < breite; x++) daten[y * breite + x] = zeile[x] === '#' ? 1 : 0;
  });
  return { breite, hoehe, daten };
}

/** Gegenstück zu binaerAusText: '#' für 1, '.' für 0. */
export function binaerAlsText(bild: Binaerbild): string[] {
  const zeilen: string[] = [];
  for (let y = 0; y < bild.hoehe; y++) {
    let z = '';
    for (let x = 0; x < bild.breite; x++) z += bild.daten[y * bild.breite + x] ? '#' : '.';
    zeilen.push(z);
  }
  return zeilen;
}

/** Ein Rechteck in Pixeln (ganze Zahlen). */
export interface Rechteck {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Begrenzt ein Rechteck auf das Bild und rundet auf ganze Pixel; mindestens 1 × 1. */
export function begrenzeRechteck(r: Rechteck, breite: number, hoehe: number): Rechteck {
  const x0 = Math.max(0, Math.min(breite - 1, Math.round(Math.min(r.x, r.x + r.breite))));
  const y0 = Math.max(0, Math.min(hoehe - 1, Math.round(Math.min(r.y, r.y + r.hoehe))));
  const x1 = Math.max(x0 + 1, Math.min(breite, Math.round(Math.max(r.x, r.x + r.breite))));
  const y1 = Math.max(y0 + 1, Math.min(hoehe, Math.round(Math.max(r.y, r.y + r.hoehe))));
  return { x: x0, y: y0, breite: x1 - x0, hoehe: y1 - y0 };
}

/**
 * Zuschnitt: Schneidet einen rechteckigen Ausschnitt aus einem Farbbild.
 * Zeile für Zeile wird der passende Teil der Pixeltabelle kopiert.
 */
export function schneideZu(bild: Farbbild, r: Rechteck): Farbbild {
  const { x, y, breite, hoehe } = begrenzeRechteck(r, bild.breite, bild.hoehe);
  const daten = new Uint8ClampedArray(breite * hoehe * 4);
  for (let zeile = 0; zeile < hoehe; zeile++) {
    const von = ((y + zeile) * bild.breite + x) * 4;
    daten.set(bild.daten.subarray(von, von + breite * 4), zeile * breite * 4);
  }
  return { breite, hoehe, daten };
}
