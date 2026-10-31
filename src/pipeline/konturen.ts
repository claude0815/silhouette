/**
 * Schritt 5: Konturen finden mit Marching Squares.
 *
 * Idee: Wir legen ein Gitter über das Bild, dessen Ecken in den Pixelmitten liegen.
 * Jede Gitterzelle hat also vier Pixel als Ecken. Ob eine Kontur durch die Zelle läuft,
 * hängt nur davon ab, welche Ecken Vordergrund (1) sind. Bei vier Ecken gibt es
 * 2⁴ = 16 Fälle. Die Fallnummer entsteht, indem man die Ecken als Binärzahl liest:
 *
 *     oben links · 8  +  oben rechts · 4  +  unten rechts · 2  +  unten links · 1
 *
 *   8 ─ T ─ 4        T, R, B, L sind die Mitten der Zellkanten
 *   │       │        (top, right, bottom, left). Dort liegen die Konturpunkte.
 *   L       R
 *   │       │
 *   1 ─ B ─ 2
 *
 * Für jeden Fall steht in der Tabelle FALL_SEGMENTE, welche Kantenmitten verbunden werden.
 * Die Teilstücke haben eine Richtung: Der Vordergrund liegt immer rechts davon.
 * Dadurch laufen Außenkonturen im Uhrzeigersinn und Löcher gegen den Uhrzeigersinn
 * (auf dem Bildschirm, wo y nach unten zeigt) – das Vorzeichen der Fläche verrät,
 * was ein Loch ist.
 *
 * Damit alle Konturen geschlossen sind, denken wir uns rund um das Bild einen
 * Rand aus Hintergrund-Pixeln.
 *
 * Sattelfälle 5 und 10: Zwei Vordergrund-Ecken liegen sich diagonal gegenüber. Hier gibt
 * es zwei Möglichkeiten. Wir trennen die beiden Ecken (je ein eigenes Teilstück),
 * passend zur 4er-Nachbarschaft des Vordergrunds in entrauschen.ts.
 */
import type { Binaerbild, Punkt } from './bilder';
import { findeBereiche } from './entrauschen';

export type Kante = 'T' | 'R' | 'B' | 'L';

/**
 * Die 16 Fälle: je Fall die Teilstücke als [von, nach], Vordergrund rechts.
 * Fall 0 (alles Hintergrund) und 15 (alles Vordergrund) haben keine Kontur.
 */
export const FALL_SEGMENTE: readonly (readonly (readonly [Kante, Kante])[])[] = [
  /*  0 ····       */ [],
  /*  1 unten li.  */ [['L', 'B']],
  /*  2 unten re.  */ [['B', 'R']],
  /*  3 unten      */ [['L', 'R']],
  /*  4 oben re.   */ [['R', 'T']],
  /*  5 Sattel     */ [['R', 'T'], ['L', 'B']],
  /*  6 rechts     */ [['B', 'T']],
  /*  7 ohne o. li.*/ [['L', 'T']],
  /*  8 oben li.   */ [['T', 'L']],
  /*  9 links      */ [['T', 'B']],
  /* 10 Sattel     */ [['T', 'L'], ['B', 'R']],
  /* 11 ohne o. re.*/ [['T', 'R']],
  /* 12 oben       */ [['R', 'L']],
  /* 13 ohne u. re.*/ [['R', 'B']],
  /* 14 ohne u. li.*/ [['B', 'L']],
  /* 15 ████       */ [],
];

/**
 * Lage der Kantenmitte relativ zur Zelle mit der linken oberen Ecke im Pixel (zx | zy).
 * Die Pixelmitte von Pixel (x | y) liegt bei (x + 0,5 | y + 0,5).
 */
export function kantenmitte(zx: number, zy: number, kante: Kante): Punkt {
  switch (kante) {
    case 'T':
      return { x: zx + 1, y: zy + 0.5 };
    case 'R':
      return { x: zx + 1.5, y: zy + 1 };
    case 'B':
      return { x: zx + 1, y: zy + 1.5 };
    case 'L':
      return { x: zx + 0.5, y: zy + 1 };
  }
}

/** Wert eines Pixels; außerhalb des Bildes 0 (der gedachte Rand). */
function pixel(bild: Binaerbild, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= bild.breite || y >= bild.hoehe) return 0;
  return bild.daten[y * bild.breite + x]!;
}

/** Fallnummer der Zelle, deren linke obere Ecke das Pixel (zx | zy) ist. */
export function fall(bild: Binaerbild, zx: number, zy: number): number {
  return (
    pixel(bild, zx, zy) * 8 + pixel(bild, zx + 1, zy) * 4 + pixel(bild, zx + 1, zy + 1) * 2 + pixel(bild, zx, zy + 1)
  );
}

export interface Zelle {
  x: number;
  y: number;
  fall: number;
}

/**
 * Alle Zellen, durch die eine Kontur läuft, in Lesereihenfolge (Zeile für Zeile).
 * Für die Schritt-für-Schritt-Animation; nur für kleine Bilder gedacht.
 */
export function zellenMitKontur(bild: Binaerbild): Zelle[] {
  const zellen: Zelle[] = [];
  for (let zy = -1; zy < bild.hoehe; zy++) {
    for (let zx = -1; zx < bild.breite; zx++) {
      const f = fall(bild, zx, zy);
      if (f !== 0 && f !== 15) zellen.push({ x: zx, y: zy, fall: f });
    }
  }
  return zellen;
}

export interface Kontur {
  /** Geschlossener Linienzug; der letzte Punkt wird nicht wiederholt. */
  punkte: Punkt[];
  /** true = Außenkontur, false = Innenkontur (Loch). */
  aussen: boolean;
  /** Fläche in Pixeln (immer positiv). */
  flaeche: number;
  /** Nummer des Vordergrund-Bereichs, zu dem die Kontur gehört. Loch und Außenkontur teilen sie. */
  bereich: number;
}

/**
 * Vorzeichenbehaftete Fläche nach der Gaußschen Trapezformel (Schnürsenkelformel).
 * Bei y nach unten: positiv im Uhrzeigersinn, negativ gegen den Uhrzeigersinn.
 */
export function vorzeichenFlaeche(punkte: readonly Punkt[]): number {
  let summe = 0;
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i]!;
    const b = punkte[(i + 1) % punkte.length]!;
    summe += a.x * b.y - b.x * a.y;
  }
  return summe / 2;
}

/**
 * Findet alle Konturen des Binärbilds.
 *
 * Ablauf:
 *  1. Jede Zelle bestimmt ihren Fall und trägt ihre Teilstücke ein: „von Punkt A geht es zu Punkt B“.
 *  2. Jeder Punkt ist Anfang genau eines Teilstücks. Man startet bei irgendeinem Punkt und
 *     folgt den Teilstücken, bis man wieder am Anfang ist: eine geschlossene Kontur.
 *  3. Am Vorzeichen der Fläche erkennt man Außenkontur und Loch.
 */
export function findeKonturen(bild: Binaerbild): Kontur[] {
  const { breite, hoehe } = bild;
  // Punkte liegen auf halben Koordinaten. Verdoppelt sind es ganze Zahlen,
  // aus denen sich eine eindeutige Nummer für jeden Punkt bilden lässt.
  const spalten = 2 * breite + 4;
  const groesse = (2 * hoehe + 4) * spalten;
  const naechster = new Int32Array(groesse).fill(-1);
  const anfaenge: number[] = [];

  // Für die Geschwindigkeit: das Bild mit dem gedachten Rand als echte Tabelle,
  // und die Kantenmitten als Verschiebung der Punktnummer gegenüber der Zelle.
  const pb = breite + 2;
  const gepolstert = new Uint8Array(pb * (hoehe + 2));
  for (let y = 0; y < hoehe; y++) {
    gepolstert.set(bild.daten.subarray(y * breite, (y + 1) * breite), (y + 1) * pb + 1);
  }
  const versatz = Object.fromEntries(
    (['T', 'R', 'B', 'L'] as const).map((k) => {
      const p = kantenmitte(0, 0, k);
      return [k, 2 * p.y * spalten + 2 * p.x];
    }),
  ) as Record<Kante, number>;
  const tabelle = FALL_SEGMENTE.map((segmente) => segmente.map(([von, nach]) => [versatz[von], versatz[nach]] as const));

  // 1. Teilstücke eintragen. Zelle (zx | zy) hat ihre linke obere Ecke im gepolsterten Pixel (zx+1 | zy+1).
  for (let zy = -1; zy < hoehe; zy++) {
    for (let zx = -1; zx < breite; zx++) {
      const i = (zy + 1) * pb + zx + 1;
      const f = gepolstert[i]! * 8 + gepolstert[i + 1]! * 4 + gepolstert[i + pb + 1]! * 2 + gepolstert[i + pb]!;
      if (f === 0 || f === 15) continue;
      const basis = 2 * zy * spalten + 2 * zx;
      for (const [von, nach] of tabelle[f]!) {
        naechster[basis + von] = basis + nach;
        anfaenge.push(basis + von);
      }
    }
  }

  // Bereichsnummern, um Löcher ihrer Außenkontur zuzuordnen
  const bereichVon = findeBereiche(bild).nummer;

  // 2. Teilstücken folgen
  const besucht = new Uint8Array(groesse);
  const konturen: Kontur[] = [];
  const alsPunkt = (n: number): Punkt => ({ x: (n % spalten) / 2, y: Math.floor(n / spalten) / 2 });
  for (const start of anfaenge) {
    if (besucht[start]) continue;
    const punkte: Punkt[] = [];
    let n = start;
    while (!besucht[n]) {
      besucht[n] = 1;
      punkte.push(alsPunkt(n));
      n = naechster[n]!;
    }

    // 3. Außen oder innen?
    const a = vorzeichenFlaeche(punkte);
    konturen.push({
      punkte,
      aussen: a > 0,
      flaeche: Math.abs(a),
      bereich: bereichVon[vordergrundPixel(punkte, breite)] ?? -1,
    });
  }
  return konturen;
}

/**
 * Ein Vordergrund-Pixel neben der Kontur: Vom ersten Teilstück aus ein Stück nach rechts
 * (dort liegt immer Vordergrund). Rechts von der Richtung (dx | dy) ist bei y nach unten (−dy | dx).
 */
function vordergrundPixel(punkte: readonly Punkt[], breite: number): number {
  const a = punkte[0]!;
  const b = punkte[1] ?? a;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const laenge = Math.hypot(dx, dy) || 1;
  const mx = (a.x + b.x) / 2 + (-dy / laenge) * 0.4;
  const my = (a.y + b.y) / 2 + (dx / laenge) * 0.4;
  return Math.floor(my) * breite + Math.floor(mx);
}

export interface Form {
  aussen: Kontur;
  loecher: Kontur[];
}

/** Fasst jede Außenkontur mit ihren Löchern zu einer Form zusammen (für fill-rule im SVG). */
export function gruppiere(konturen: readonly Kontur[]): Form[] {
  const formen = new Map<number, Form>();
  for (const k of konturen) if (k.aussen) formen.set(k.bereich, { aussen: k, loecher: [] });
  for (const k of konturen) if (!k.aussen) formen.get(k.bereich)?.loecher.push(k);
  return [...formen.values()];
}
