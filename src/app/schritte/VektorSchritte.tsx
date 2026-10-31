/** Schritte 5 bis 8: Konturen, Vereinfachen, Glätten, SVG. */
import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { svgZuDxf } from '../../export/aus-svg';
import { speichereText } from '../../gemeinsam/datei';
import type { Binaerbild, Punkt } from '../../pipeline/bilder';
import { formAnPunkt } from '../../pipeline/geometrie';
import { istGerade, type Bezierpfad } from '../../pipeline/glaetten';
import { FALL_SEGMENTE, kantenmitte, zellenMitKontur } from '../../pipeline/konturen';
import { svgZahl, teilpfad } from '../../pipeline/svg-erzeugen';
import { leseSvg, zeichenDaten } from '../../svg/dokument';
import { befehlsGeometrie, naechsterBefehl } from '../../svg/pfad';
import { befehlErklaerung, Befehlsmarkierung } from '../svgansicht';
import { t } from '../../i18n/de';
import { Bildansicht } from '../Bildansicht';
import { ausBinaerbild } from '../raster';
import { auswahlForm, bereich, einstellungen, ergebnis, geladen, setze } from '../zustand';
import { Erklaerung, Kasten, Regler, Schalter, Schrittansicht, vieleckD } from './Bausteine';

const tx = t.app;
const pixelD = (k: Punkt[] | Bezierpfad) => teilpfad(k, (p) => `${p.x} ${p.y}`);

function useBlasseUnterlage() {
  const r = ergebnis.value;
  return useMemo(() => (r?.entrauscht ? ausBinaerbild(r.entrauscht, { blass: true }) : null), [r?.entrauscht]);
}

function speichereJson(daten: unknown, name: string) {
  speichereText(JSON.stringify(daten, null, 1), name, 'application/json');
}

// ---------------------------------------------------------------------------
// 5. Konturen finden

const AUSSCHNITT = 16;
const ausschnitt = signal<{ x: number; y: number } | null>(null);

function schneideAus(bild: Binaerbild, x0: number, y0: number, g: number): Binaerbild {
  const daten = new Uint8Array(g * g);
  for (let y = 0; y < g; y++)
    for (let x = 0; x < g; x++) {
      const bx = x0 + x;
      const by = y0 + y;
      if (bx < bild.breite && by < bild.hoehe) daten[y * g + x] = bild.daten[by * bild.breite + bx]!;
    }
  return { breite: g, hoehe: g, daten };
}

/** Marching Squares Schritt für Schritt auf einem kleinen Ausschnitt. */
function Animation(props: { bild: Binaerbild; x0: number; y0: number }) {
  const g = AUSSCHNITT;
  const teil = useMemo(() => schneideAus(props.bild, props.x0, props.y0, g), [props.bild, props.x0, props.y0]);
  const zellen = useMemo(() => zellenMitKontur(teil), [teil]);
  const [index, setIndex] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(8);

  useEffect(() => {
    setIndex(0);
    setLaeuft(false);
  }, [teil]);
  useEffect(() => {
    if (!laeuft) return;
    const id = setInterval(() => setIndex((i) => (i < zellen.length ? i + 1 : i)), 1000 / tempo);
    return () => clearInterval(id);
  }, [laeuft, tempo, zellen.length]);
  useEffect(() => {
    if (index >= zellen.length) setLaeuft(false);
  }, [index, zellen.length]);

  const aktuell = zellen[index - 1];
  const linien = zellen.slice(0, index).flatMap((z) =>
    FALL_SEGMENTE[z.fall]!.map(([von, nach]) => {
      const a = kantenmitte(z.x, z.y, von);
      const b = kantenmitte(z.x, z.y, nach);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="ms-segment" marker-end="url(#pfeil)" />;
    }),
  );
  const pixel = [];
  for (let y = 0; y < g; y++)
    for (let x = 0; x < g; x++) {
      const v = teil.daten[y * g + x];
      pixel.push(<rect x={x} y={y} width={1} height={1} class={v ? 'ms-vorne' : 'ms-hinten'} />);
      pixel.push(<circle cx={x + 0.5} cy={y + 0.5} r={0.09} class={v ? 'ms-ecke-voll' : 'ms-ecke-leer'} />);
    }
  const bits = aktuell ? [8, 4, 2, 1].map((b) => `${aktuell.fall & b ? 1 : 0}·${b}`).join(' + ') : '';

  return (
    <div class="animation" data-testid="animation">
      <p class="klein">{tx.konturen.ausschnittInfo(props.x0, props.y0, g)}</p>
      <svg viewBox={`-1 -1 ${g + 2} ${g + 2}`} class="ms-flaeche">
        <defs>
          <marker id="pfeil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L10 5L0 10z" class="ms-pfeil" />
          </marker>
        </defs>
        {pixel}
        {aktuell && <rect x={aktuell.x + 0.5} y={aktuell.y + 0.5} width={1} height={1} class="ms-zelle" />}
        {linien}
      </svg>
      <p data-testid="ms-zelle">
        {aktuell ? (
          <>
            {tx.konturen.zelle(props.x0 + aktuell.x, props.y0 + aktuell.y, aktuell.fall)}
            <br />
            <code>
              {bits} = {aktuell.fall}
            </code>
          </>
        ) : (
          ' '
        )}
      </p>
      <p class="klein">{index >= zellen.length && zellen.length > 0 ? tx.konturen.fertig : tx.konturen.fortschritt(index, zellen.length)}</p>
      <div class="knoepfe">
        <button onClick={() => setLaeuft(!laeuft)} disabled={index >= zellen.length}>
          {laeuft ? tx.konturen.pause : tx.konturen.start}
        </button>
        <button onClick={() => setIndex((i) => Math.min(zellen.length, i + 1))} disabled={laeuft || index >= zellen.length}>
          {tx.konturen.schritt}
        </button>
        <button onClick={() => setIndex(0)}>{tx.konturen.neuStart}</button>
      </div>
      <Regler label={tx.konturen.tempo} wert={tempo} min={1} max={60} onChange={setTempo} />
    </div>
  );
}

export function Schritt5() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const unterlage = useBlasseUnterlage();
  const konturen = r?.konturen ?? [];
  const d = useMemo(
    () => ({
      aussen: konturen.filter((k) => k.aussen).map((k) => vieleckD(k.punkte)).join(''),
      innen: konturen.filter((k) => !k.aussen).map((k) => vieleckD(k.punkte)).join(''),
    }),
    [konturen],
  );
  const aussen = konturen.filter((k) => k.aussen).length;
  const a = ausschnitt.value;
  return (
    <Schrittansicht
      haupt={
        <Bildansicht
          breite={g.breite}
          hoehe={g.hoehe}
          bild={unterlage}
          onKlick={(x, y) =>
            (ausschnitt.value = {
              x: Math.max(0, Math.min(g.breite - AUSSCHNITT, x - AUSSCHNITT / 2)),
              y: Math.max(0, Math.min(g.hoehe - AUSSCHNITT, y - AUSSCHNITT / 2)),
            })
          }
          ueberlagerung={(linie) => (
            <>
              <path d={d.aussen} class="kontur-aussen" stroke-width={linie} />
              <path d={d.innen} class="kontur-innen" stroke-width={linie} />
              {a && <rect x={a.x} y={a.y} width={AUSSCHNITT} height={AUSSCHNITT} class="ausschnitt" stroke-width={linie} />}
            </>
          )}
        />
      }
      seite={
        <>
          <Kasten>
            <p data-testid="konturen">{tx.konturen.anzahl(aussen, konturen.length - aussen, r?.punkteRoh ?? 0)}</p>
            <p class="legende">
              <span class="farbfeld aussen" /> {tx.konturen.legendeAussen} <span class="farbfeld innen" /> {tx.konturen.legendeInnen}
            </p>
            <button onClick={() => speichereJson(konturen, 'schritt5-konturen.json')}>{tx.alsJson}</button>
          </Kasten>
          <Kasten titel={tx.konturen.animation}>
            {a && r?.entrauscht ? <Animation bild={r.entrauscht} x0={a.x} y0={a.y} /> : <p class="klein">{tx.konturen.animationHinweis}</p>}
          </Kasten>
          <Erklaerung absaetze={tx.konturen.erklaerung} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 6. Vereinfachen

const zeigeOriginal = signal(true);

export function Schritt6() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const e = einstellungen.value;
  const unterlage = useBlasseUnterlage();
  const formen = r?.vereinfacht ?? [];
  const roh = useMemo(() => (r?.konturen ?? []).map((k) => vieleckD(k.punkte)).join(''), [r?.konturen]);
  const vereinfachtD = useMemo(() => formen.map((f) => [f.aussen, ...f.loecher].map((k) => vieleckD(k)).join('')), [formen]);
  const allePunkte = useMemo(() => formen.flatMap((f) => [f.aussen, ...f.loecher].flat()), [formen]);
  const markerZeigen = allePunkte.length <= 20000;
  const w = auswahlForm.value;
  const auswahl = w !== null ? formen[w] : undefined;

  return (
    <Schrittansicht
      haupt={
        <Bildansicht
          breite={g.breite}
          hoehe={g.hoehe}
          bild={unterlage}
          onKlick={(x, y) => (auswahlForm.value = formAnPunkt(formen, { x: x + 0.5, y: y + 0.5 }))}
          ueberlagerung={(linie) => (
            <>
              {zeigeOriginal.value && <path d={roh} class="kontur-roh" stroke-width={linie} />}
              {vereinfachtD.map((d, i) => (
                <path d={d} class={`kontur-vereinfacht ${i === w ? 'ausgewaehlt' : ''}`} stroke-width={linie * (i === w ? 2 : 1)} />
              ))}
              {markerZeigen &&
                allePunkte.map((p) => <circle cx={p.x} cy={p.y} r={linie * 1.6} class="punkt-marker" />)}
            </>
          )}
        />
      }
      seite={
        <>
          <Kasten>
            <Regler label={tx.vereinfachen.toleranz} wert={e.toleranz} min={0} max={10} schritt={0.1} onChange={(n) => setze('toleranz', n)} />
            <p data-testid="punktzahl">
              <strong>{tx.vereinfachen.punkte(r?.punkteRoh ?? 0, r?.punkteVereinfacht ?? 0)}</strong>
            </p>
            <Schalter label={tx.vereinfachen.original} wert={zeigeOriginal.value} onChange={(b) => (zeigeOriginal.value = b)} />
            <button onClick={() => speichereJson(formen, 'schritt6-vereinfacht.json')}>{tx.alsJson}</button>
          </Kasten>
          <Kasten>
            {auswahl ? (
              <Punktliste titel={tx.vereinfachen.formInfo(w! + 1, auswahl.aussen.length, auswahl.loecher.length)} punkte={auswahl.aussen} />
            ) : (
              <p class="klein">{tx.vereinfachen.auswahl}</p>
            )}
          </Kasten>
          <Erklaerung absaetze={tx.vereinfachen.erklaerung} />
        </>
      }
    />
  );
}

function Punktliste(props: { titel: string; punkte: readonly Punkt[] }) {
  const max = 100;
  return (
    <div>
      <p>{props.titel}</p>
      <ol class="punktliste" data-testid="punktliste">
        {props.punkte.slice(0, max).map((p) => (
          <li>
            ({svgZahl(p.x)} | {svgZahl(p.y)})
          </li>
        ))}
      </ol>
      {props.punkte.length > max && <p class="klein">{tx.vereinfachen.weitere(props.punkte.length - max)}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Glätten

function Kontrollpunkte(props: { pfad: Bezierpfad; linie: number }) {
  const elemente = [];
  let von = props.pfad.start;
  for (const s of props.pfad.segmente) {
    if (!istGerade(von, s)) {
      elemente.push(
        <line x1={von.x} y1={von.y} x2={s.c1.x} y2={s.c1.y} class="hebel" stroke-width={props.linie * 0.7} />,
        <line x1={s.p.x} y1={s.p.y} x2={s.c2.x} y2={s.c2.y} class="hebel" stroke-width={props.linie * 0.7} />,
        <circle cx={s.c1.x} cy={s.c1.y} r={props.linie * 1.5} class="kontrollpunkt" />,
        <circle cx={s.c2.x} cy={s.c2.y} r={props.linie * 1.5} class="kontrollpunkt" />,
      );
    }
    elemente.push(<circle cx={s.p.x} cy={s.p.y} r={props.linie * 1.8} class="punkt-marker" />);
    von = s.p;
  }
  return <>{elemente}</>;
}

const alleZeigen = signal(false);

export function Schritt7() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const e = einstellungen.value;
  const unterlage = useBlasseUnterlage();
  const formen = r?.vereinfacht ?? [];
  const glatt = r?.geglaettet ?? null;
  const vieleckeD = useMemo(() => formen.map((f) => [f.aussen, ...f.loecher].map((k) => vieleckD(k)).join('')).join(''), [formen]);
  const kurvenD = useMemo(() => (glatt ?? []).map((f) => [f.aussen, ...f.loecher].map(pixelD).join(' ')), [glatt]);
  const segmente = (glatt ?? []).reduce((s, f) => s + [f.aussen, ...f.loecher].reduce((t2, p) => t2 + p.segmente.length, 0), 0);
  const alleKontrollpunkte = alleZeigen.value && segmente <= 3000;
  const w = auswahlForm.value;

  return (
    <Schrittansicht
      haupt={
        <Bildansicht
          breite={g.breite}
          hoehe={g.hoehe}
          bild={unterlage}
          onKlick={(x, y) => (auswahlForm.value = formAnPunkt(formen, { x: x + 0.5, y: y + 0.5 }))}
          ueberlagerung={(linie) => (
            <>
              <path d={vieleckeD} class="kontur-gestrichelt" stroke-width={linie} stroke-dasharray={`${linie * 4} ${linie * 3}`} />
              {kurvenD.map((d, i) => (
                <path d={d} class={`kurve ${i === w ? 'ausgewaehlt' : ''}`} stroke-width={linie * (i === w ? 2 : 1.3)} />
              ))}
              {glatt &&
                glatt.map(
                  (f, i) =>
                    (alleKontrollpunkte || i === w) &&
                    [f.aussen, ...f.loecher].map((p) => <Kontrollpunkte pfad={p} linie={linie} />),
                )}
            </>
          )}
        />
      }
      seite={
        <>
          <Kasten>
            <Schalter label={tx.glaetten.an} wert={e.glaetten} onChange={(b) => setze('glaetten', b)} />
            <Regler label={tx.glaetten.staerke} wert={e.staerke} min={0} max={1} schritt={0.05} deaktiviert={!e.glaetten} onChange={(n) => setze('staerke', n)} />
            <Regler label={tx.glaetten.ecken} wert={e.eckenWinkel} min={0} max={180} deaktiviert={!e.glaetten} onChange={(n) => setze('eckenWinkel', n)} />
            {glatt && <p data-testid="segmente">{tx.glaetten.segmente(segmente)}</p>}
            <Schalter label={tx.glaetten.kontrollpunkte} wert={alleZeigen.value} onChange={(b) => (alleZeigen.value = b)} />
            {glatt && !alleKontrollpunkte && <p class="klein">{tx.glaetten.zuViele}</p>}
            {glatt && <button onClick={() => speichereJson(glatt, 'schritt7-bezier.json')}>{tx.alsJson}</button>}
          </Kasten>
          {glatt && w !== null && glatt[w] && (
            <Kasten>
              <ol class="punktliste">
                {glatt[w].aussen.segmente.slice(0, 60).map((s, i) => {
                  const von = i === 0 ? glatt[w]!.aussen.start : glatt[w]!.aussen.segmente[i - 1]!.p;
                  const z = (p: Punkt) => `${svgZahl(p.x)} ${svgZahl(p.y)}`;
                  return <li>{istGerade(von, s) ? `L ${z(s.p)}` : `C ${z(s.c1)}, ${z(s.c2)}, ${z(s.p)}`}</li>;
                })}
              </ol>
            </Kasten>
          )}
          <Erklaerung absaetze={tx.glaetten.erklaerung} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 8. SVG erzeugen – Grafik und Code verknüpft

interface Markierung {
  pfad: number;
  /** Index des Befehls im Pfad, oder null für den ganzen Pfad */
  befehl: number | null;
  /** Woher kam die Markierung? Nur bei „grafik“ wird der Code mitgescrollt. */
  quelle: 'grafik' | 'code';
}
const markiert = signal<Markierung | null>(null);

/** Abschnitte des Codetexts: normaler Text, Pfad-Element und darin einzelne Befehle */
type Codeteil = { text: string; pfad?: number; befehl?: number };

export function Schritt8() {
  const r = ergebnis.value;
  const e = einstellungen.value;
  const [kopiert, setKopiert] = useState(false);
  const text = r?.svg?.text ?? '';
  const dok = useMemo(() => leseSvg(text), [text]);
  const geometrien = useMemo(() => dok.pfade.map((p) => befehlsGeometrie(p.befehle)), [dok]);
  const m = markiert.value;

  // Code in Teile zerlegen, damit jedes Element und jeder Befehl einzeln markiert werden kann
  const teile = useMemo(() => {
    const t: Codeteil[] = [];
    let pos = 0;
    dok.pfade.forEach((p, pi) => {
      t.push({ text: text.slice(pos, p.element.start) });
      let q = p.element.start;
      // Bei umgerechneten Formen liegen die Befehle nicht im Dokumenttext
      if (!p.umgerechnet) p.befehle.forEach((b, bi) => {
        if (b.start > q) t.push({ text: text.slice(q, b.start), pfad: pi });
        t.push({ text: text.slice(b.start, b.ende), pfad: pi, befehl: bi });
        q = b.ende;
      });
      t.push({ text: text.slice(q, p.element.ende), pfad: pi });
      pos = p.element.ende;
    });
    t.push({ text: text.slice(pos) });
    return t;
  }, [dok, text]);

  // Beim Zeigen in der Grafik den Code mitscrollen
  useEffect(() => {
    if (m?.quelle !== 'grafik') return;
    const sel = m.befehl === null ? `[data-pfad="${m.pfad}"]` : `[data-befehl="${m.pfad}-${m.befehl}"]`;
    document.querySelector(sel)?.scrollIntoView({ block: 'nearest' });
  }, [m?.pfad, m?.befehl, m?.quelle]);

  const markierteGeometrie = m && m.befehl !== null ? geometrien[m.pfad]?.get(m.befehl) : undefined;
  const markierterBefehl = m && m.befehl !== null ? dok.pfade[m.pfad]?.befehle[m.befehl] : undefined;

  const vorschau = (
    <div class="svg-vorschau" data-testid="svg-vorschau">
      <svg viewBox={`0 0 ${dok.breiteMm} ${dok.hoeheMm}`}>
        <rect width={dok.breiteMm} height={dok.hoeheMm} class="dokument" />
        {Array.from({ length: Math.floor(dok.breiteMm / 10) + 1 }, (_, i) => (
          <line x1={i * 10} x2={i * 10} y1={0} y2={dok.hoeheMm} class="raster-linie" />
        ))}
        {Array.from({ length: Math.floor(dok.hoeheMm / 10) + 1 }, (_, i) => (
          <line y1={i * 10} y2={i * 10} x1={0} x2={dok.breiteMm} class="raster-linie" />
        ))}
        {dok.pfade.map((p, i) => {
          const d = zeichenDaten(text, p);
          return (
            <path
              d={d}
              fill-rule="evenodd"
              class={`svg-form ${m?.pfad === i ? 'markiert' : ''}`}
              data-testid={`form-${i}`}
              onMouseMove={(ev) => {
                // Mausposition in SVG-Koordinaten (mm) umrechnen
                const svg = (ev.currentTarget as SVGPathElement).ownerSVGElement!;
                const ctm = svg.getScreenCTM();
                if (!ctm) return;
                const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
                const befehl = naechsterBefehl(geometrien[i]!, { x: pt.x, y: pt.y }, 0.2);
                if (m?.pfad !== i || m.befehl !== befehl) markiert.value = { pfad: i, befehl, quelle: 'grafik' };
              }}
              onMouseLeave={() => (markiert.value = null)}
            />
          );
        })}
        {markierteGeometrie && <Befehlsmarkierung g={markierteGeometrie} />}
      </svg>
      <p class="befehl-info" data-testid="befehl-info">
        {markierterBefehl
          ? befehlErklaerung(markierterBefehl.typ, markierteGeometrie)
          : m
            ? tx.svg.form(m.pfad + 1)
            : tx.svg.befehlHinweis}
      </p>
    </div>
  );

  const code = (
    <pre class="svg-code" data-testid="svg-code">
      {teile.map((teil) => {
        if (teil.pfad === undefined) return teil.text;
        const pfadMarkiert = m?.pfad === teil.pfad;
        if (teil.befehl === undefined) {
          return (
            <span
              class={`code-element ${pfadMarkiert ? 'markiert' : ''}`}
              data-pfad={teil.pfad}
              onMouseEnter={() => (markiert.value = { pfad: teil.pfad!, befehl: null, quelle: 'code' })}
              onMouseLeave={() => (markiert.value = null)}
            >
              {teil.text}
            </span>
          );
        }
        const befehlMarkiert = pfadMarkiert && m?.befehl === teil.befehl;
        return (
          <span
            class={`code-befehl ${pfadMarkiert ? 'markiert' : ''} ${befehlMarkiert ? 'aktiv' : ''}`}
            data-befehl={`${teil.pfad}-${teil.befehl}`}
            onMouseEnter={() => (markiert.value = { pfad: teil.pfad!, befehl: teil.befehl!, quelle: 'code' })}
            onMouseLeave={() => (markiert.value = null)}
          >
            {teil.text}
          </span>
        );
      })}
    </pre>
  );

  return (
    <Schrittansicht
      haupt={
        <div class="svg-teilung">
          {vorschau}
          {code}
        </div>
      }
      seite={
        <>
          <Kasten>
            <Regler label={tx.svg.breite} wert={e.breiteMm} min={5} max={600} onChange={(n) => setze('breiteMm', n)} />
            {r?.svg && <p>{tx.svg.hoehe(r.svg.hoeheMm - e.positionYMm)}</p>}
            <Regler label={tx.svg.positionX} wert={e.positionXMm} min={0} max={300} onChange={(n) => setze('positionXMm', n)} />
            <Regler label={tx.svg.positionY} wert={e.positionYMm} min={0} max={300} onChange={(n) => setze('positionYMm', n)} />
            {r?.svg && (
              <p class="klein">
                {tx.svg.massstab(r.svg.massstab)} · {tx.svg.formen(dok.pfade.length)}
              </p>
            )}
          </Kasten>
          <Kasten>
            <div class="knoepfe senkrecht">
              <button onClick={() => (bereich.value = 'werkstatt')}>{tx.svg.inWerkstatt}</button>
              <button onClick={() => speichereText(text, 'vom-pixel-zum-schnitt.svg', 'image/svg+xml')}>{tx.svg.herunterladenSvg}</button>
              <button onClick={() => speichereText(svgZuDxf(text).dxf, 'vom-pixel-zum-schnitt.dxf', 'application/dxf')}>
                {tx.svg.herunterladenDxf}
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 1500);
                }}
              >
                {kopiert ? tx.svg.kopiert : tx.svg.kopieren}
              </button>
            </div>
          </Kasten>
          <Erklaerung absaetze={tx.svg.erklaerung} />
        </>
      }
    />
  );
}

