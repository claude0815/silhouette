/**
 * Schnittreihenfolge: In welcher Reihenfolge und ab welchem Punkt werden die Pfade geschnitten?
 *
 * Warum ist das wichtig?
 *  - Löcher zuerst: Wird zuerst die Außenkontur eines „O“ geschnitten, kann sich das Teil
 *    auf der Matte lösen oder verrutschen – das Loch wird dann ungenau. Darum schneidet man
 *    innen liegende Pfade vor den Pfaden, die sie umschließen.
 *  - Leerfahrten: Zwischen zwei Pfaden fährt das Messer angehoben. Eine geschickte
 *    Reihenfolge spart Weg und Zeit.
 */
import type { Polylinie, Punkt } from '../cutter/types';
import { istGeschlossen } from '../export/dxf';
import { imVieleck } from '../pipeline/geometrie';

export type Reihenfolge = 'original' | 'innen-vor-aussen' | 'naechster-nachbar';
export const REIHENFOLGEN: readonly Reihenfolge[] = ['original', 'innen-vor-aussen', 'naechster-nachbar'];

export interface GeordneterPfad {
  pfad: Polylinie;
  /** Position im SVG-Dokument (0 = erster Pfad) */
  original: number;
  /** Wie viele andere geschlossene Pfade umschließen diesen? 0 = ganz außen */
  tiefe: number;
}

/** Umschließendes Rechteck eines Pfads */
interface Rechteck {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function rechteckVon(p: Polylinie): Rechteck {
  const r = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const q of p) {
    r.minX = Math.min(r.minX, q.x);
    r.minY = Math.min(r.minY, q.y);
    r.maxX = Math.max(r.maxX, q.x);
    r.maxY = Math.max(r.maxY, q.y);
  }
  return r;
}

/**
 * Liste je Pfad: Welche anderen Pfade liegen in ihm? (Geprüft wird der erste Punkt.)
 * Vorfilter: Ein Punkt kann nur dann im Pfad liegen, wenn er in dessen umschließendem
 * Rechteck liegt. Der genaue, teurere Test kommt nur für diese Kandidaten.
 */
export function enthaltene(pfade: readonly Polylinie[]): number[][] {
  const rechtecke = pfade.map(rechteckVon);
  return pfade.map((aussen, j) => {
    if (!istGeschlossen(aussen)) return [];
    const r = rechtecke[j]!;
    const ergebnis: number[] = [];
    pfade.forEach((p, i) => {
      const s = p[0];
      if (i === j || !s || s.x < r.minX || s.x > r.maxX || s.y < r.minY || s.y > r.maxY) return;
      if (imVieleck(s, aussen)) ergebnis.push(i);
    });
    return ergebnis;
  });
}

/**
 * Verschachtelungstiefe jedes Pfads: Zählt, wie viele geschlossene Pfade seinen ersten Punkt
 * umschließen. Ein Loch im „O“ hat Tiefe 1, das „O“ selbst Tiefe 0.
 */
export function tiefen(pfade: readonly Polylinie[], innen = enthaltene(pfade)): number[] {
  const t = pfade.map(() => 0);
  for (const liste of innen) for (const i of liste) t[i]!++;
  return t;
}

const abstand = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Beginnt einen geschlossenen Pfad an Punkt k statt an Punkt 0 (gleiche Form, anderer Start). */
export function drehe(pfad: Polylinie, k: number): Polylinie {
  if (k === 0 || !istGeschlossen(pfad)) return pfad;
  const ohneSchluss = pfad.slice(0, -1);
  const gedreht = [...ohneSchluss.slice(k), ...ohneSchluss.slice(0, k)];
  return [...gedreht, gedreht[0]!];
}

/**
 * Ordnet die Pfade.
 *  - original: wie im SVG-Dokument
 *  - innen-vor-aussen: tiefer verschachtelte Pfade zuerst, sonst wie im Dokument
 *  - naechster-nachbar: Immer zum nächstgelegenen Pfad, der schon „dran“ ist – ein Pfad ist dran,
 *    wenn alle Pfade in seinem Inneren erledigt sind. Geschlossene Pfade beginnen am Punkt,
 *    der der aktuellen Messerposition am nächsten liegt.
 *
 * `start`: Position des Messers vor dem ersten Pfad (beim Cutter der Ursprung).
 */
export function ordne(pfade: readonly Polylinie[], art: Reihenfolge, start: Punkt = { x: 0, y: 0 }): GeordneterPfad[] {
  const innen = enthaltene(pfade);
  const t = tiefen(pfade, innen);
  const alle = pfade.map((pfad, original) => ({ pfad, original, tiefe: t[original]! }));
  if (art === 'original') return alle;
  if (art === 'innen-vor-aussen') return [...alle].sort((a, b) => b.tiefe - a.tiefe || a.original - b.original);

  // Nächster Nachbar mit der Bedingung „innen vor außen“
  const offen = new Set(alle.map((_, i) => i));
  // innen[j]: Pfade in Pfad j – j muss warten, bis sie erledigt sind
  const rechtecke = pfade.map(rechteckVon);
  const ergebnis: GeordneterPfad[] = [];
  let hier = start;
  while (offen.size > 0) {
    let bester: { i: number; k: number; d: number } | null = null;
    for (const i of offen) {
      // Abkürzung: Liegt schon das umschließende Rechteck weiter weg als der bisher beste
      // Punkt, kann kein Punkt dieses Pfads näher sein.
      const r = rechtecke[i]!;
      const untergrenze = Math.hypot(Math.max(r.minX - hier.x, 0, hier.x - r.maxX), Math.max(r.minY - hier.y, 0, hier.y - r.maxY));
      if (bester && untergrenze >= bester.d) continue;
      if (innen[i]!.some((j) => offen.has(j))) continue; // noch nicht dran
      const p = alle[i]!.pfad;
      // Bei geschlossenen Pfaden jeden Punkt als Start prüfen, sonst nur den Anfang
      const kandidaten = istGeschlossen(p) ? p.length - 1 : 1;
      for (let k = 0; k < kandidaten; k++) {
        const d = abstand(hier, p[k]!);
        if (!bester || d < bester.d) bester = { i, k, d };
      }
    }
    // Ohne Kandidat (sollte nicht vorkommen): den ersten offenen nehmen
    const wahl = bester ?? { i: [...offen][0]!, k: 0, d: 0 };
    const a = alle[wahl.i]!;
    const pfad = drehe(a.pfad, wahl.k);
    ergebnis.push({ ...a, pfad });
    offen.delete(wahl.i);
    hier = pfad[pfad.length - 1]!;
  }
  return ergebnis;
}

/** Pfade, die vor einem Pfad in ihrem Inneren geschnitten werden (für eine Warnung). */
export function aussenZuFrueh(geordnet: readonly GeordneterPfad[]): number[] {
  const innen = enthaltene(geordnet.map((g) => g.pfad));
  // innen[i] enthält Positionen in `geordnet`; liegt eine davon hinter i, kommt i zu früh.
  return geordnet.filter((_, i) => innen[i]!.some((j) => j > i)).map((g) => g.original);
}
