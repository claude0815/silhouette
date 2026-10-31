/**
 * Ein SVG-Dokument lesen: Größe in mm, viewBox und alle Pfade mit ihrer Stelle im Text.
 *
 * Das SVG-Dokument ist die gemeinsame Grundlage der App: Simulation, Export und Cutter
 * lesen nur daraus. Darum steht hier auch die Umrechnung in Linienzüge in mm.
 *
 * Bewusst ein kleiner, eigener Leser statt DOMParser: Er läuft auch im Web Worker und
 * in den Tests, und er kennt die Stelle jedes Elements im Text (für die verknüpfte Ansicht).
 * Unterstützt werden in Stufe 1 <svg> und <path>; Formen wie rect und circle sowie
 * transform folgen in Stufe 2 und werden bis dahin mit einem Hinweis übersprungen.
 */
import type { Polylinie, Punkt } from '../cutter/types';
import { alsLinienzug, alsTeilpfade, lesePfad, PfadFehler, type PfadBefehl } from './pfad';

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
  /** Stelle des ganzen Start-Tags im Text */
  start: number;
  ende: number;
}

export interface SvgPfad {
  id?: string;
  element: SvgElement;
  /** Befehle; ihre Positionen beziehen sich auf den Dokumenttext. */
  befehle: PfadBefehl[];
}

export interface Hinweis {
  text: string;
  position?: number;
  art: 'hinweis' | 'fehler';
}

export interface SvgDokument {
  breiteMm: number;
  hoeheMm: number;
  /** Millimeter je Einheit des Koordinatensystems (aus width und viewBox) */
  mmJeEinheit: { x: number; y: number };
  /** Verschiebung durch den Anfang der viewBox */
  ursprung: Punkt;
  pfade: SvgPfad[];
  hinweise: Hinweis[];
}

/** Findet alle Start-Tags mit ihren Attributen und Positionen. */
export function leseElemente(text: string): SvgElement[] {
  const elemente: SvgElement[] = [];
  const tag = /<([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(text)) !== null) {
    const attribute: Attribut[] = [];
    const attrText = m[2] ?? '';
    const attrStart = m.index + 1 + m[1]!.length;
    const attr = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attr.exec(attrText)) !== null) {
      const wert = a[3] ?? a[4] ?? '';
      const wertStart = attrStart + a.index + a[0].length - wert.length - 1;
      attribute.push({ name: a[1]!, wert, start: wertStart, ende: wertStart + wert.length });
    }
    elemente.push({ name: m[1]!, attribute, start: m.index, ende: m.index + m[0].length });
  }
  return elemente;
}

const attribut = (e: SvgElement, name: string) => e.attribute.find((a) => a.name === name);

/** Länge mit Einheit in mm. Ohne Einheit gelten CSS-Pixel (96 je Zoll). */
export function laengeInMm(wert: string): { mm: number; einheit: string } | null {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(mm|cm|in|pt|px)?\s*$/.exec(wert);
  if (!m) return null;
  const zahl = Number(m[1]);
  const einheit = m[2] ?? '';
  const faktor: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96, '': 25.4 / 96 };
  return { mm: zahl * faktor[einheit]!, einheit };
}

/** Liest ein SVG-Dokument. Fehler werden als Hinweise gesammelt, nicht geworfen. */
export function leseSvg(text: string): SvgDokument {
  const hinweise: Hinweis[] = [];
  const elemente = leseElemente(text);
  const wurzel = elemente.find((e) => e.name === 'svg');
  if (!wurzel) {
    return {
      breiteMm: 0,
      hoeheMm: 0,
      mmJeEinheit: { x: 1, y: 1 },
      ursprung: { x: 0, y: 0 },
      pfade: [],
      hinweise: [{ text: 'Kein <svg>-Element gefunden.', art: 'fehler' }],
    };
  }

  // viewBox: "minX minY breite höhe"
  const vbAttr = attribut(wurzel, 'viewBox');
  const vb = vbAttr?.wert.trim().split(/[\s,]+/).map(Number);
  const viewBox = vb && vb.length === 4 && vb.every(Number.isFinite) ? vb : null;
  if (!viewBox) hinweise.push({ text: 'Keine viewBox: Das Koordinatensystem ist dann an die Größe gekoppelt.', art: 'hinweis', position: wurzel.start });

  const groesse = (name: 'width' | 'height', vbWert: number | undefined) => {
    const a = attribut(wurzel, name);
    const l = a ? laengeInMm(a.wert) : null;
    if (l && l.einheit !== 'mm' && l.einheit !== 'cm') {
      hinweise.push({
        text: `${name} ohne Einheit mm: „${a!.wert}“ wird mit 96 px je Zoll umgerechnet.`,
        art: 'hinweis',
        position: a!.start,
      });
    }
    if (l) return l.mm;
    if (vbWert !== undefined) {
      hinweise.push({ text: `${name} fehlt: Die viewBox-Einheiten werden als Pixel (96 je Zoll) gedeutet.`, art: 'hinweis', position: wurzel.start });
      return vbWert * (25.4 / 96);
    }
    return 0;
  };
  const breiteMm = groesse('width', viewBox?.[2]);
  const hoeheMm = groesse('height', viewBox?.[3]);
  const mmJeEinheit = viewBox
    ? { x: breiteMm / viewBox[2]!, y: hoeheMm / viewBox[3]! }
    : { x: 25.4 / 96, y: 25.4 / 96 };
  const ursprung = viewBox ? { x: viewBox[0]!, y: viewBox[1]! } : { x: 0, y: 0 };

  const pfade: SvgPfad[] = [];
  for (const e of elemente) {
    if (attribut(e, 'transform')) {
      hinweise.push({ text: `transform bei <${e.name}> wird noch nicht berücksichtigt.`, art: 'hinweis', position: e.start });
    }
    if (e.name === 'path') {
      const d = attribut(e, 'd');
      if (!d) continue;
      try {
        const befehle = lesePfad(d.wert).map((b) => ({ ...b, start: b.start + d.start, ende: b.ende + d.start }));
        pfade.push({ id: attribut(e, 'id')?.wert, element: e, befehle });
      } catch (f) {
        const pos = f instanceof PfadFehler ? d.start + f.position : d.start;
        hinweise.push({ text: f instanceof Error ? f.message : String(f), art: 'fehler', position: pos });
      }
    } else if (['rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'].includes(e.name)) {
      hinweise.push({ text: `<${e.name}> wird erst in Stufe 2 geschnitten.`, art: 'hinweis', position: e.start });
    }
  }
  return { breiteMm, hoeheMm, mmJeEinheit, ursprung, pfade, hinweise };
}

/** Rechnet einen Punkt aus dem SVG-Koordinatensystem in mm um. */
export function inMm(dok: SvgDokument, p: Punkt): Punkt {
  return { x: (p.x - dok.ursprung.x) * dok.mmJeEinheit.x, y: (p.y - dok.ursprung.y) * dok.mmJeEinheit.y };
}

/**
 * Alle Pfade als Linienzüge in mm – die Grundlage für Simulation, DXF und Cutter.
 * `toleranzMm`: wie weit die Strecken höchstens von der Kurve abweichen dürfen.
 * Standard 0,025 mm, also die Hälfte eines Geräteschritts.
 */
export function svgZuPolylinien(dok: SvgDokument, toleranzMm = 0.025): Polylinie[] {
  const einheitenToleranz = toleranzMm / Math.max(dok.mmJeEinheit.x, dok.mmJeEinheit.y);
  const linien: Polylinie[] = [];
  for (const pfad of dok.pfade) {
    for (const tp of alsTeilpfade(pfad.befehle)) {
      const zug = alsLinienzug(tp, einheitenToleranz).map((p) => inMm(dok, p));
      if (zug.length >= 2) linien.push(zug);
    }
  }
  return linien;
}
