/**
 * Schritt 3: Binarisierung – aus Grau wird Schwarz-Weiß.
 *
 * Jedes Pixel wird mit einem Schwellwert verglichen: dunkler → Vordergrund (1),
 * sonst Hintergrund (0). Das Histogramm zeigt, wie viele Pixel welche Helligkeit haben;
 * ein guter Schwellwert liegt im „Tal“ zwischen den Bergen für dunkle und helle Pixel.
 */
import type { Binaerbild, Graubild } from './bilder';

/** Zählt für jeden Grauwert 0 … 255, wie viele Pixel ihn haben. */
export function histogramm(bild: Graubild): Uint32Array {
  const h = new Uint32Array(256);
  const d = bild.daten;
  for (let i = 0; i < d.length; i++) h[d[i]!]!++;
  return h;
}

/**
 * Pixel mit Grauwert kleiner als `schwelle` werden zu 1 (Vordergrund).
 * `invertieren` dreht das um, z. B. für helle Schrift auf dunklem Grund.
 */
export function binarisiere(bild: Graubild, schwelle: number, invertieren = false): Binaerbild {
  const daten = new Uint8Array(bild.daten.length);
  for (let i = 0; i < daten.length; i++) {
    const dunkel = bild.daten[i]! < schwelle;
    daten[i] = dunkel !== invertieren ? 1 : 0;
  }
  return { breite: bild.breite, hoehe: bild.hoehe, daten };
}

/**
 * Otsu-Verfahren (Nobuyuki Otsu, 1979): findet den Schwellwert automatisch.
 *
 * Idee: Der Schwellwert teilt die Pixel in zwei Klassen, dunkel und hell.
 * Gesucht ist die Teilung, bei der sich die beiden Klassen am stärksten unterscheiden,
 * genauer: bei der die „Varianz zwischen den Klassen“ am größten ist:
 *
 *     σ²_B(t) = w_dunkel · w_hell · (μ_dunkel − μ_hell)²
 *
 * w = Anteil der Pixel in der Klasse, μ = mittlerer Grauwert der Klasse.
 * Wir probieren einfach alle 256 möglichen Schwellwerte aus.
 *
 * Oft trennen mehrere Schwellwerte gleich gut, z. B. bei einem Bild mit nur zwei Grauwerten.
 * Dann nehmen wir die Mitte dieses Bereichs: Bei weichen Kanten (Antialiasing) ist das robuster.
 *
 * Rückgabe: Schwellwert t im Sinne von binarisiere(), also Pixel < t sind dunkel.
 */
export function otsu(h: Uint32Array): number {
  let gesamt = 0;
  let summeGesamt = 0;
  for (let g = 0; g < 256; g++) {
    gesamt += h[g]!;
    summeGesamt += g * h[g]!;
  }
  if (gesamt === 0) return 128;

  let anzahlDunkel = 0;
  let summeDunkel = 0;
  let besteVarianz = -1;
  let ersterBester = 128;
  let letzterBester = 128;

  // t ist der Schwellwert: Grauwerte 0 … t−1 sind dunkel, t … 255 hell.
  for (let t = 1; t < 256; t++) {
    anzahlDunkel += h[t - 1]!;
    summeDunkel += (t - 1) * h[t - 1]!;
    const anzahlHell = gesamt - anzahlDunkel;
    if (anzahlDunkel === 0 || anzahlHell === 0) continue;

    const mittelDunkel = summeDunkel / anzahlDunkel;
    const mittelHell = (summeGesamt - summeDunkel) / anzahlHell;
    const wDunkel = anzahlDunkel / gesamt;
    const wHell = anzahlHell / gesamt;
    const varianz = wDunkel * wHell * (mittelDunkel - mittelHell) ** 2;

    // Gleich gut heißt hier: bis auf Rundungsfehler gleich.
    if (varianz > besteVarianz * (1 + 1e-12)) {
      besteVarianz = varianz;
      ersterBester = t;
      letzterBester = t;
    } else if (varianz >= besteVarianz * (1 - 1e-12)) {
      letzterBester = t;
    }
  }
  return Math.round((ersterBester + letzterBester) / 2);
}
