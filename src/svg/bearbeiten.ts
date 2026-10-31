/**
 * Punkte eines Pfads ziehen: Welche Zahlen im d-Text gehören zu welchem Punkt,
 * und wie ändert sich der Text, wenn ein Punkt woandershin gezogen wird?
 *
 * Wichtig bei relativen Befehlen (Kleinbuchstaben): Ihre Zahlen sind Abstände zum
 * Punkt, an dem der Befehl beginnt. Zieht man ihren Endpunkt, ändert sich nur die
 * Zahl dieses Befehls – alle folgenden relativen Punkte wandern deshalb mit.
 */
import type { Punkt } from '../cutter/types';
import type { PfadBefehl, Textstelle } from './pfad';

export type Rolle = 'ende' | 'kontrolle1' | 'kontrolle2';

export interface Griff {
  /** Index des Befehls */
  befehl: number;
  rolle: Rolle;
  /** Lage in absoluten Koordinaten des Pfads (vor transform) */
  p: Punkt;
  /** Indizes der x- und y-Zahl in befehl.werte; null, wenn es die Zahl nicht gibt (H, V) */
  x: number | null;
  y: number | null;
  /** Punkt, auf den sich relative Zahlen beziehen */
  bezug: Punkt;
  relativ: boolean;
}

/**
 * Alle ziehbaren Punkte eines Pfads. Gerechnet wird wie beim Zeichnen: Man merkt sich
 * den aktuellen Punkt und den Anfang des Teilpfads (für Z).
 */
export function befehlsGriffe(befehle: readonly PfadBefehl[]): Griff[] {
  const griffe: Griff[] = [];
  let aktuell: Punkt = { x: 0, y: 0 };
  let start: Punkt = { x: 0, y: 0 };
  befehle.forEach((b, nr) => {
    const w = b.werte;
    const bezug = aktuell;
    const abs = (ix: number, iy: number): Punkt =>
      b.relativ ? { x: bezug.x + w[ix]!, y: bezug.y + w[iy]! } : { x: w[ix]!, y: w[iy]! };
    const griff = (rolle: Rolle, p: Punkt, x: number | null, y: number | null) =>
      griffe.push({ befehl: nr, rolle, p, x, y, bezug, relativ: b.relativ });
    let ende: Punkt = aktuell;
    switch (b.typ) {
      case 'M':
      case 'L':
      case 'T':
        ende = abs(0, 1);
        griff('ende', ende, 0, 1);
        break;
      case 'H':
        ende = { x: b.relativ ? bezug.x + w[0]! : w[0]!, y: bezug.y };
        griff('ende', ende, 0, null);
        break;
      case 'V':
        ende = { x: bezug.x, y: b.relativ ? bezug.y + w[0]! : w[0]! };
        griff('ende', ende, null, 0);
        break;
      case 'C':
        griff('kontrolle1', abs(0, 1), 0, 1);
        griff('kontrolle2', abs(2, 3), 2, 3);
        ende = abs(4, 5);
        griff('ende', ende, 4, 5);
        break;
      case 'S':
        griff('kontrolle2', abs(0, 1), 0, 1);
        ende = abs(2, 3);
        griff('ende', ende, 2, 3);
        break;
      case 'Q':
        griff('kontrolle1', abs(0, 1), 0, 1);
        ende = abs(2, 3);
        griff('ende', ende, 2, 3);
        break;
      case 'A':
        ende = abs(5, 6);
        griff('ende', ende, 5, 6);
        break;
      case 'Z':
        ende = start;
        break;
    }
    if (b.typ === 'M') start = ende;
    aktuell = ende;
  });
  return griffe;
}

/** Zahl für den Code: höchstens zwei Nachkommastellen, ohne überflüssige Nullen. */
export function codeZahl(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** Ersetzt Textstellen durch neue Werte (von hinten nach vorn, damit die Positionen stimmen). */
export function ersetzeStellen(text: string, aenderungen: ReadonlyArray<{ stelle: Textstelle; wert: string }>): string {
  let ergebnis = text;
  for (const a of [...aenderungen].sort((p, q) => q.stelle.start - p.stelle.start)) {
    ergebnis = ergebnis.slice(0, a.stelle.start) + a.wert + ergebnis.slice(a.stelle.ende);
  }
  return ergebnis;
}

/**
 * Neuer Text, wenn der Griff an den Punkt `neu` (absolute Koordinaten des Pfads) gezogen wird.
 * `befehle` müssen Textstellen im selben Text haben.
 */
export function ziehePunkt(text: string, befehle: readonly PfadBefehl[], griff: Griff, neu: Punkt): string {
  const b = befehle[griff.befehl]!;
  const wert = (abs: number, bezug: number) => codeZahl(griff.relativ ? abs - bezug : abs);
  const aenderungen: Array<{ stelle: Textstelle; wert: string }> = [];
  if (griff.x !== null) aenderungen.push({ stelle: b.zahlen[griff.x]!, wert: wert(neu.x, griff.bezug.x) });
  if (griff.y !== null) aenderungen.push({ stelle: b.zahlen[griff.y]!, wert: wert(neu.y, griff.bezug.y) });
  return ersetzeStellen(text, aenderungen);
}
