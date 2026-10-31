/**
 * Schritt 8: SVG erzeugen – aus Konturen in Pixeln wird ein SVG-Dokument in Millimetern.
 *
 * Aufbau des Dokuments:
 *
 *   <svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="60mm" viewBox="0 0 80 60">
 *     <path id="form-1" fill-rule="evenodd" d="M 10 10 L 70 10 … Z M 30 30 … Z"/>
 *   </svg>
 *
 * - width/height mit „mm“ sagen, wie groß das Dokument in Wirklichkeit ist.
 * - viewBox legt das Koordinatensystem fest: 0 bis 80 in x, 0 bis 60 in y.
 *   Weil das genau der Breite und Höhe in mm entspricht, ist 1 Einheit = 1 mm.
 * - Jede Form (eine Außenkontur mit ihren Löchern) ist ein <path>. Sein d-Attribut
 *   enthält mehrere Teilpfade, je einer pro Kontur, jeweils mit M begonnen und Z geschlossen.
 * - fill-rule="evenodd": Ein Punkt gilt als innen, wenn ein Strahl von ihm aus eine
 *   ungerade Zahl von Konturen kreuzt. Deshalb bleibt ein Loch leer – wie beim „O“.
 *
 * Pfadbefehle: M = „move to“ (Stift anheben und hinsetzen), L = „line to“ (Strecke),
 * C = kubische Bézier-Kurve, Z = zurück zum Anfang (schließen).
 */
import type { Punkt } from './bilder';
import { istGerade, type Bezierpfad } from './glaetten';

/** Eine Form: Außenkontur und Löcher, je als Vieleck oder als Bézier-Pfad, in Pixeln. */
export interface SvgForm {
  aussen: Punkt[] | Bezierpfad;
  loecher: Array<Punkt[] | Bezierpfad>;
}

export interface SvgOptionen {
  /** Breite der Bildfläche in Pixeln. */
  bildBreitePx: number;
  /** Höhe der Bildfläche in Pixeln. */
  bildHoehePx: number;
  /** Gewünschte Breite in mm; die Höhe ergibt sich aus dem Seitenverhältnis. */
  breiteMm: number;
  /** Verschiebung in mm, z. B. Abstand vom Mattenrand. */
  position?: Punkt;
  /** Nachkommastellen; 2 Stellen = 0,01 mm, feiner als der Cutter (0,05 mm). */
  stellen?: number;
}

/** Zahl für SVG: Punkt als Dezimaltrennzeichen, ohne überflüssige Nullen. */
export function svgZahl(n: number, stellen = 2): string {
  const f = 10 ** stellen;
  const r = Math.round(n * f) / f;
  return (Object.is(r, -0) ? 0 : r).toString();
}

function istBezier(k: Punkt[] | Bezierpfad): k is Bezierpfad {
  return !Array.isArray(k);
}

/** Pfaddaten (d-Attribut) für eine Kontur. `pt` rechnet einen Pixelpunkt in Text um. */
export function teilpfad(kontur: Punkt[] | Bezierpfad, pt: (p: Punkt) => string): string {
  if (!istBezier(kontur)) {
    const [erster, ...rest] = kontur;
    if (!erster) return '';
    return [`M ${pt(erster)}`, ...rest.map((p) => `L ${pt(p)}`), 'Z'].join(' ');
  }
  const teile = [`M ${pt(kontur.start)}`];
  let von = kontur.start;
  // Das letzte Segment endet am Start; das erledigt Z – außer es ist eine Kurve.
  kontur.segmente.forEach((s, i) => {
    const letztes = i === kontur.segmente.length - 1;
    if (istGerade(von, s)) {
      if (!letztes) teile.push(`L ${pt(s.p)}`);
    } else {
      teile.push(`C ${pt(s.c1)} ${pt(s.c2)} ${pt(s.p)}`);
    }
    von = s.p;
  });
  teile.push('Z');
  return teile.join(' ');
}

export interface SvgErgebnis {
  text: string;
  breiteMm: number;
  hoeheMm: number;
  /** Millimeter pro Pixel */
  massstab: number;
}

/** Erzeugt das SVG-Dokument als Text. */
export function erzeugeSvg(formen: readonly SvgForm[], o: SvgOptionen): SvgErgebnis {
  const stellen = o.stellen ?? 2;
  const massstab = o.breiteMm / o.bildBreitePx;
  const pos = o.position ?? { x: 0, y: 0 };
  const breiteMm = pos.x + o.breiteMm;
  const hoeheMm = pos.y + o.bildHoehePx * massstab;
  const z = (n: number) => svgZahl(n, stellen);
  const pt = (p: Punkt) => `${z(pos.x + p.x * massstab)} ${z(pos.y + p.y * massstab)}`;

  const zeilen = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${z(breiteMm)}mm" height="${z(hoeheMm)}mm" viewBox="0 0 ${z(breiteMm)} ${z(hoeheMm)}">`,
  ];
  formen.forEach((f, i) => {
    const d = [f.aussen, ...f.loecher].map((k) => teilpfad(k, pt)).join(' ');
    zeilen.push(`  <path id="form-${i + 1}" fill-rule="evenodd" d="${d}"/>`);
  });
  zeilen.push('</svg>');
  return { text: zeilen.join('\n') + '\n', breiteMm, hoeheMm, massstab };
}
