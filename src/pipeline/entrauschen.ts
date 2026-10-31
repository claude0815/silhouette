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

export interface Bereich {
  /** 0 = Hintergrund, 1 = Vordergrund */
  wert: 0 | 1;
  /** Anzahl der Pixel */
  flaeche: number;
  /** Berührt der Bereich den Bildrand? Hintergrund am Rand ist kein Loch. */
  amRand: boolean;
}

/**
 * Findet alle zusammenhängenden Bereiche, durch „Fluten“ mit einer Warteschlange:
 * Man beginnt bei einem Pixel, gibt ihm eine Nummer und nimmt seine gleichfarbigen
 * Nachbarn in die Warteschlange auf – bis keine mehr übrig sind. Dann kommt das
 * nächste Pixel ohne Nummer dran.
 *
 * Rückgabe: die Bereiche und je Pixel die Nummer seines Bereichs.
 * Mit `nurWert` werden nur Bereiche dieser Farbe gesucht; die anderen Pixel behalten −1.
 * Das spart viel Zeit, wenn man z. B. nur die Vordergrund-Flecken braucht.
 */
export function findeBereiche(bild: Binaerbild, nurWert?: 0 | 1): { bereiche: Bereich[]; nummer: Int32Array } {
  const { breite: b, hoehe: h, daten } = bild;
  const nummer = new Int32Array(b * h).fill(-1);
  const bereiche: Bereich[] = [];
  const schlange = new Int32Array(b * h);

  for (let start = 0; start < daten.length; start++) {
    if (nummer[start] !== -1) continue;
    const wert = daten[start] as 0 | 1;
    if (nurWert !== undefined && wert !== nurWert) continue;
    const acht = wert === 0; // Hintergrund mit 8er-Nachbarschaft
    const n = bereiche.length;
    let flaeche = 0;
    let amRand = false;
    let lesen = 0;
    let schreiben = 0;

    nummer[start] = n;
    schlange[schreiben++] = start;
    while (lesen < schreiben) {
      const i = schlange[lesen++]!;
      flaeche++;
      const x = i % b;
      const links = x > 0;
      const rechts = x < b - 1;
      const oben = i >= b;
      const unten = i < b * (h - 1);
      if (!links || !rechts || !oben || !unten) amRand = true;

      // Nachbarn prüfen: gleiche Farbe und noch keine Nummer → Nummer geben und vormerken.
      // (Ausgeschrieben statt als Hilfsfunktion, weil diese Zeilen millionenfach laufen.)
      let j: number;
      if (links && nummer[(j = i - 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
      if (rechts && nummer[(j = i + 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
      if (oben && nummer[(j = i - b)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
      if (unten && nummer[(j = i + b)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
      if (acht) {
        if (oben && links && nummer[(j = i - b - 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
        if (oben && rechts && nummer[(j = i - b + 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
        if (unten && links && nummer[(j = i + b - 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
        if (unten && rechts && nummer[(j = i + b + 1)] === -1 && daten[j] === wert) { nummer[j] = n; schlange[schreiben++] = j; }
      }
    }
    bereiche.push({ wert, flaeche, amRand });
  }
  return { bereiche, nummer };
}

/** Markierungen in EntrauschErgebnis.geaendert */
export const UNVERAENDERT = 0;
export const FLECK_ENTFERNT = 1;
export const LOCH_GEFUELLT = 2;

export interface EntrauschErgebnis {
  bild: Binaerbild;
  /** Je Pixel: UNVERAENDERT, FLECK_ENTFERNT oder LOCH_GEFUELLT – für die Vorher-nachher-Ansicht. */
  geaendert: Uint8Array;
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
  const geaendert = new Uint8Array(breite * hoehe);
  if (mindestflaeche <= 1) {
    return { bild: { breite, hoehe, daten: bild.daten.slice() }, geaendert, entfernteFlecken: [], gefuellteLoecher: [] };
  }

  /** Setzt alle Pixel der ausgewählten Bereiche auf `neu`. */
  const ersetze = (quelle: Binaerbild, auswahl: (b: Bereich) => boolean, neu: 0 | 1) => {
    // Gesucht werden nur Bereiche der Farbe, die ersetzt werden soll.
    const { bereiche, nummer } = findeBereiche(quelle, neu === 0 ? 1 : 0);
    const gewaehlt = bereiche.map(auswahl);
    const daten = quelle.daten.slice();
    for (let i = 0; i < daten.length; i++) {
      const n = nummer[i]!;
      if (n !== -1 && gewaehlt[n]) daten[i] = neu;
    }
    return { daten, gewaehlt: bereiche.filter((_, k) => gewaehlt[k]) };
  };

  // 1. Durchgang: kleine Vordergrund-Flecken werden Hintergrund.
  const schritt1 = ersetze(bild, (b) => b.wert === 1 && b.flaeche < mindestflaeche, 0);
  // 2. Durchgang: kleine Löcher (Hintergrund, der den Rand nicht berührt) werden Vordergrund.
  const schritt2 = ersetze(
    { breite, hoehe, daten: schritt1.daten },
    (b) => b.wert === 0 && !b.amRand && b.flaeche < mindestflaeche,
    1,
  );

  // Markieren, was sich gegenüber dem Original geändert hat.
  for (let i = 0; i < geaendert.length; i++) {
    if (schritt2.daten[i] !== bild.daten[i]) geaendert[i] = schritt2.daten[i] ? LOCH_GEFUELLT : FLECK_ENTFERNT;
  }

  return {
    bild: { breite, hoehe, daten: schritt2.daten },
    geaendert,
    entfernteFlecken: schritt1.gewaehlt,
    gefuellteLoecher: schritt2.gewaehlt,
  };
}
