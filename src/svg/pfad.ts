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
 *   A rx ry drehung großerBogen imUhrzeigersinn x y   Ellipsenbogen bis (x | y)
 *   Z             Teilpfad schließen (zurück zum Anfang)
 * Großbuchstaben = absolute Koordinaten, Kleinbuchstaben = relativ zum aktuellen Punkt.
 * Folgen auf einen Befehl mehr Zahlen als nötig, wird er wiederholt (nach M als L).
 */
import type { Punkt } from '../cutter/types';

export type BefehlTyp = 'M' | 'L' | 'H' | 'V' | 'C' | 'S' | 'Q' | 'T' | 'A' | 'Z';

export const ANZAHL_WERTE: Record<BefehlTyp, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export interface Textstelle {
  start: number;
  ende: number;
}

export interface PfadBefehl {
  typ: BefehlTyp;
  relativ: boolean;
  werte: number[];
  /** Position im d-Text: erstes Zeichen und Ende (exklusiv), für die Markierung im Code */
  start: number;
  ende: number;
  /** Position jeder Zahl im Text – zum Ändern beim Ziehen von Punkten */
  zahlen: Textstelle[];
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

export interface PfadLesung {
  befehle: PfadBefehl[];
  /** Erster Fehler; die Befehle davor sind gültig und werden gezeichnet. */
  fehler?: { text: string; position: number };
}

const ZAHL = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

/**
 * Liest den d-Text Zeichen für Zeichen. Bei einem Fehler wird nicht abgebrochen:
 * Alle vollständigen Befehle davor bleiben erhalten (so macht es auch der Browser),
 * und die Fehlerstelle wird gemeldet.
 */
export function lesePfadTolerant(d: string): PfadLesung {
  const befehle: PfadBefehl[] = [];
  let aktuell: { typ: BefehlTyp; relativ: boolean; start: number; werte: number[]; zahlen: Textstelle[] } | null = null;
  let fehler: PfadLesung['fehler'];

  /** Schließt den laufenden Befehl ab und teilt Wiederholungen auf. */
  const abschliessen = (): boolean => {
    if (!aktuell) return true;
    const a = aktuell;
    aktuell = null;
    const n = ANZAHL_WERTE[a.typ];
    const name = a.relativ ? a.typ.toLowerCase() : a.typ;
    if (n === 0) {
      befehle.push({ typ: a.typ, relativ: a.relativ, werte: [], start: a.start, ende: a.start + 1, zahlen: [] });
      if (a.werte.length > 0) {
        fehler = { text: `Befehl ${name} erwartet keine Zahlen.`, position: a.zahlen[0]!.start };
        return false;
      }
      return true;
    }
    const gruppen = Math.floor(a.werte.length / n);
    for (let g = 0; g < gruppen; g++) {
      const zahlen = a.zahlen.slice(g * n, (g + 1) * n);
      befehle.push({
        // Nach M gelten weitere Zahlenpaare als L
        typ: g > 0 && a.typ === 'M' ? 'L' : a.typ,
        relativ: a.relativ,
        werte: a.werte.slice(g * n, (g + 1) * n),
        start: g === 0 ? a.start : zahlen[0]!.start,
        ende: zahlen[n - 1]!.ende,
        zahlen,
      });
    }
    if (a.werte.length === 0 || a.werte.length % n !== 0) {
      fehler = {
        text: `Befehl ${name} erwartet ${n} Zahlen (oder ein Vielfaches), hat aber ${a.werte.length}.`,
        // Fehlt schon im ersten Satz etwas, ist der Befehl selbst die Fehlerstelle, sonst die übrige Zahl
        position: gruppen === 0 ? a.start : a.zahlen[gruppen * n]!.start,
      };
      return false;
    }
    return true;
  };

  let pos = 0;
  while (pos < d.length) {
    const z = d[pos]!;
    if (/[\s,]/.test(z)) {
      pos++;
      continue;
    }
    if (/[a-zA-Z]/.test(z)) {
      if (!abschliessen()) return { befehle, fehler };
      const typ = z.toUpperCase() as BefehlTyp;
      if (!(typ in ANZAHL_WERTE)) return { befehle, fehler: { text: `Unbekannter Befehl „${z}“.`, position: pos } };
      if (befehle.length === 0 && typ !== 'M') return { befehle, fehler: { text: 'Ein Pfad muss mit M beginnen.', position: pos } };
      aktuell = { typ, relativ: z === z.toLowerCase(), start: pos, werte: [], zahlen: [] };
      pos++;
      continue;
    }
    if (/[+\-.\d]/.test(z)) {
      if (!aktuell) return { befehle, fehler: { text: 'Ein Pfad muss mit einem Befehl beginnen, meist M.', position: pos } };
      // Bei A sind die Werte 4 und 5 Schalter (0 oder 1) und dürfen ohne Trennzeichen stehen: „A 5 5 0 01 10 10“
      const stelle = aktuell.werte.length % 7;
      if (aktuell.typ === 'A' && (stelle === 3 || stelle === 4)) {
        if (z !== '0' && z !== '1') return { befehle, fehler: { text: 'Bei A müssen die Werte 4 und 5 jeweils 0 oder 1 sein.', position: pos } };
        aktuell.werte.push(Number(z));
        aktuell.zahlen.push({ start: pos, ende: pos + 1 });
        pos++;
        continue;
      }
      ZAHL.lastIndex = pos;
      const m = ZAHL.exec(d);
      if (!m) return { befehle, fehler: { text: `Unerwartetes Zeichen „${z}“.`, position: pos } };
      aktuell.werte.push(Number(m[0]));
      aktuell.zahlen.push({ start: pos, ende: pos + m[0].length });
      pos += m[0].length;
      continue;
    }
    abschliessen();
    return { befehle, fehler: fehler ?? { text: `Unerwartetes Zeichen „${z}“.`, position: pos } };
  }
  abschliessen();
  return fehler ? { befehle, fehler } : { befehle };
}

/** Wie lesePfadTolerant, wirft aber beim ersten Fehler einen PfadFehler. */
export function lesePfad(d: string): PfadBefehl[] {
  const r = lesePfadTolerant(d);
  if (r.fehler) throw new PfadFehler(r.fehler.text, r.fehler.position);
  return r.befehle;
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
 * Ellipsenbogen → kubische Bézier-Kurven (Verfahren aus der SVG-Spezifikation, Anhang F.6).
 *
 * Ein Bogen ist durch Anfang, Ende, die Radien rx und ry, die Drehung der Ellipse und zwei
 * Schalter festgelegt: Durch zwei Punkte passen meist zwei Ellipsen, und auf jeder gibt es
 * einen kurzen und einen langen Weg. „großerBogen“ wählt den langen, „imUhrzeigersinn“ die
 * Richtung. Gerechnet wird so:
 *   1. Mittelpunkt der Ellipse und Start- und Öffnungswinkel bestimmen.
 *   2. Den Bogen in Stücke von höchstens 90° teilen.
 *   3. Jedes Stück durch eine kubische Kurve annähern: Für ein Kreisstück mit Winkel δ liegen
 *      die Kontrollpunkte k = 4/3 · tan(δ/4) Radien entlang der Tangente. Der Fehler ist winzig
 *      (bei 90° etwa 0,03 % des Radius).
 */
export function bogenZuBeziers(
  von: Punkt,
  rxEin: number,
  ryEin: number,
  drehungGrad: number,
  grosserBogen: boolean,
  imUhrzeigersinn: boolean,
  nach: Punkt,
): Array<{ typ: 'L'; p: Punkt } | { typ: 'C'; c1: Punkt; c2: Punkt; p: Punkt }> {
  if (von.x === nach.x && von.y === nach.y) return [];
  let rx = Math.abs(rxEin);
  let ry = Math.abs(ryEin);
  if (rx === 0 || ry === 0) return [{ typ: 'L', p: nach }]; // ohne Radius: gerade Strecke

  const phi = (drehungGrad * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // Anfangspunkt im gedrehten System, bezogen auf die Mitte der Sehne
  const dx = (von.x - nach.x) / 2;
  const dy = (von.y - nach.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  // Zu kleine Radien so weit vergrößern, dass der Bogen gerade hinreicht
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const zaehler = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const nenner = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const faktor = (grosserBogen === imUhrzeigersinn ? -1 : 1) * Math.sqrt(Math.max(0, zaehler / nenner));
  const cxs = (faktor * rx * y1) / ry;
  const cys = (-faktor * ry * x1) / rx;
  const cx = cos * cxs - sin * cys + (von.x + nach.x) / 2;
  const cy = sin * cxs + cos * cys + (von.y + nach.y) / 2;

  const winkel = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = winkel(1, 0, (x1 - cxs) / rx, (y1 - cys) / ry);
  let delta = winkel((x1 - cxs) / rx, (y1 - cys) / ry, (-x1 - cxs) / rx, (-y1 - cys) / ry);
  if (!imUhrzeigersinn && delta > 0) delta -= 2 * Math.PI;
  if (imUhrzeigersinn && delta < 0) delta += 2 * Math.PI;

  const anzahl = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const schritt = delta / anzahl;
  const k = (4 / 3) * Math.tan(schritt / 4);
  // Punkt auf dem Einheitskreis → Punkt auf der gedrehten, verschobenen Ellipse
  const aufEllipse = (ux: number, uy: number): Punkt => ({
    x: cx + rx * cos * ux - ry * sin * uy,
    y: cy + rx * sin * ux + ry * cos * uy,
  });
  const stuecke: Array<{ typ: 'C'; c1: Punkt; c2: Punkt; p: Punkt }> = [];
  for (let i = 0; i < anzahl; i++) {
    const a = theta1 + i * schritt;
    const b = a + schritt;
    stuecke.push({
      typ: 'C',
      c1: aufEllipse(Math.cos(a) - k * Math.sin(a), Math.sin(a) + k * Math.cos(a)),
      c2: aufEllipse(Math.cos(b) + k * Math.sin(b), Math.sin(b) - k * Math.cos(b)),
      p: i === anzahl - 1 ? nach : aufEllipse(Math.cos(b), Math.sin(b)),
    });
  }
  return stuecke;
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
        case 'A': {
          const ziel = b.relativ ? { x: aktuell.x + w[5]!, y: aktuell.y + w[6]! } : { x: w[5]!, y: w[6]! };
          const stuecke = bogenZuBeziers(aktuell, w[0]!, w[1]!, w[2]!, w[3] === 1, w[4] === 1, ziel);
          for (const st of stuecke) tp.abschnitte.push({ ...st, befehl: nr });
          aktuell = ziel;
          letzterC = null;
          letzterQ = null;
          return;
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
  | { art: 'kurve'; von: Punkt; c1: Punkt; c2: Punkt; p: Punkt }
  /** Ein Bogen (A) besteht aus mehreren Kurvenstücken. */
  | { art: 'bogen'; von: Punkt; stuecke: Array<{ c1: Punkt; c2: Punkt; p: Punkt }>; p: Punkt };

/** Geometrie je Befehl (Index wie in `befehle`); Befehle ohne eigene Linie fehlen. */
export function befehlsGeometrie(befehle: readonly PfadBefehl[]): Map<number, BefehlsGeometrie> {
  const ergebnis = new Map<number, BefehlsGeometrie>();
  for (const tp of alsTeilpfade(befehle)) {
    if (tp.startBefehl >= 0) ergebnis.set(tp.startBefehl, { art: 'punkt', p: tp.start });
    let von = tp.start;
    for (const a of tp.abschnitte) {
      const bisher = ergebnis.get(a.befehl);
      if (befehle[a.befehl]?.typ === 'A' && a.typ === 'C') {
        // Stücke desselben Bogens sammeln
        if (bisher?.art === 'bogen') {
          bisher.stuecke.push({ c1: a.c1, c2: a.c2, p: a.p });
          bisher.p = a.p;
        } else ergebnis.set(a.befehl, { art: 'bogen', von, stuecke: [{ c1: a.c1, c2: a.c2, p: a.p }], p: a.p });
      } else {
        ergebnis.set(a.befehl, a.typ === 'L' ? { art: 'strecke', von, p: a.p } : { art: 'kurve', von, c1: a.c1, c2: a.c2, p: a.p });
      }
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
      const stuecke = g.art === 'kurve' ? [g] : g.stuecke;
      let von = g.von;
      for (const st of stuecke) {
        zerlegeBezier(von, st.c1, st.c2, st.p, toleranz, punkte);
        von = st.p;
      }
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
