/**
 * Cutter-Checks: So „denkt“ ein Schneideplotter.
 *
 * Ein Cutter kennt keine Farben, keine Flächen und keine Strichstärken. Er fährt nur
 * Linien ab – mit dem Messer unten oder oben. Diese Checks zeigen, was das für ein
 * SVG-Dokument bedeutet, und warnen vor typischen Problemen.
 *
 * Alle Prüfungen sind reine Funktionen über dem gelesenen Dokument; die Texte dazu stehen
 * in i18n/de.ts unter dem Schlüssel der Prüfung.
 */
import type { Punkt } from '../cutter/types';
import { tiefen } from '../simulation/reihenfolge';
import { inMm, svgKonturen, type Kontur, type SvgDokument } from '../svg/dokument';
import { alsLinienzug, alsTeilpfade } from '../svg/pfad';
import { wende } from '../svg/transform';

export type PruefId =
  | 'leer'
  | 'fuellung'
  | 'offen'
  | 'fastGeschlossen'
  | 'loecher'
  | 'inseln'
  | 'doppelt'
  | 'winzig'
  | 'ausserhalbMatte'
  | 'ausserhalbDokument';

export type Stufe = 'ok' | 'info' | 'warnung';

export interface Befund {
  id: PruefId;
  stufe: Stufe;
  /** Wie oft trifft es zu? (0 = alles in Ordnung) */
  anzahl: number;
  /** Betroffene Pfade (Index in dok.pfade), zum Markieren */
  pfade: number[];
  /** Betroffene Stellen in mm, zum Markieren (höchstens 50) */
  stellen: Punkt[];
  /** Zusatzwert für den Text, z. B. die größte Lücke in mm */
  wert?: number;
}

export interface PruefOptionen {
  /** Schneidebereich (Matte) in mm */
  bereich: { breite: number; hoehe: number };
  /** Lücken bis zu dieser Größe gelten als „fast geschlossen“ (mm) */
  lueckeMm?: number;
  /** Teilstücke unter dieser Länge gelten als winzig (mm) */
  winzigMm?: number;
}

const abstand = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);
const MAX_STELLEN = 50;

function befund(id: PruefId, anzahl: number, stufeWennTrifft: Stufe, pfade: number[] = [], stellen: Punkt[] = [], wert?: number): Befund {
  return {
    id,
    stufe: anzahl === 0 ? 'ok' : stufeWennTrifft,
    anzahl,
    pfade: [...new Set(pfade)],
    stellen: stellen.slice(0, MAX_STELLEN),
    wert,
  };
}

export function pruefe(dok: SvgDokument, optionen: PruefOptionen, konturen: Kontur[] = svgKonturen(dok)): Befund[] {
  const lueckeMm = optionen.lueckeMm ?? 0.5;
  const winzigMm = optionen.winzigMm ?? 0.1;
  const ergebnisse: Befund[] = [];

  if (dok.pfade.length === 0) return [befund('leer', 1, 'warnung')];

  // 1. Füllungen: Der Cutter schneidet nur die Kontur, egal welche Farbe innen ist.
  const gefuellt = dok.pfade.map((p, i) => (p.stil.fuellung ? i : -1)).filter((i) => i >= 0);
  ergebnisse.push(befund('fuellung', gefuellt.length, 'info', gefuellt));

  // 2. Offene Pfade und 3. fast geschlossene Pfade
  const offen: Kontur[] = [];
  const fast: { k: Kontur; luecke: number }[] = [];
  for (const k of konturen) {
    if (k.geschlossen) continue;
    const luecke = abstand(k.punkte[0]!, k.punkte[k.punkte.length - 1]!);
    if (luecke === 0) continue; // ohne Z, aber Ende = Anfang: für den Cutter geschlossen
    if (luecke <= lueckeMm) fast.push({ k, luecke });
    else offen.push(k);
  }
  // Offen ist nur ein Problem, wenn die Form gefüllt gezeichnet ist (sie soll herausfallen)
  const offenGefuellt = offen.filter((k) => dok.pfade[k.pfad]!.stil.fuellung);
  ergebnisse.push(
    befund(
      'offen',
      offen.length,
      offenGefuellt.length > 0 ? 'warnung' : 'info',
      offen.map((k) => k.pfad),
      offen.flatMap((k) => [k.punkte[0]!, k.punkte[k.punkte.length - 1]!]),
      offenGefuellt.length,
    ),
  );
  ergebnisse.push(
    befund(
      'fastGeschlossen',
      fast.length,
      'warnung',
      fast.map((f) => f.k.pfad),
      fast.map((f) => f.k.punkte[0]!),
      fast.length ? Math.max(...fast.map((f) => f.luecke)) : undefined,
    ),
  );

  // 4. Löcher und 5. Inseln: Wie tief ist jede geschlossene Kontur verschachtelt?
  const geschlossen = konturen.filter((k) => k.geschlossen || abstand(k.punkte[0]!, k.punkte.at(-1)!) === 0);
  const t = tiefen(geschlossen.map((k) => k.punkte));
  const innen = geschlossen.filter((_, i) => t[i]! % 2 === 1);
  ergebnisse.push(befund('loecher', innen.length, 'info', innen.map((k) => k.pfad), innen.map((k) => k.punkte[0]!)));
  ergebnisse.push(befund('inseln', innen.length, 'info', innen.map((k) => k.pfad), innen.map((k) => k.punkte[0]!)));

  // 6. Doppelte Teilstücke: dieselbe Strecke zweimal → wird zweimal geschnitten
  const raster = (p: Punkt) => `${Math.round(p.x * 20)},${Math.round(p.y * 20)}`; // 0,05 mm wie der Cutter
  const gesehen = new Map<string, number>();
  const doppelt: { pfad: number; stelle: Punkt }[] = [];
  for (const k of konturen) {
    for (let i = 1; i < k.punkte.length; i++) {
      const a = raster(k.punkte[i - 1]!);
      const b = raster(k.punkte[i]!);
      if (a === b) continue;
      const schluessel = a < b ? `${a}|${b}` : `${b}|${a}`;
      const vorher = gesehen.get(schluessel);
      if (vorher !== undefined) {
        const pa = k.punkte[i - 1]!;
        const pb = k.punkte[i]!;
        doppelt.push({ pfad: k.pfad, stelle: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } });
      } else gesehen.set(schluessel, k.pfad);
    }
  }
  ergebnisse.push(befund('doppelt', doppelt.length, 'warnung', doppelt.map((d) => d.pfad), doppelt.map((d) => d.stelle)));

  // 7. Winzige Teilstücke: Befehle, deren Linie kürzer als winzigMm ist (am Originalpfad gemessen,
  //    nicht an der Zerlegung der Kurven, die absichtlich kurze Stücke erzeugt)
  const winzig: { pfad: number; stelle: Punkt }[] = [];
  dok.pfade.forEach((pfad, i) => {
    for (const tp of alsTeilpfade(pfad.befehle)) {
      let von = tp.start;
      for (const a of tp.abschnitte) {
        const zug = alsLinienzug({ start: von, startBefehl: -1, abschnitte: [a], geschlossen: false }, 0.01).map((p) =>
          inMm(dok, wende(pfad.matrix, p)),
        );
        let laenge = 0;
        for (let j = 1; j < zug.length; j++) laenge += abstand(zug[j - 1]!, zug[j]!);
        if (laenge < winzigMm) winzig.push({ pfad: i, stelle: zug[0]! });
        von = a.p;
      }
    }
  });
  ergebnisse.push(befund('winzig', winzig.length, 'warnung', winzig.map((w) => w.pfad), winzig.map((w) => w.stelle)));

  // 8. Außerhalb der Matte und 9. außerhalb des Dokuments
  const raus = (grenze: { breite: number; hoehe: number }) => {
    const pfade: number[] = [];
    const stellen: Punkt[] = [];
    for (const k of konturen) {
      const p = k.punkte.find((q) => q.x < -1e-6 || q.y < -1e-6 || q.x > grenze.breite + 1e-6 || q.y > grenze.hoehe + 1e-6);
      if (p) {
        pfade.push(k.pfad);
        stellen.push(p);
      }
    }
    return { pfade, stellen };
  };
  const matte = raus(optionen.bereich);
  ergebnisse.push(befund('ausserhalbMatte', new Set(matte.pfade).size, 'warnung', matte.pfade, matte.stellen));
  const dokument = raus({ breite: dok.breiteMm, hoehe: dok.hoeheMm });
  ergebnisse.push(befund('ausserhalbDokument', new Set(dokument.pfade).size, 'info', dokument.pfade, dokument.stellen));

  return ergebnisse;
}
