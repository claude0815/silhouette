/**
 * Prüfungen der Mini-Aufgaben. Jede Prüfung bekommt das gelesene Dokument und meldet,
 * ob die Aufgabe gelöst ist. Gemessen wird in mm, also so, wie der Cutter es sieht.
 */
import { pruefe } from '../checks/cutter-checks';
import { beispiele as texte, type BeispielText } from '../i18n/beispiele.de';
import { attribut, svgKonturen, type SvgDokument } from '../svg/dokument';

const NAH = 0.15; // Toleranz in mm

interface Rahmen {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  breite: number;
  hoehe: number;
}

/** Umschließendes Rechteck in mm, für alle Pfade oder nur Pfad i */
export function rahmen(dok: SvgDokument, pfad?: number): Rahmen | null {
  const punkte = svgKonturen(dok)
    .filter((k) => pfad === undefined || k.pfad === pfad)
    .flatMap((k) => k.punkte);
  if (punkte.length === 0) return null;
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return { ...r, breite: r.x1 - r.x0, hoehe: r.y1 - r.y0 };
}

const nah = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= NAH;
const befund = (dok: SvgDokument, id: string) =>
  pruefe(dok, { bereich: { breite: 304.8, hoehe: 304.8 } }).find((b) => b.id === id)?.anzahl ?? -1;

type Pruefung = (dok: SvgDokument) => boolean;

/** Prüfungen je Beispiel-id und Aufgaben-id */
const PRUEFUNGEN: Record<string, Record<string, Pruefung>> = {
  rechteck: {
    breite40: (d) => nah(rahmen(d, 0)?.breite, 40),
    ecke: (d) => nah(rahmen(d, 0)?.x0, 20) && nah(rahmen(d, 0)?.y0, 15),
  },
  kreis: {
    radius15: (d) => nah(rahmen(d, 0)?.breite, 30) && nah(rahmen(d, 0)?.hoehe, 30),
    ellipse: (d) => d.pfade[0]?.name === 'ellipse' && nah(rahmen(d, 0)?.breite, 60) && nah(rahmen(d, 0)?.hoehe, 30),
  },
  dreieck: {
    schliessen: (d) => svgKonturen(d).length > 0 && befund(d, 'offen') === 0 && befund(d, 'fastGeschlossen') === 0,
    viereck: (d) => {
      const p = d.pfade[0];
      const ecken = p?.befehle.filter((b) => b.typ !== 'Z').length ?? 0;
      return befund(d, 'offen') === 0 && ecken === 4;
    },
  },
  relativ: {
    verschieben: (d) => nah(rahmen(d, 1)?.x0, 70) && nah(rahmen(d, 1)?.y0, 10) && nah(rahmen(d, 1)?.breite, 20),
    groesser: (d) => nah(rahmen(d, 0)?.x0, 10) && nah(rahmen(d, 0)?.y0, 10) && nah(rahmen(d, 0)?.breite, 30) && nah(rahmen(d, 0)?.hoehe, 30),
  },
  bezier: {
    // Ausbeulen nach oben: Die Kurve geht deutlich über ihre beiden Endpunkte hinaus nach oben
    nachOben: (d) => {
      const k = svgKonturen(d)[0];
      if (!k) return false;
      const ende = Math.min(k.punkte[0]!.y, k.punkte.at(-1)!.y);
      return Math.min(...k.punkte.map((p) => p.y)) < ende - 3 && Math.max(...k.punkte.map((p) => p.y)) <= Math.max(k.punkte[0]!.y, k.punkte.at(-1)!.y) + 0.5;
    },
    // Welle: Die Kurve liegt sowohl deutlich unter als auch deutlich über der Verbindungslinie
    welle: (d) => {
      const k = svgKonturen(d)[0];
      if (!k) return false;
      const a = k.punkte[0]!;
      const b = k.punkte.at(-1)!;
      const seite = (p: { x: number; y: number }) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const s = k.punkte.map((p) => seite(p) / l);
      return Math.max(...s) > 3 && Math.min(...s) < -3;
    },
  },
  loch: {
    evenodd: (d) => d.pfade[0]?.stil.fuellregel === 'evenodd',
  },
  schablone: {
    bruecken: (d) => svgKonturen(d).length >= 2 && befund(d, 'inseln') === 0 && befund(d, 'offen') === 0,
  },
  transform: {
    rechts: (d) => {
      const r = rahmen(d);
      const pts = attribut(d.pfade[0]!.element, 'points')?.wert.replace(/\s+/g, ' ').trim();
      return nah(r?.x0, 50) && nah(r?.y0, 15) && pts === '0,-20 6,-6 20,-6 9,3 13,18 0,9 -13,18 -9,3 -20,-6 -6,-6';
    },
    doppelt: (d) => nah(rahmen(d)?.breite, 80) && nah(rahmen(d)?.hoehe, 76),
  },
  matte: {
    rein: (d) => d.pfade.length === 2 && befund(d, 'ausserhalbDokument') === 0 && befund(d, 'ausserhalbMatte') === 0,
  },
  luecke: {
    zu: (d) => befund(d, 'fastGeschlossen') === 0 && befund(d, 'offen') === 0 && svgKonturen(d).length === 1,
  },
};

export interface Aufgabe {
  id: string;
  text: string;
  tipp?: string;
  loesung?: string;
  pruefe?: Pruefung;
}

export interface Beispiel extends Omit<BeispielText, 'aufgaben'> {
  aufgaben: Aufgabe[];
}

export const beispiele: Beispiel[] = texte.map((b) => ({
  ...b,
  aufgaben: b.aufgaben.map((a) => ({ ...a, pruefe: PRUEFUNGEN[b.id]?.[a.id] })),
}));
