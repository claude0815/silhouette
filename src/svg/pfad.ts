/**
 * Das d-Attribut eines SVG-<path> lesen und in Linienzüge zerlegen.
 *
 * Ein Pfad ist eine Folge von Befehlen, jeweils ein Buchstabe mit Zahlen dahinter:
 *   M x y         „move to“: Stift anheben und an (x | y) aufsetzen; beginnt einen Teilpfad
 *   L x y         „line to“: Strecke bis (x | y)
 *   H x / V y     waagerechte bzw. senkrechte Strecke
 *   C x1 y1 x2 y2 x y   kubische Bézier-Kurve mit zwei Kontrollpunkten
 *   S x2 y2 x y   wie C, der erste Kontrollpunkt wird am vorigen gespiegelt
 *   Q x1 y1 x y   quadratische Bézier-Kurve mit einem Kontrollpunkt
 *   T x y         wie Q, Kontrollpunkt gespiegelt
 *   Z             Teilpfad schließen (zurück zum Anfang)
 * Großbuchstaben = absolute Koordinaten, Kleinbuchstaben = relativ zum aktuellen Punkt.
 * Folgen auf einen Befehl mehr Zahlen als nötig, wird er wiederholt (nach M als L).
 *
 * Bögen (A) kommen in einer späteren Stufe dazu.
 */
import type { Punkt } from '../cutter/types';

export type BefehlTyp = 'M' | 'L' | 'H' | 'V' | 'C' | 'S' | 'Q' | 'T' | 'Z';

const ANZAHL_WERTE: Record<BefehlTyp, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

export interface PfadBefehl {
  typ: BefehlTyp;
  relativ: boolean;
  werte: number[];
  /** Position im d-Text: erstes Zeichen und Ende (exklusiv), für die Markierung im Code */
  start: number;
  ende: number;
}

export class PfadFehler extends Error {
  override name = 'PfadFehler';
  constructor(
    message: string,
    /** Stelle im d-Text */
    readonly position: number,
  ) {
    super(message);
  }
}

/** Zerlegt den d-Text in Befehle. Wirft PfadFehler mit der Stelle des Fehlers. */
export function lesePfad(d: string): PfadBefehl[] {
  const befehle: PfadBefehl[] = [];
  // Ein Wort ist ein Befehlsbuchstabe oder eine Zahl (auch „-1.5e-3“ oder „.5“).
  const muster = /([MmLlHhVvCcSsQqTtZzAa])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([^\s,])/g;
  let aktuell: PfadBefehl | null = null;
  let m: RegExpExecArray | null;

  const abschliessen = () => {
    if (!aktuell) return;
    const n = ANZAHL_WERTE[aktuell.typ];
    if (n === 0 ? aktuell.werte.length > 0 : aktuell.werte.length === 0 || aktuell.werte.length % n !== 0) {
      throw new PfadFehler(
        `Befehl ${aktuell.relativ ? aktuell.typ.toLowerCase() : aktuell.typ} erwartet ${n === 0 ? 'keine' : `${n}`} Zahlen` +
          (n > 0 ? ` (oder ein Vielfaches), hat aber ${aktuell.werte.length}.` : '.'),
        aktuell.start,
      );
    }
    // Wiederholungen aufteilen, damit jeder Befehl genau einen Satz Zahlen hat
    if (n > 0 && aktuell.werte.length > n) {
      const { werte, relativ, start, ende } = aktuell;
      const folgeTyp: BefehlTyp = aktuell.typ === 'M' ? 'L' : aktuell.typ;
      for (let i = 0; i < werte.length; i += n) {
        befehle.push({ typ: i === 0 ? aktuell.typ : folgeTyp, relativ, werte: werte.slice(i, i + n), start, ende });
      }
    } else {
      befehle.push(aktuell);
    }
    aktuell = null;
  };

  while ((m = muster.exec(d)) !== null) {
    if (m[1]) {
      abschliessen();
      const buchstabe = m[1];
      if (buchstabe === 'A' || buchstabe === 'a') {
        throw new PfadFehler('Bögen (A) werden noch nicht unterstützt.', m.index);
      }
      aktuell = {
        typ: buchstabe.toUpperCase() as BefehlTyp,
        relativ: buchstabe === buchstabe.toLowerCase(),
        werte: [],
        start: m.index,
        ende: m.index + 1,
      };
    } else if (m[2]) {
      if (!aktuell) throw new PfadFehler('Ein Pfad muss mit einem Befehl beginnen, meist M.', m.index);
      aktuell.werte.push(Number(m[2]));
      aktuell.ende = m.index + m[2].length;
    } else {
      throw new PfadFehler(`Unerwartetes Zeichen „${m[3]}“.`, m.index);
    }
  }
  abschliessen();
  if (befehle.length > 0 && befehle[0]!.typ !== 'M') {
    throw new PfadFehler('Ein Pfad muss mit M beginnen.', befehle[0]!.start);
  }
  return befehle;
}

/**
 * Ein Abschnitt eines Teilpfads in absoluten Koordinaten.
 * `befehl` ist der Index des Befehls, aus dem er entstand – für die Markierung im Code.
 */
export type Abschnitt = ({ typ: 'L'; p: Punkt } | { typ: 'C'; c1: Punkt; c2: Punkt; p: Punkt }) & { befehl: number };

export interface Teilpfad {
  start: Punkt;
  /** Index des M-Befehls (−1, wenn der Teilpfad ohne M nach einem Z weitergeht) */
  startBefehl: number;
  abschnitte: Abschnitt[];
  geschlossen: boolean;
}

/**
 * Rechnet alle Befehle in absolute Koordinaten um und fasst sie zu Teilpfaden zusammen.
 * H, V werden zu L; S, Q, T werden zu C (eine quadratische Kurve lässt sich exakt als
 * kubische schreiben: die Kontrollpunkte liegen bei 2/3 des Wegs zum Q-Kontrollpunkt).
 */
export function alsTeilpfade(befehle: readonly PfadBefehl[]): Teilpfad[] {
  const teilpfade: Teilpfad[] = [];
  let tp: Teilpfad | null = null;
  let aktuell: Punkt = { x: 0, y: 0 };
  let start: Punkt = { x: 0, y: 0 };
  // Letzter Kontrollpunkt für S und T
  let letzterC: Punkt | null = null;
  let letzterQ: Punkt | null = null;

  befehle.forEach((b, nr) => {
    const w = b.werte;
    const abs = (i: number): Punkt =>
      b.relativ ? { x: aktuell.x + w[i]!, y: aktuell.y + w[i + 1]! } : { x: w[i]!, y: w[i + 1]! };
    const spiegel = (k: Punkt | null): Punkt => (k ? { x: 2 * aktuell.x - k.x, y: 2 * aktuell.y - k.y } : aktuell);
    let neuC: Punkt | null = null;
    let neuQ: Punkt | null = null;

    if (b.typ === 'M') {
      aktuell = abs(0);
      start = aktuell;
      tp = { start, startBefehl: nr, abschnitte: [], geschlossen: false };
      teilpfade.push(tp);
    } else if (b.typ === 'Z') {
      if (tp) {
        tp.geschlossen = true;
        if (aktuell.x !== start.x || aktuell.y !== start.y) tp.abschnitte.push({ typ: 'L', p: start, befehl: nr });
      }
      aktuell = start;
      tp = null;
    } else {
      if (!tp) {
        // Nach Z ohne neues M geht es am Anfangspunkt weiter
        tp = { start: aktuell, startBefehl: -1, abschnitte: [], geschlossen: false };
        teilpfade.push(tp);
      }
      let a: Abschnitt;
      switch (b.typ) {
        case 'L':
          a = { typ: 'L', p: abs(0), befehl: nr };
          break;
        case 'H':
          a = { typ: 'L', p: { x: b.relativ ? aktuell.x + w[0]! : w[0]!, y: aktuell.y }, befehl: nr };
          break;
        case 'V':
          a = { typ: 'L', p: { x: aktuell.x, y: b.relativ ? aktuell.y + w[0]! : w[0]! }, befehl: nr };
          break;
        case 'C':
          a = { typ: 'C', c1: abs(0), c2: abs(2), p: abs(4), befehl: nr };
          neuC = a.c2;
          break;
        case 'S':
          a = { typ: 'C', c1: spiegel(letzterC), c2: abs(0), p: abs(2), befehl: nr };
          neuC = a.c2;
          break;
        case 'Q':
        case 'T': {
          const q: Punkt = b.typ === 'Q' ? abs(0) : spiegel(letzterQ);
          const p: Punkt = b.typ === 'Q' ? abs(2) : abs(0);
          a = {
            typ: 'C',
            c1: { x: aktuell.x + (2 / 3) * (q.x - aktuell.x), y: aktuell.y + (2 / 3) * (q.y - aktuell.y) },
            c2: { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
            p,
            befehl: nr,
          };
          neuQ = q;
          break;
        }
      }
      tp.abschnitte.push(a);
      aktuell = a.p;
    }
    letzterC = neuC;
    letzterQ = neuQ;
  });
  return teilpfade;
}

/** Was ein einzelner Befehl zeichnet – für die Markierung in der Grafik. */
export type BefehlsGeometrie =
  | { art: 'punkt'; p: Punkt }
  | { art: 'strecke'; von: Punkt; p: Punkt }
  | { art: 'kurve'; von: Punkt; c1: Punkt; c2: Punkt; p: Punkt };

/** Geometrie je Befehl (Index wie in `befehle`); Befehle ohne eigene Linie fehlen. */
export function befehlsGeometrie(befehle: readonly PfadBefehl[]): Map<number, BefehlsGeometrie> {
  const ergebnis = new Map<number, BefehlsGeometrie>();
  for (const tp of alsTeilpfade(befehle)) {
    if (tp.startBefehl >= 0) ergebnis.set(tp.startBefehl, { art: 'punkt', p: tp.start });
    let von = tp.start;
    for (const a of tp.abschnitte) {
      ergebnis.set(a.befehl, a.typ === 'L' ? { art: 'strecke', von, p: a.p } : { art: 'kurve', von, c1: a.c1, c2: a.c2, p: a.p });
      von = a.p;
    }
  }
  return ergebnis;
}

/**
 * Welcher Befehl zeichnet die Linie, die dem Punkt p am nächsten liegt?
 * Kurven werden dafür grob in Strecken zerlegt.
 */
export function naechsterBefehl(geometrie: ReadonlyMap<number, BefehlsGeometrie>, p: Punkt, toleranz: number): number | null {
  let bester: number | null = null;
  let besterAbstand = Infinity;
  const strecke = (a: Punkt, b: Punkt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  for (const [nr, g] of geometrie) {
    let d: number;
    if (g.art === 'punkt') d = Math.hypot(p.x - g.p.x, p.y - g.p.y);
    else if (g.art === 'strecke') d = strecke(g.von, g.p);
    else {
      const punkte = [g.von];
      zerlegeBezier(g.von, g.c1, g.c2, g.p, toleranz, punkte);
      d = Infinity;
      for (let i = 1; i < punkte.length; i++) d = Math.min(d, strecke(punkte[i - 1]!, punkte[i]!));
    }
    if (d < besterAbstand) {
      besterAbstand = d;
      bester = nr;
    }
  }
  return bester;
}

/**
 * Zerlegt eine Bézier-Kurve in kurze Strecken („flattening“).
 * Ist die Kurve fast gerade – beide Kontrollpunkte liegen näher als `toleranz` an der
 * Sehne –, genügt eine Strecke. Sonst wird sie in der Mitte geteilt (de-Casteljau-Verfahren)
 * und beide Hälften werden genauso behandelt.
 */
export function zerlegeBezier(p0: Punkt, c1: Punkt, c2: Punkt, p3: Punkt, toleranz: number, ziel: Punkt[], tiefe = 0): void {
  const abstand = (p: Punkt) => {
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const l = Math.hypot(dx, dy);
    if (l === 0) return Math.hypot(p.x - p0.x, p.y - p0.y);
    return Math.abs((p.x - p0.x) * dy - (p.y - p0.y) * dx) / l;
  };
  if (tiefe >= 16 || Math.max(abstand(c1), abstand(c2)) <= toleranz) {
    ziel.push(p3);
    return;
  }
  const mitte = (a: Punkt, b: Punkt): Punkt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const a = mitte(p0, c1);
  const b = mitte(c1, c2);
  const c = mitte(c2, p3);
  const d = mitte(a, b);
  const e = mitte(b, c);
  const m = mitte(d, e); // Punkt auf der Kurve bei t = 0,5
  zerlegeBezier(p0, a, d, m, toleranz, ziel, tiefe + 1);
  zerlegeBezier(m, e, c, p3, toleranz, ziel, tiefe + 1);
}

/** Ein Teilpfad als Linienzug. Geschlossene Teilpfade enden wieder am Anfangspunkt. */
export function alsLinienzug(tp: Teilpfad, toleranz: number): Punkt[] {
  const punkte: Punkt[] = [tp.start];
  let von = tp.start;
  for (const a of tp.abschnitte) {
    if (a.typ === 'L') punkte.push(a.p);
    else zerlegeBezier(von, a.c1, a.c2, a.p, toleranz, punkte);
    von = a.p;
  }
  return punkte;
}
