/**
 * Schritt 6: Vereinfachen mit dem Douglas-Peucker-Verfahren
 * (David Douglas und Thomas Peucker, 1973).
 *
 * Eine Kontur aus Marching Squares hat sehr viele Punkte – jeden halben Pixel einen.
 * Viele davon liegen fast auf einer Geraden und sind überflüssig.
 *
 * Idee für eine Linie von A nach B:
 *   1. Verbinde A und B mit einer Strecke.
 *   2. Suche den Punkt P dazwischen, der am weitesten von dieser Strecke entfernt ist.
 *   3. Ist der Abstand kleiner als die Toleranz, reicht die Strecke A–B: Alle Punkte
 *      dazwischen fallen weg.
 *   4. Sonst bleibt P erhalten, und man macht mit A–P und P–B getrennt weiter.
 *
 * Die Toleranz regelt den Tausch „Genauigkeit gegen Datenmenge“: Je größer sie ist,
 * desto weniger Punkte bleiben übrig und desto gröber wird die Form.
 */
import type { Punkt } from './bilder';

/** Abstand des Punkts p von der Strecke a–b. */
export function abstandZurStrecke(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const laenge2 = dx * dx + dy * dy;
  if (laenge2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // Lotfußpunkt als Anteil t der Strecke, auf 0 … 1 begrenzt
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / laenge2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Douglas-Peucker für eine offene Linie. Anfangs- und Endpunkt bleiben immer erhalten.
 * Statt Rekursion mit einem Stapel offener Aufgaben – so gibt es auch bei sehr langen
 * Konturen keinen Stapelüberlauf.
 */
export function douglasPeucker(punkte: readonly Punkt[], toleranz: number): Punkt[] {
  if (punkte.length <= 2) return punkte.slice();
  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1;
  behalten[punkte.length - 1] = 1;
  const stapel: Array<[number, number]> = [[0, punkte.length - 1]];

  while (stapel.length > 0) {
    const [anfang, ende] = stapel.pop()!;
    let weitester = -1;
    let groessterAbstand = -1;
    for (let i = anfang + 1; i < ende; i++) {
      const d = abstandZurStrecke(punkte[i]!, punkte[anfang]!, punkte[ende]!);
      if (d > groessterAbstand) {
        groessterAbstand = d;
        weitester = i;
      }
    }
    if (weitester !== -1 && groessterAbstand > toleranz) {
      behalten[weitester] = 1;
      stapel.push([anfang, weitester], [weitester, ende]);
    }
  }
  return punkte.filter((_, i) => behalten[i]);
}

/** Index des Punkts, der am weitesten von p entfernt ist. */
function weitesterVon(punkte: readonly Punkt[], p: Punkt): number {
  let besterIndex = 0;
  let bester = -1;
  punkte.forEach((q, i) => {
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d > bester) {
      bester = d;
      besterIndex = i;
    }
  });
  return besterIndex;
}

/**
 * Douglas-Peucker für eine geschlossene Kontur (letzter Punkt nicht wiederholt).
 *
 * Weil Anfangs- und Endpunkt immer erhalten bleiben, sollten sie gut gewählt sein.
 * Der Startpunkt aus Marching Squares liegt zufällig, oft mitten auf einer Kante.
 * Darum teilen wir die Kontur an zwei weit auseinanderliegenden Punkten A und B
 * (A: am weitesten vom Start entfernt, B: am weitesten von A). Das sind praktisch
 * immer Ecken der Form. Beide Hälften werden einzeln vereinfacht.
 *
 * Es bleiben mindestens drei Punkte übrig, damit die Form nicht verschwindet.
 */
export function vereinfacheGeschlossen(punkte: readonly Punkt[], toleranz: number): Punkt[] {
  if (punkte.length <= 3) return punkte.slice();
  const a = weitesterVon(punkte, punkte[0]!);
  const b = weitesterVon(punkte, punkte[a]!);
  const [i, j] = a < b ? [a, b] : [b, a];

  const haelfte1 = punkte.slice(i, j + 1); // von i bis j
  const haelfte2 = [...punkte.slice(j), ...punkte.slice(0, i + 1)]; // von j über den Start bis i
  const teil1 = douglasPeucker(haelfte1, toleranz);
  const teil2 = douglasPeucker(haelfte2, toleranz);
  // Die Teilungspunkte stehen in beiden Hälften; je einmal entfernen.
  const ergebnis = [...teil1.slice(0, -1), ...teil2.slice(0, -1)];

  if (ergebnis.length >= 3) return ergebnis;
  // Sehr kleine Form: den Punkt dazunehmen, der am weitesten von der Strecke A–B liegt.
  let k = 0;
  let bester = -1;
  punkte.forEach((p, n) => {
    const d = abstandZurStrecke(p, punkte[i]!, punkte[j]!);
    if (d > bester) {
      bester = d;
      k = n;
    }
  });
  return [i, j, k].sort((x, y) => x - y).map((n) => punkte[n]!);
}
