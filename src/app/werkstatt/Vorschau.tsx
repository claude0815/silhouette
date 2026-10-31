/**
 * Live-Vorschau des SVG-Dokuments mit Lineal und Raster in mm.
 *
 * Gezeichnet wird nicht das SVG selbst (das könnte Skripte enthalten), sondern das, was
 * der Leser daraus verstanden hat: jede Form als Pfad mit ihrer Transformation. So zeigt
 * die Vorschau genau das, was auch geschnitten würde.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { befehlsGriffe, ziehePunkt, type Griff } from '../../svg/bearbeiten';
import { zeichenDaten, type SvgDokument } from '../../svg/dokument';
import { befehlsGeometrie, naechsterBefehl } from '../../svg/pfad';
import { massstab, type Matrix } from '../../svg/transform';
import { aendereText, dokument } from '../dokument';
import { Befehlsmarkierung } from '../svgansicht';
import { auswahl, befunde, befundMarkiert, cutterAnsicht, markiert, zoom } from './zustand';

const RAND = 9; // Platz für das Lineal in mm
const matrixAttr = (m: Matrix) => `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;

function Lineal(props: { breite: number; hoehe: number }) {
  const striche = [];
  const strich = (mm: number, waagerecht: boolean) => {
    const lang = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.5 : 1.2;
    return waagerecht ? (
      <line x1={mm} x2={mm} y1={-lang} y2={0} class="lineal-strich" />
    ) : (
      <line y1={mm} y2={mm} x1={-lang} x2={0} class="lineal-strich" />
    );
  };
  // Bei großen Dokumenten nur jeden 5. bzw. 10. Millimeter
  const schritt = props.breite > 300 || props.hoehe > 300 ? 5 : 1;
  for (let mm = 0; mm <= props.breite; mm += schritt) {
    striche.push(strich(mm, true));
    if (mm % 10 === 0) striche.push(<text x={mm + 0.5} y={-4.5} class="lineal-zahl">{mm}</text>);
  }
  for (let mm = 0; mm <= props.hoehe; mm += schritt) {
    striche.push(strich(mm, false));
    if (mm % 10 === 0 && mm > 0) striche.push(<text x={-8.5} y={mm + 1.2} class="lineal-zahl">{mm}</text>);
  }
  return (
    <g class="lineal">
      <rect x={-RAND} y={-RAND} width={props.breite + RAND} height={RAND} class="lineal-grund" />
      <rect x={-RAND} y={0} width={RAND} height={props.hoehe} class="lineal-grund" />
      {striche}
      <text x={-RAND + 0.5} y={-1} class="lineal-einheit">mm</text>
    </g>
  );
}

export function Vorschau(props: { dok: SvgDokument }) {
  const dok = props.dok;
  const breite = dok.breiteMm || 100;
  const hoehe = dok.hoeheMm || 100;
  const flaeche = useRef<SVGSVGElement>(null);
  const [pxJeMm, setPxJeMm] = useState(4);
  const ziehen = useRef<{ pfad: number; griff: number; gruppe: SVGGElement } | null>(null);
  /** Nach einem Zug löst der Browser einen Klick auf der Fläche aus; der soll die Auswahl nicht aufheben. */
  const geradeGezogen = useRef(false);

  // Bildschirmpixel je mm: für Griffe und Linien, die auf dem Schirm gleich groß bleiben sollen
  useEffect(() => {
    const s = flaeche.current;
    if (!s) return;
    const r = new ResizeObserver(() => setPxJeMm(s.clientWidth / (breite + RAND + 5)));
    r.observe(s);
    return () => r.disconnect();
  }, [breite]);

  // Koordinatensystem der viewBox → mm
  const inhalt: Matrix = {
    a: dok.mmJeEinheit.x,
    b: 0,
    c: 0,
    d: dok.mmJeEinheit.y,
    e: -dok.ursprung.x * dok.mmJeEinheit.x,
    f: -dok.ursprung.y * dok.mmJeEinheit.y,
  };
  const cutter = cutterAnsicht.value;
  const m = markiert.value;
  const a = auswahl.value;
  const befund = befunde.value.find((b) => b.id === befundMarkiert.value);
  const gewaehlt = a !== null ? dok.pfade[a] : undefined;
  const griffe = gewaehlt && !gewaehlt.umgerechnet ? befehlsGriffe(gewaehlt.befehle) : [];
  /** Länge in lokalen Einheiten des gewählten Pfads, die `px` Bildschirmpixeln entspricht */
  const lokal = (px: number, matrix: Matrix) => px / (pxJeMm * Math.max(dok.mmJeEinheit.x, dok.mmJeEinheit.y) * massstab(matrix));

  const markierteGeometrie = m && m.befehl !== null ? befehlsGeometrie(dok.pfade[m.pfad]?.befehle ?? []).get(m.befehl) : undefined;

  const bewege = (e: PointerEvent) => {
    const z = ziehen.current;
    if (!z) return;
    geradeGezogen.current = true;
    const ctm = z.gruppe.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pfad = dok.pfade[z.pfad];
    const griff = pfad && befehlsGriffe(pfad.befehle)[z.griff];
    if (!pfad || !griff) return;
    aendereText(ziehePunkt(dokument.value.text, pfad.befehle, griff, { x: p.x, y: p.y }));
  };

  return (
    <div class="vorschau-flaeche" data-testid="werkstatt-vorschau">
      <svg
        ref={flaeche}
        viewBox={`${-RAND} ${-RAND} ${breite + RAND + 5} ${hoehe + RAND + 2}`}
        style={{ width: `${zoom.value * 100}%` }}
        onPointerMove={bewege}
        onPointerUp={() => (ziehen.current = null)}
        onPointerLeave={() => (ziehen.current = null)}
        onClick={(e) => {
          if (geradeGezogen.current) {
            geradeGezogen.current = false;
            return;
          }
          if (e.target === e.currentTarget || (e.target as Element).classList.contains('dokument')) auswahl.value = null;
        }}
      >
        <rect width={breite} height={hoehe} class="dokument" />
        {Array.from({ length: Math.floor(breite / 10) + 1 }, (_, i) => (
          <line x1={i * 10} x2={i * 10} y1={0} y2={hoehe} class="raster-linie" />
        ))}
        {Array.from({ length: Math.floor(hoehe / 10) + 1 }, (_, i) => (
          <line y1={i * 10} y2={i * 10} x1={0} x2={breite} class="raster-linie" />
        ))}
        <Lineal breite={breite} hoehe={hoehe} />
        <circle cx={0} cy={0} r={0.8} class="ursprung-punkt" />

        <g transform={matrixAttr(inhalt)}>
          {dok.pfade.map((p, i) => {
            const hervor = m?.pfad === i || a === i || befund?.pfade.includes(i);
            const d = zeichenDaten(dokument.value.text, p);
            return (
              <g
                transform={matrixAttr(p.matrix)}
                class="wf-gruppe"
                data-testid={`wf-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  auswahl.value = i;
                }}
                onMouseMove={(e) => {
                  const ctm = (e.currentTarget as SVGGElement).getScreenCTM();
                  if (!ctm) return;
                  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
                  const befehl = p.umgerechnet ? null : naechsterBefehl(befehlsGeometrie(p.befehle), { x: pt.x, y: pt.y }, 0.2);
                  if (m?.pfad !== i || m.befehl !== befehl) markiert.value = { pfad: i, befehl, quelle: 'grafik' };
                }}
                onMouseLeave={() => (markiert.value = null)}
              >
                <path
                  d={d}
                  fill-rule={p.stil.fuellregel}
                  class={`wf ${cutter ? 'wf-cutter' : ''} ${hervor ? 'wf-hervor' : ''}`}
                  style={cutter ? undefined : { fill: p.stil.fuellung ?? 'none', stroke: p.stil.kontur ?? 'none' }}
                />
                {/* Unsichtbare, breite Trefferfläche: auch dünne Linien lassen sich gut anklicken */}
                <path d={d} class="wf-treffer" />
              </g>
            );
          })}
          {m && markierteGeometrie && dok.pfade[m.pfad] && (
            <g transform={matrixAttr(dok.pfade[m.pfad]!.matrix)} class="wf-markierung">
              <Befehlsmarkierung g={markierteGeometrie} />
            </g>
          )}
          {gewaehlt && griffe.length > 0 && (
            <g transform={matrixAttr(gewaehlt.matrix)} class="griffe" data-testid="griffe">
              <Griffe
                griffe={griffe}
                radius={lokal(5, gewaehlt.matrix)}
                onStart={(nr, gruppe) => (ziehen.current = { pfad: a!, griff: nr, gruppe })}
              />
            </g>
          )}
        </g>
        {befund?.stellen.map((s) => <circle cx={s.x} cy={s.y} r={6 / pxJeMm} class="befund-stelle" />)}
      </svg>
    </div>
  );
}

function Griffe(props: { griffe: Griff[]; radius: number; onStart: (nr: number, gruppe: SVGGElement) => void }) {
  const r = props.radius;
  const elemente: JSX.Element[] = [];
  // Hebel: Linien von den Kontrollpunkten zu ihren Ankerpunkten
  props.griffe.forEach((g, i) => {
    if (g.rolle === 'kontrolle1') elemente.push(<line x1={g.bezug.x} y1={g.bezug.y} x2={g.p.x} y2={g.p.y} class="griff-hebel" />);
    if (g.rolle === 'kontrolle2') {
      const ende = props.griffe.slice(i + 1).find((x) => x.befehl === g.befehl && x.rolle === 'ende');
      if (ende) elemente.push(<line x1={ende.p.x} y1={ende.p.y} x2={g.p.x} y2={g.p.y} class="griff-hebel" />);
    }
  });
  props.griffe.forEach((g, i) => {
    elemente.push(
      <circle
        cx={g.p.x}
        cy={g.p.y}
        r={g.rolle === 'ende' ? r : r * 0.85}
        class={g.rolle === 'ende' ? 'griff-punkt' : 'griff-kontrolle'}
        data-testid={`griff-${i}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.currentTarget as SVGCircleElement).ownerSVGElement?.setPointerCapture(e.pointerId);
          props.onStart(i, (e.currentTarget as SVGCircleElement).parentNode as SVGGElement);
        }}
      />,
    );
  });
  return <>{elemente}</>;
}
