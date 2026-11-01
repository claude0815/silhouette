/**
 * Konturen versetzen (Offset): Umrisse um einen festen Abstand nach außen oder innen schieben,
 * z. B. für den weißen Rand eines Aufklebers.
 *
 * Das klingt einfach, ist mit Linien aber knifflig: Außen an Ecken entstehen Rundungen,
 * Ränder benachbarter Formen überschneiden sich und müssen verschmelzen, kleine Löcher
 * verschwinden. Darum rechnen wir über eine Abstandskarte:
 *
 *   1. Rastern: Die Formen werden fein gerastert (z. B. 0,1 mm je Zelle). Innen = 1, außen = 0.
 *   2. Abstandskarte: Für jede Zelle wird der Abstand zur nächsten Zelle der Form berechnet
 *      (euklidische Distanztransformation).
 *   3. Schwelle: Alle Zellen mit Abstand ≤ Versatz gehören zur neuen Form. Beim Versatz nach
 *      innen umgekehrt: Zellen der Form, die weiter als der Versatz vom Rand entfernt sind.
 *   4. Konturen: Aus dem neuen Raster werden mit Marching Squares wieder Linien, die mit
 *      Douglas-Peucker vereinfacht werden.
 *
 * Rundungen, Verschmelzen und verschwindende Löcher ergeben sich so von selbst.
 */
import type { Punkt } from '../cutter/types';
import type { Binaerbild } from '../pipeline/bilder';
import { findeKonturen } from '../pipeline/konturen';
import { vereinfacheGeschlossen } from '../pipeline/vereinfachen';
import { svgKonturen, type SvgDokument } from '../svg/dokument';

export interface Raster extends Binaerbild {
  /** Linke obere Ecke des Rasters in mm */
  x0: number;
  y0: number;
  /** Kantenlänge einer Zelle in mm */
  zelle: number;
}

/**
 * Rastert geschlossene Vielecke (in mm) nach der Gerade-Ungerade-Regel: Für jede Zeile werden
 * die Schnittpunkte mit allen Kanten gesucht und sortiert; zwischen dem 1. und 2., dem 3. und 4. …
 * Schnittpunkt liegt die Form (Scanline-Verfahren).
 */
export function rastere(vielecke: readonly Punkt[][], x0: number, y0: number, breite: number, hoehe: number, zelle: number): Raster {
  const daten = new Uint8Array(breite * hoehe);
  const schnitte: number[][] = Array.from({ length: hoehe }, () => []);
  for (const v of vielecke) {
    for (let i = 0; i < v.length; i++) {
      const a = v[i]!;
      const b = v[(i + 1) % v.length]!;
      if (a.y === b.y) continue;
      // Zeilen, deren Mittellinie die Kante kreuzt (halboffen, damit Ecken nicht doppelt zählen)
      const [oben, unten] = a.y < b.y ? [a, b] : [b, a];
      const z0 = Math.max(0, Math.ceil((oben.y - y0) / zelle - 0.5));
      const z1 = Math.min(hoehe - 1, Math.ceil((unten.y - y0) / zelle - 0.5) - 1);
      for (let z = z0; z <= z1; z++) {
        const y = y0 + (z + 0.5) * zelle;
        schnitte[z]!.push(oben.x + ((y - oben.y) / (unten.y - oben.y)) * (unten.x - oben.x));
      }
    }
  }
  schnitte.forEach((xs, z) => {
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // Zellen, deren Mittelpunkt zwischen den beiden Schnittpunkten liegt
      const s0 = Math.max(0, Math.ceil((xs[k]! - x0) / zelle - 0.5));
      const s1 = Math.min(breite - 1, Math.ceil((xs[k + 1]! - x0) / zelle - 0.5) - 1);
      for (let s = s0; s <= s1; s++) daten[z * breite + s] = 1;
    }
  });
  return { breite, hoehe, daten, x0, y0, zelle };
}

/**
 * Eindimensionale Distanztransformation (Felzenszwalb und Huttenlocher, 2012):
 * Für jede Stelle q das Minimum von (q − p)² + f(p) über alle p. Man stellt sich jede Stelle p als
 * nach oben geöffnete Parabel mit Scheitel bei (p | f(p)) vor; gesucht ist die untere Hüllkurve
 * aller Parabeln. Sie wird von links nach rechts aufgebaut – in linearer Zeit.
 */
function dt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    if (f[q] === Infinity) continue;
    // Schnittpunkt der Parabel von q mit der zuletzt gemerkten Parabel
    let s: number;
    for (;;) {
      const p = v[k]!;
      s = f[p] === Infinity ? -Infinity : (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
      if (s <= z[k]! && k > 0) k--;
      else break;
    }
    if (f[v[k]!] === Infinity) {
      v[k] = q; // die erste endliche Parabel ersetzt den Platzhalter
      z[k] = -Infinity;
    } else {
      k++;
      v[k] = q;
      z[k] = s;
    }
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const p = v[k]!;
    d[q] = f[p] === Infinity ? Infinity : (q - p) * (q - p) + f[p]!;
  }
}

/**
 * Quadrierter Abstand (in Zellen) jeder Zelle zur nächsten Zelle mit dem Wert `zu`.
 * Zweidimensional geht es in zwei Durchgängen: erst alle Spalten, dann alle Zeilen.
 */
export function abstandsquadrate(bild: Binaerbild, zu: 0 | 1): Float64Array {
  const { breite: b, hoehe: h } = bild;
  const ergebnis = new Float64Array(b * h);
  for (let i = 0; i < b * h; i++) ergebnis[i] = bild.daten[i] === zu ? 0 : Infinity;
  const n = Math.max(b, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < b; x++) {
    for (let y = 0; y < h; y++) f[y] = ergebnis[y * b + x]!;
    dt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) ergebnis[y * b + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) f[x] = ergebnis[y * b + x]!;
    dt1d(f, b, d, v, z);
    for (let x = 0; x < b; x++) ergebnis[y * b + x] = d[x]!;
  }
  return ergebnis;
}

export interface VersatzOptionen {
  /** Abstand in mm; positiv nach außen, negativ nach innen */
  abstandMm: number;
  /** Nur diese Pfade (Index in dok.pfade); ohne Angabe alle */
  pfade?: number[];
  /** Kantenlänge einer Rasterzelle in mm (Genauigkeit). Wird bei sehr großen Formen vergröbert. */
  zelleMm?: number;
  /** Höchstzahl der Rasterzellen (Rechenzeit) */
  maxZellen?: number;
}

export interface VersatzErgebnis {
  /** Neue Konturen in mm (geschlossen, letzter Punkt nicht wiederholt) */
  konturen: Punkt[][];
  /** Raster vorher und Abstandskarte (in mm) für die Anzeige */
  raster: Raster;
  abstandMm: Float64Array;
  /** Tatsächlich verwendete Zellgröße in mm */
  zelle: number;
}

/** Versetzt die geschlossenen Konturen des Dokuments (oder der gewählten Pfade). Null, wenn es keine gibt. */
export function versetze(dok: SvgDokument, o: VersatzOptionen): VersatzErgebnis | null {
  const vielecke = svgKonturen(dok)
    .filter((k) => (o.pfade ? o.pfade.includes(k.pfad) : true))
    .filter((k) => {
      const a = k.punkte[0]!;
      const e = k.punkte.at(-1)!;
      return k.geschlossen || (a.x === e.x && a.y === e.y);
    })
    .map((k) => k.punkte.slice(0, -1));
  if (vielecke.length === 0) return null;

  // Rahmen um alle Punkte, vergrößert um den Versatz und zwei Zellen Rand
  const xs = vielecke.flatMap((v) => v.map((p) => p.x));
  const ys = vielecke.flatMap((v) => v.map((p) => p.y));
  const rand = Math.max(0, o.abstandMm);
  const breiteMm = Math.max(...xs) - Math.min(...xs) + 2 * rand;
  const hoeheMm = Math.max(...ys) - Math.min(...ys) + 2 * rand;
  const maxZellen = o.maxZellen ?? 2_000_000;
  const zelle = Math.max(o.zelleMm ?? 0.1, Math.sqrt((breiteMm * hoeheMm) / maxZellen));
  const x0 = Math.min(...xs) - rand - 2 * zelle;
  const y0 = Math.min(...ys) - rand - 2 * zelle;
  const breite = Math.ceil(breiteMm / zelle) + 4;
  const hoehe = Math.ceil(hoeheMm / zelle) + 4;

  const raster = rastere(vielecke, x0, y0, breite, hoehe, zelle);
  const nachAussen = o.abstandMm >= 0;
  // Nach außen: Abstand zur Form; nach innen: Abstand zum Hintergrund
  const quadrate = abstandsquadrate(raster, nachAussen ? 1 : 0);
  const abstandMm = new Float64Array(quadrate.length);
  for (let i = 0; i < quadrate.length; i++) abstandMm[i] = Math.sqrt(quadrate[i]!) * zelle;

  // Schwelle. Gemessen wird von Zellmitte zu Zellmitte; der Rand der Form liegt eine halbe Zelle
  // weiter außen. Darum wird eine halbe Zelle dazugerechnet.
  const grenze = Math.abs(o.abstandMm) + zelle / 2;
  const neu = new Uint8Array(raster.daten.length);
  for (let i = 0; i < neu.length; i++) {
    neu[i] = nachAussen ? (abstandMm[i]! <= grenze ? 1 : 0) : raster.daten[i] && abstandMm[i]! > grenze ? 1 : 0;
  }

  // Zurück zu Linien: Marching Squares liefert Pixelkoordinaten, die in mm umgerechnet werden.
  // Douglas-Peucker mit einer Zelle Toleranz glättet die Rastertreppen (0,1 mm reicht zum Schneiden).
  const konturen = findeKonturen({ breite, hoehe, daten: neu })
    .map((k) => vereinfacheGeschlossen(k.punkte, 1).map((p) => ({ x: x0 + p.x * zelle, y: y0 + p.y * zelle })))
    .filter((k) => k.length >= 3);
  return { konturen, raster, abstandMm, zelle };
}

const zahl = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Fügt die versetzten Konturen als neuen Pfad in das SVG ein (vor </svg>), in den Koordinaten
 * der viewBox. Mit `ersetzen` werden die Ausgangsformen entfernt.
 */
export function versatzInSvg(
  text: string,
  dok: SvgDokument,
  konturen: readonly Punkt[][],
  o: { abstandMm: number; ersetzen: boolean; pfade?: number[] },
): string {
  const einheit = (p: Punkt) => `${zahl(p.x / dok.mmJeEinheit.x + dok.ursprung.x)} ${zahl(p.y / dok.mmJeEinheit.y + dok.ursprung.y)}`;
  const d = konturen.map((v) => v.map((p, i) => `${i === 0 ? 'M' : 'L'} ${einheit(p)}`).join(' ') + ' Z').join(' ');
  const richtung = o.abstandMm >= 0 ? 'außen' : 'innen';
  const neu = [
    `  <!-- Kontur um ${zahl(Math.abs(o.abstandMm))} mm nach ${richtung} versetzt -->`,
    `  <path fill="none" stroke="${o.ersetzen ? 'black' : '#dc2626'}" fill-rule="evenodd" d="${d}"/>`,
  ].join('\n');

  let ergebnis = text;
  if (o.ersetzen) {
    const weg = (o.pfade ?? dok.pfade.map((_, i) => i)).map((i) => dok.pfade[i]!.element);
    for (const e of [...weg].sort((a, b) => b.start - a.start)) {
      let von = e.start;
      let bis = e.elementEnde;
      while (von > 0 && (ergebnis[von - 1] === ' ' || ergebnis[von - 1] === '\t')) von--;
      if (ergebnis[bis] === '\n' && (von === 0 || ergebnis[von - 1] === '\n')) bis++;
      ergebnis = ergebnis.slice(0, von) + ergebnis.slice(bis);
    }
  }
  const schluss = ergebnis.lastIndexOf('</svg>');
  return schluss === -1 ? ergebnis + '\n' + neu + '\n' : ergebnis.slice(0, schluss) + neu + '\n' + ergebnis.slice(schluss);
}
