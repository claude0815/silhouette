/**
 * Ein SVG-Dokument lesen: Größe in mm, viewBox, Gruppen, Formen und Pfade mit ihrer
 * Stelle im Text.
 *
 * Das SVG-Dokument ist die gemeinsame Grundlage der App: Simulation, Export und Cutter
 * lesen nur daraus. Darum steht hier auch die Umrechnung in Linienzüge in mm.
 *
 * Bewusst ein kleiner, eigener Leser statt DOMParser: Er läuft auch im Web Worker und in
 * den Tests, er kennt die Stelle jedes Elements und jeder Zahl im Text (für die verknüpfte
 * Ansicht und das Ziehen von Punkten), und er bricht bei Fehlern nicht ab, sondern sammelt
 * Hinweise.
 *
 * Unterstützt: <svg>, <g>, <path>, <rect>, <circle>, <ellipse>, <line>, <polyline>,
 * <polygon>, transform, fill, stroke, fill-rule (als Attribut oder in style, vererbt).
 * Formen werden in Pfadbefehle umgerechnet – so, wie der Cutter sie braucht.
 */
import type { Polylinie, Punkt } from '../cutter/types';
import { alsLinienzug, alsTeilpfade, lesePfadTolerant, type PfadBefehl } from './pfad';
import { EINHEITSMATRIX, leseTransform, mal, massstab, wende, type Matrix } from './transform';

export interface Attribut {
  name: string;
  wert: string;
  /** Stelle des Werts im Dokumenttext */
  start: number;
  ende: number;
}

export interface SvgElement {
  name: string;
  attribute: Attribut[];
  /** Stelle des Start-Tags im Text */
  start: number;
  ende: number;
  /** Ende des ganzen Elements einschließlich Inhalt und End-Tag */
  elementEnde: number;
  /** Index des Elternelements in der Elementliste, −1 für das oberste */
  eltern: number;
}

export interface Stil {
  /** Füllfarbe, null = keine Füllung */
  fuellung: string | null;
  /** Konturfarbe, null = keine Kontur */
  kontur: string | null;
  fuellregel: 'nonzero' | 'evenodd';
}

export interface SvgPfad {
  id?: string;
  /** path, rect, circle, … */
  name: string;
  element: SvgElement;
  /**
   * Pfadbefehle. Bei <path> beziehen sich ihre Textstellen auf den Dokumenttext,
   * bei Formen auf `umgerechnet`.
   */
  befehle: PfadBefehl[];
  /** Bei Formen: die Umrechnung als d-Text, z. B. für <rect> „M 10 10 H 50 V 30 H 10 Z“ */
  umgerechnet?: string;
  /** Gesamte Transformation bis ins Koordinatensystem der viewBox */
  matrix: Matrix;
  stil: Stil;
}

export interface Hinweis {
  text: string;
  position?: number;
  ende?: number;
  art: 'hinweis' | 'fehler';
}

export interface SvgDokument {
  breiteMm: number;
  hoeheMm: number;
  /** Millimeter je Einheit des Koordinatensystems (aus width und viewBox) */
  mmJeEinheit: { x: number; y: number };
  /** Verschiebung durch den Anfang der viewBox */
  ursprung: Punkt;
  /** viewBox: minX, minY, Breite, Höhe (in Einheiten) */
  viewBox: [number, number, number, number];
  elemente: SvgElement[];
  pfade: SvgPfad[];
  hinweise: Hinweis[];
}

// ---------------------------------------------------------------------------
// Elementbaum

const TAG =
  /<!--[\s\S]*?(?:-->|$)|<\?[\s\S]*?(?:\?>|$)|<![\s\S]*?>|<\/([\w:.-]+)\s*>|<([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;

/** Findet alle Elemente mit Attributen, Positionen und Verschachtelung. */
export function leseElemente(text: string, hinweise: Hinweis[] = []): SvgElement[] {
  const elemente: SvgElement[] = [];
  const stapel: number[] = [];
  TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG.exec(text)) !== null) {
    if (m[1]) {
      // End-Tag: passendes offenes Element suchen
      const name = m[1];
      const k = stapel.map((i) => elemente[i]!.name).lastIndexOf(name);
      if (k === -1) {
        hinweise.push({ text: `</${name}> schließt kein offenes Element.`, position: m.index, ende: m.index + m[0].length, art: 'fehler' });
        continue;
      }
      while (stapel.length > k) {
        const i = stapel.pop()!;
        if (stapel.length > k)
          hinweise.push({ text: `<${elemente[i]!.name}> wird nicht geschlossen.`, position: elemente[i]!.start, ende: elemente[i]!.ende, art: 'fehler' });
        elemente[i]!.elementEnde = m.index + m[0].length;
      }
      continue;
    }
    if (!m[2]) continue; // Kommentar, <?xml …?>, <!DOCTYPE …>
    const attribute: Attribut[] = [];
    const attrText = m[3] ?? '';
    const attrStart = m.index + 1 + m[2].length;
    const attr = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attr.exec(attrText)) !== null) {
      const wert = a[3] ?? a[4] ?? '';
      const wertStart = attrStart + a.index + a[0].length - wert.length - 1;
      attribute.push({ name: a[1]!, wert, start: wertStart, ende: wertStart + wert.length });
    }
    const ende = m.index + m[0].length;
    const index = elemente.length;
    elemente.push({ name: m[2], attribute, start: m.index, ende, elementEnde: ende, eltern: stapel.at(-1) ?? -1 });
    if (m[4] !== '/') stapel.push(index);
  }
  for (const i of stapel) {
    if (elemente[i]!.name !== 'svg' || i !== stapel[0])
      hinweise.push({ text: `<${elemente[i]!.name}> wird nicht geschlossen.`, position: elemente[i]!.start, ende: elemente[i]!.ende, art: 'fehler' });
    elemente[i]!.elementEnde = text.length;
  }
  return elemente;
}

export const attribut = (e: SvgElement, name: string) => e.attribute.find((a) => a.name === name);

/** Länge mit Einheit in mm. Ohne Einheit gelten CSS-Pixel (96 je Zoll). */
export function laengeInMm(wert: string): { mm: number; einheit: string } | null {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(mm|cm|in|pt|px)?\s*$/.exec(wert);
  if (!m) return null;
  const zahl = Number(m[1]);
  const einheit = m[2] ?? '';
  const faktor: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96, '': 25.4 / 96 };
  return { mm: zahl * faktor[einheit]!, einheit };
}

// ---------------------------------------------------------------------------
// Stil

/** Liest fill, stroke und fill-rule aus Attributen und style; was fehlt, wird vom Elternelement geerbt. */
function leseStil(e: SvgElement, eltern: Stil): Stil {
  const werte: Record<string, string> = {};
  for (const name of ['fill', 'stroke', 'fill-rule']) {
    const a = attribut(e, name);
    if (a) werte[name] = a.wert.trim();
  }
  // style="fill: red; stroke: none" hat Vorrang vor den Attributen
  for (const teil of (attribut(e, 'style')?.wert ?? '').split(';')) {
    const [k, v] = teil.split(':').map((x) => x?.trim());
    if (k && v && ['fill', 'stroke', 'fill-rule'].includes(k)) werte[k] = v;
  }
  const farbe = (v: string | undefined, geerbt: string | null) =>
    v === undefined || v === 'inherit' ? geerbt : v === 'none' || v === 'transparent' ? null : v;
  return {
    fuellung: farbe(werte['fill'], eltern.fuellung),
    kontur: farbe(werte['stroke'], eltern.kontur),
    fuellregel: werte['fill-rule'] === 'evenodd' ? 'evenodd' : werte['fill-rule'] === 'nonzero' ? 'nonzero' : eltern.fuellregel,
  };
}

const STANDARD_STIL: Stil = { fuellung: 'black', kontur: null, fuellregel: 'nonzero' };

// ---------------------------------------------------------------------------
// Formen → Pfade

const z = (n: number) => String(Math.round(n * 10000) / 10000);

/**
 * Rechnet eine Grundform in einen d-Text um. Die Umrechnung ist bewusst einfach lesbar,
 * damit man im Unterricht sieht, wie aus einem Rechteck ein Pfad wird.
 */
export function formAlsPfad(name: string, zahl: (attr: string, standard?: number) => number, punkte: string): string | null {
  switch (name) {
    case 'rect': {
      const x = zahl('x', 0);
      const y = zahl('y', 0);
      const b = zahl('width');
      const h = zahl('height');
      if (!(b > 0 && h > 0)) return null;
      let rx = zahl('rx', NaN);
      let ry = zahl('ry', NaN);
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(rx, 0), b / 2);
      ry = Math.min(Math.max(ry, 0), h / 2);
      if (rx === 0 || ry === 0) return `M ${z(x)} ${z(y)} H ${z(x + b)} V ${z(y + h)} H ${z(x)} Z`;
      const bogen = (px: number, py: number) => `A ${z(rx)} ${z(ry)} 0 0 1 ${z(px)} ${z(py)}`;
      return [
        `M ${z(x + rx)} ${z(y)}`,
        `H ${z(x + b - rx)}`,
        bogen(x + b, y + ry),
        `V ${z(y + h - ry)}`,
        bogen(x + b - rx, y + h),
        `H ${z(x + rx)}`,
        bogen(x, y + h - ry),
        `V ${z(y + ry)}`,
        bogen(x + rx, y),
        'Z',
      ].join(' ');
    }
    case 'circle':
    case 'ellipse': {
      const cx = zahl('cx', 0);
      const cy = zahl('cy', 0);
      const rx = name === 'circle' ? zahl('r') : zahl('rx');
      const ry = name === 'circle' ? rx : zahl('ry');
      if (!(rx > 0 && ry > 0)) return null;
      // Zwei Halbbögen: von rechts nach links und zurück
      return `M ${z(cx + rx)} ${z(cy)} A ${z(rx)} ${z(ry)} 0 1 1 ${z(cx - rx)} ${z(cy)} A ${z(rx)} ${z(ry)} 0 1 1 ${z(cx + rx)} ${z(cy)} Z`;
    }
    case 'line':
      return `M ${z(zahl('x1', 0))} ${z(zahl('y1', 0))} L ${z(zahl('x2', 0))} ${z(zahl('y2', 0))}`;
    case 'polyline':
    case 'polygon': {
      const w = punkte.trim() === '' ? [] : punkte.trim().split(/[\s,]+/).map(Number);
      if (w.length < 4 || w.some((n) => !Number.isFinite(n))) return null;
      const paare: string[] = [];
      for (let i = 0; i + 1 < w.length; i += 2) paare.push(`${i === 0 ? 'M' : 'L'} ${z(w[i]!)} ${z(w[i + 1]!)}`);
      return paare.join(' ') + (name === 'polygon' ? ' Z' : '');
    }
  }
  return null;
}

const FORMEN = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'];
/** Inhalt dieser Elemente wird nicht gezeichnet und nicht geschnitten. */
const UNSICHTBAR = ['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'style', 'title', 'desc', 'metadata'];

// ---------------------------------------------------------------------------
// Dokument

/** Liest ein SVG-Dokument. Fehler werden als Hinweise gesammelt, nicht geworfen. */
export function leseSvg(text: string): SvgDokument {
  const hinweise: Hinweis[] = [];
  const elemente = leseElemente(text, hinweise);
  const leer: SvgDokument = {
    breiteMm: 0,
    hoeheMm: 0,
    mmJeEinheit: { x: 1, y: 1 },
    ursprung: { x: 0, y: 0 },
    viewBox: [0, 0, 0, 0],
    elemente,
    pfade: [],
    hinweise,
  };
  const wurzelIndex = elemente.findIndex((e) => e.name === 'svg');
  const wurzel = elemente[wurzelIndex];
  if (!wurzel) {
    hinweise.push({ text: 'Kein <svg>-Element gefunden.', art: 'fehler' });
    return leer;
  }

  // viewBox: "minX minY breite höhe"
  const vbAttr = attribut(wurzel, 'viewBox');
  const vb = vbAttr?.wert.trim().split(/[\s,]+/).map(Number);
  const viewBox = vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0 ? vb : null;
  if (!viewBox)
    hinweise.push({
      text: 'Keine gültige viewBox: Das Koordinatensystem ist dann an die Größe gekoppelt (1 Einheit = 1 px).',
      art: 'hinweis',
      position: vbAttr?.start ?? wurzel.start,
      ende: vbAttr?.ende ?? wurzel.ende,
    });

  const groesse = (name: 'width' | 'height', vbWert: number | undefined) => {
    const a = attribut(wurzel, name);
    const l = a ? laengeInMm(a.wert) : null;
    if (a && !l) hinweise.push({ text: `${name}=„${a.wert}“ ist keine Länge.`, art: 'fehler', position: a.start, ende: a.ende });
    // Zoll und Punkt sind feste Längen; nur Pixel (oder gar keine Einheit) hängen an der Annahme 96 px je Zoll
    if (l && (l.einheit === 'px' || l.einheit === '')) {
      hinweise.push({
        text: `${name}=„${a!.wert}“ hat keine feste Einheit: ${l.einheit === 'px' ? 'Pixel werden' : 'Zahlen ohne Einheit werden als Pixel'} mit 96 px je Zoll umgerechnet. Besser mm angeben.`,
        art: 'hinweis',
        position: a!.start,
        ende: a!.ende,
      });
    }
    if (l) return l.mm;
    if (vbWert !== undefined) {
      hinweise.push({
        text: `${name} fehlt: Die viewBox-Einheiten werden als Pixel (96 je Zoll) gedeutet.`,
        art: 'hinweis',
        position: wurzel.start,
        ende: wurzel.ende,
      });
      return vbWert * (25.4 / 96);
    }
    return 0;
  };
  const breiteMm = groesse('width', viewBox?.[2]);
  const hoeheMm = groesse('height', viewBox?.[3]);
  const mmJeEinheit = viewBox ? { x: breiteMm / viewBox[2]!, y: hoeheMm / viewBox[3]! } : { x: 25.4 / 96, y: 25.4 / 96 };
  const ursprung = viewBox ? { x: viewBox[0]!, y: viewBox[1]! } : { x: 0, y: 0 };

  // Transformation und Stil für jedes Element aus seinen Vorfahren
  const matrizen: Matrix[] = [];
  const stile: Stil[] = [];
  const versteckt: boolean[] = [];
  const pfade: SvgPfad[] = [];
  elemente.forEach((e, i) => {
    const elternMatrix = e.eltern >= 0 ? matrizen[e.eltern]! : EINHEITSMATRIX;
    const elternStil = e.eltern >= 0 ? stile[e.eltern]! : STANDARD_STIL;
    versteckt[i] = (e.eltern >= 0 && versteckt[e.eltern]!) || UNSICHTBAR.includes(e.name);
    const t = attribut(e, 'transform');
    let matrix = elternMatrix;
    if (t && i !== wurzelIndex) {
      const r = leseTransform(t.wert);
      if (r.fehler) hinweise.push({ text: r.fehler, art: 'fehler', position: t.start, ende: t.ende });
      matrix = mal(elternMatrix, r.matrix);
    }
    matrizen[i] = matrix;
    stile[i] = leseStil(e, elternStil);
    if (versteckt[i] || i < wurzelIndex) return;

    if (e.name === 'text' || e.name === 'image' || e.name === 'use') {
      const art = e.name === 'text' ? 'Text' : e.name === 'image' ? 'Ein eingebettetes Bild' : '<use>';
      hinweise.push({ text: `${art} wird nicht geschnitten.`, art: 'hinweis', position: e.start, ende: e.ende });
      return;
    }
    if (!FORMEN.includes(e.name)) return;

    const id = attribut(e, 'id')?.wert;
    const basis = { id, name: e.name, element: e, matrix, stil: stile[i]! };
    if (e.name === 'path') {
      const d = attribut(e, 'd');
      if (!d) {
        hinweise.push({ text: '<path> ohne d-Attribut.', art: 'hinweis', position: e.start, ende: e.ende });
        return;
      }
      const r = lesePfadTolerant(d.wert);
      const befehle = r.befehle.map((b) => ({
        ...b,
        start: b.start + d.start,
        ende: b.ende + d.start,
        zahlen: b.zahlen.map((s) => ({ start: s.start + d.start, ende: s.ende + d.start })),
      }));
      if (r.fehler) {
        hinweise.push({
          text: r.fehler.text + (befehle.length ? ' Der Pfad wird bis zur Fehlerstelle gezeichnet.' : ''),
          art: 'fehler',
          position: d.start + r.fehler.position,
          ende: d.start + r.fehler.position + 1,
        });
      }
      if (befehle.length) pfade.push({ ...basis, befehle });
      return;
    }
    // Grundform: Zahlen lesen, dann in einen Pfad umrechnen
    const zahl = (name: string, standard = NaN) => {
      const a = attribut(e, name);
      if (!a) return standard;
      const n = parseFloat(a.wert);
      if (!Number.isFinite(n)) {
        hinweise.push({ text: `${name}=„${a.wert}“ ist keine Zahl.`, art: 'fehler', position: a.start, ende: a.ende });
        return standard;
      }
      return n;
    };
    const d = formAlsPfad(e.name, zahl, attribut(e, 'points')?.wert ?? '');
    if (!d) {
      hinweise.push({ text: `<${e.name}> hat keine gültige Größe und wird übersprungen.`, art: 'hinweis', position: e.start, ende: e.ende });
      return;
    }
    pfade.push({ ...basis, befehle: lesePfadTolerant(d).befehle, umgerechnet: d });
  });

  return { ...leer, breiteMm, hoeheMm, mmJeEinheit, ursprung, viewBox: viewBox ? [viewBox[0]!, viewBox[1]!, viewBox[2]!, viewBox[3]!] : [0, 0, breiteMm / (25.4 / 96), hoeheMm / (25.4 / 96)], pfade };
}

/** Der d-Text, mit dem ein Pfad gezeichnet wird: bei Formen die Umrechnung. */
export function zeichenDaten(text: string, p: SvgPfad): string {
  if (p.umgerechnet) return p.umgerechnet;
  const letzter = p.befehle.at(-1);
  const d = attribut(p.element, 'd')!;
  // Bei Fehlern nur den gültigen Teil zeichnen
  return letzter ? text.slice(d.start, letzter.ende) : '';
}

/** Rechnet einen Punkt aus dem Koordinatensystem der viewBox in mm um. */
export function inMm(dok: SvgDokument, p: Punkt): Punkt {
  return { x: (p.x - dok.ursprung.x) * dok.mmJeEinheit.x, y: (p.y - dok.ursprung.y) * dok.mmJeEinheit.y };
}

export interface Kontur {
  /** Index in dok.pfade */
  pfad: number;
  punkte: Polylinie;
  /** Mit Z geschlossen? (Die Punkte enden dann am Anfang.) */
  geschlossen: boolean;
}

/**
 * Alle Teilpfade als Linienzüge in mm – die Grundlage für Simulation, DXF und Cutter.
 * `toleranzMm`: wie weit die Strecken höchstens von der Kurve abweichen dürfen.
 * Standard 0,025 mm, also die Hälfte eines Geräteschritts.
 */
export function svgKonturen(dok: SvgDokument, toleranzMm = 0.025): Kontur[] {
  const konturen: Kontur[] = [];
  const mmJeEinheit = Math.max(dok.mmJeEinheit.x, dok.mmJeEinheit.y) || 1;
  dok.pfade.forEach((pfad, i) => {
    const toleranz = toleranzMm / (mmJeEinheit * massstab(pfad.matrix));
    for (const tp of alsTeilpfade(pfad.befehle)) {
      const zug = alsLinienzug(tp, toleranz).map((p) => inMm(dok, wende(pfad.matrix, p)));
      if (zug.length >= 2) konturen.push({ pfad: i, punkte: zug, geschlossen: tp.geschlossen });
    }
  });
  return konturen;
}

export function svgZuPolylinien(dok: SvgDokument, toleranzMm = 0.025): Polylinie[] {
  return svgKonturen(dok, toleranzMm).map((k) => k.punkte);
}
