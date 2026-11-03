/**
 * Größe und Lage des Motivs ändern, ohne die Formen selbst anzufassen.
 *
 * Ein SVG hat zwei Koordinatensysteme: die echte Größe (width, height in mm) und das
 * Koordinatensystem der viewBox, in dem die Formen stehen. Die viewBox ist wie ein Bildausschnitt,
 * der auf die Fläche width × height gezogen wird. Darum genügt es, nur die drei Attribute der
 * Wurzel zu ändern:
 *
 *   - Ein kleinerer Ausschnitt (viewBox) auf derselben Fläche vergrößert alles.
 *   - Ein verschobener Anfang der viewBox (minX, minY) verschiebt alles.
 *
 * Die Pfade im Code bleiben Zeichen für Zeichen gleich.
 */

import { attribut, svgZuPolylinien, type SvgDokument } from './dokument';

export interface Rahmen {
  /** Linke obere Ecke in mm */
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Umgebendes Rechteck aller Formen in mm (null, wenn es keine gibt). */
export function motivRahmen(dok: SvgDokument): Rahmen | null {
  const punkte = svgZuPolylinien(dok).flat();
  if (punkte.length === 0) return null;
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, breite: Math.max(...xs) - x, hoehe: Math.max(...ys) - y };
}

const zahl = (n: number) => String(Math.round(n * 10000) / 10000);

/**
 * Skaliert das Motiv auf die Breite `ziel.breite` (Höhe im gleichen Verhältnis) und legt seine
 * linke obere Ecke auf (`ziel.x`, `ziel.y`) in mm. Die Seite wird so groß, dass das Motiv
 * mit dem bisherigen Rand rechts und unten darauf passt.
 */
export function setzeGroesseUndLage(text: string, dok: SvgDokument, ziel: { x: number; y: number; breite: number }): string | null {
  const alt = motivRahmen(dok);
  const wurzel = dok.elemente.find((e) => e.name === 'svg');
  if (!alt || !wurzel || alt.breite <= 0) return null;
  const s = ziel.breite / alt.breite;
  const k = dok.mmJeEinheit;
  const [vx, vy] = dok.viewBox;

  // Ein Punkt mit dem Abstand mm vom Seitenrand soll danach bei (mm − alt) · s + ziel liegen.
  // Mit mm = (u − minX) · k ergibt sich der neue Anfang der viewBox:
  //   minX' = minX + alt.x / k − ziel.x / (k · s)
  const minX = vx + alt.x / k.x - ziel.x / (k.x * s);
  const minY = vy + alt.y / k.y - ziel.y / (k.y * s);
  const randRechts = Math.max(0, dok.breiteMm - (alt.x + alt.breite));
  const randUnten = Math.max(0, dok.hoeheMm - (alt.y + alt.hoehe));
  const breiteMm = ziel.x + alt.breite * s + randRechts;
  const hoeheMm = ziel.y + alt.hoehe * s + randUnten;

  const neu: Record<string, string> = {
    width: `${zahl(breiteMm)}mm`,
    height: `${zahl(hoeheMm)}mm`,
    // Die Fläche ist s-mal so groß wie der Ausschnitt in alten Millimetern
    viewBox: `${zahl(minX)} ${zahl(minY)} ${zahl(breiteMm / (k.x * s))} ${zahl(hoeheMm / (k.y * s))}`,
  };
  // Von hinten nach vorn ersetzen, damit die Textpositionen davor gültig bleiben
  const aenderungen: { start: number; ende: number; text: string }[] = [];
  for (const [name, wert] of Object.entries(neu)) {
    const a = attribut(wurzel, name);
    if (a) aenderungen.push({ start: a.start, ende: a.ende, text: wert });
    else aenderungen.push({ start: wurzel.start + 4, ende: wurzel.start + 4, text: ` ${name}="${wert}"` });
  }
  let ergebnis = text;
  for (const a of aenderungen.sort((p, q) => q.start - p.start)) ergebnis = ergebnis.slice(0, a.start) + a.text + ergebnis.slice(a.ende);
  return ergebnis;
}

/** Größter Maßstab, mit dem das Motiv samt Rand in den Bereich passt; liefert die Zielbreite. */
export function einpassen(motiv: Rahmen, bereich: { breite: number; hoehe: number }, randMm: number): { x: number; y: number; breite: number } {
  const s = Math.min((bereich.breite - 2 * randMm) / motiv.breite, motiv.hoehe > 0 ? (bereich.hoehe - 2 * randMm) / motiv.hoehe : Infinity);
  return { x: randMm, y: randMm, breite: Math.max(1, motiv.breite * s) };
}

