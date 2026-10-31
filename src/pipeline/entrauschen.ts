/**
 * Schritt 4: Entrauschen – kleine Flecken und Löcher entfernen.
 *
 * Ein „zusammenhängender Bereich“ ist eine Gruppe gleichfarbiger Pixel, die sich
 * gegenseitig erreichen können, indem man immer zu einem Nachbarn geht.
 *
 * Welche Pixel sind Nachbarn?
 *   - Vordergrund (1): nur die 4 Pixel links, rechts, oben, unten (4er-Nachbarschaft).
 *     Zwei schwarze Pixel, die sich nur an einer Ecke berühren, gelten als getrennt –
 *     für den Cutter ist das sinnvoll, denn eine Verbindung der Breite null hält nicht.
 *   - Hintergrund (0): alle 8 Pixel rundherum (8er-Nachbarschaft).
 * Diese Kombination passt zur Konturensuche in konturen.ts, so dass beide Schritte
 * dasselbe Bild „sehen“.
 */
import type { Binaerbild } from './bilder';

const VIER = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const ACHT = [...VIER, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export interface Bereich {
  /** 0 = Hintergrund, 1 = Vordergrund */
  wert: 0 | 1;
  /** Anzahl der Pixel */
  flaeche: number;
  /** Berührt der Bereich den Bildrand? Hintergrund am Rand ist kein Loch. */
  amRand: boolean;
  /** Indizes der Pixel (y · breite + x) */
  pixel: number[];
}

/**
 * Findet alle zusammenhängenden Bereiche, durch „Fluten“ mit einer Warteschlange:
 * Man beginnt bei einem Pixel, färbt es ein und nimmt seine gleichfarbigen Nachbarn
 * in die Warteschlange auf – bis keine mehr übrig sind.
 *
 * Rückgabe: die Bereiche und je Pixel die Nummer seines Bereichs.
 */
export function findeBereiche(bild: Binaerbild): { bereiche: Bereich[]; nummer: Int32Array } {
  const { breite, hoehe, daten } = bild;
  const nummer = new Int32Array(breite * hoehe).fill(-1);
  const bereiche: Bereich[] = [];
  const schlange = new Int32Array(breite * hoehe);

  for (let start = 0; start < daten.length; start++) {
    if (nummer[start] !== -1) continue;
    const wert = daten[start] as 0 | 1;
    const nachbarn = wert === 1 ? VIER : ACHT;
    const n = bereiche.length;
    const bereich: Bereich = { wert, flaeche: 0, amRand: false, pixel: [] };

    let lesen = 0;
    let schreiben = 0;
    schlange[schreiben++] = start;
    nummer[start] = n;
    while (lesen < schreiben) {
      const i = schlange[lesen++]!;
      bereich.pixel.push(i);
      const x = i % breite;
      const y = (i - x) / breite;
      if (x === 0 || y === 0 || x === breite - 1 || y === hoehe - 1) bereich.amRand = true;
      for (const [dx, dy] of nachbarn) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= breite || ny >= hoehe) continue;
        const j = ny * breite + nx;
        if (nummer[j] === -1 && daten[j] === wert) {
          nummer[j] = n;
          schlange[schreiben++] = j;
        }
      }
    }
    bereich.flaeche = bereich.pixel.length;
    bereiche.push(bereich);
  }
  return { bereiche, nummer };
}

export interface EntrauschErgebnis {
  bild: Binaerbild;
  /** Entfernte Vordergrund-Flecken (wurden zu Hintergrund). */
  entfernteFlecken: Bereich[];
  /** Gefüllte Löcher (Hintergrund innerhalb des Vordergrunds, wurde zu Vordergrund). */
  gefuellteLoecher: Bereich[];
}

/**
 * Entfernt Vordergrund-Flecken und füllt Löcher, die kleiner als `mindestflaeche` Pixel sind.
 * Der Hintergrund am Bildrand bleibt immer erhalten.
 *
 * Zwei Durchgänge: erst Flecken entfernen, dann auf dem bereinigten Bild die Löcher suchen.
 * So verschwindet auch ein kleiner Fleck, der mitten in einem kleinen Loch sitzt.
 */
export function entrausche(bild: Binaerbild, mindestflaeche: number): EntrauschErgebnis {
  const { breite, hoehe } = bild;
  if (mindestflaeche <= 1) {
    return { bild: { breite, hoehe, daten: bild.daten.slice() }, entfernteFlecken: [], gefuellteLoecher: [] };
  }

  // 1. Durchgang: kleine Vordergrund-Flecken werden Hintergrund.
  const ohneFlecken = bild.daten.slice();
  const entfernteFlecken = findeBereiche(bild).bereiche.filter((b) => b.wert === 1 && b.flaeche < mindestflaeche);
  for (const b of entfernteFlecken) for (const i of b.pixel) ohneFlecken[i] = 0;

  // 2. Durchgang: kleine Löcher (Hintergrund, der den Rand nicht berührt) werden Vordergrund.
  const zwischen: Binaerbild = { breite, hoehe, daten: ohneFlecken };
  const daten = ohneFlecken.slice();
  const gefuellteLoecher = findeBereiche(zwischen).bereiche.filter(
    (b) => b.wert === 0 && !b.amRand && b.flaeche < mindestflaeche,
  );
  for (const b of gefuellteLoecher) for (const i of b.pixel) daten[i] = 1;

  return { bild: { breite, hoehe, daten }, entfernteFlecken, gefuellteLoecher };
}
