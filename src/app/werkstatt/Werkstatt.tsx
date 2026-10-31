/**
 * SVG-Werkstatt: Code-Editor mit Live-Vorschau, Pfad-Erklärer, Cutter-Checks und Beispielen.
 * Grundlage ist das zentrale Dokument – dasselbe, das Simulation und Export lesen.
 */
import { useMemo, useRef } from 'preact/hooks';
import { svgZuDxf } from '../../export/aus-svg';
import { speichereText } from '../../gemeinsam/datei';
import { t } from '../../i18n/de';
import { aendereText, dokument, nachgezeichnet, oeffneSvgText, STARTDOKUMENT, uebernimmNachzeichnen } from '../dokument';
import { Editor, type Marke } from './Editor';
import { Beispiele } from './Beispiele';
import { Checks, Erklaerer } from './Seitenleiste';
import { Vorschau } from './Vorschau';
import { anStelle, auswahl, cutterAnsicht, dok, markiert, reiter, springeZu, sprung, zoom, type Reiter } from './zustand';

const tx = t.app.werkstatt;

function Werkzeugleiste() {
  const eingabe = useRef<HTMLInputElement>(null);
  const d = dokument.value;
  return (
    <div class="werkzeugleiste">
      <button onClick={() => eingabe.current?.click()}>{tx.oeffnen}</button>
      <input
        ref={eingabe}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        data-testid="svg-datei"
        onChange={async (e) => {
          // Das Feld vor dem Warten merken: Nach await ist e.currentTarget nicht mehr gesetzt
          const feld = e.currentTarget;
          const datei = feld.files?.[0];
          feld.value = '';
          if (datei) oeffneSvgText(await datei.text(), datei.name);
        }}
      />
      <button onClick={() => speichereText(d.text, d.name, 'image/svg+xml')}>{tx.speichern}</button>
      <button onClick={() => speichereText(svgZuDxf(d.text).dxf, d.name.replace(/\.svg$/i, '') + '.dxf', 'application/dxf')}>{tx.dxf}</button>
      <button
        onClick={() => {
          if (confirm(tx.neuFrage)) oeffneSvgText(STARTDOKUMENT, 'zeichnung.svg');
        }}
      >
        {tx.neu}
      </button>
      {d.quelle === 'eigen' && nachgezeichnet() && (
        <button
          onClick={() => {
            if (confirm(tx.uebernehmenFrage)) uebernimmNachzeichnen();
          }}
        >
          {tx.uebernehmen}
        </button>
      )}
      <span class="klein quelle" data-testid="quelle">
        {d.quelle === 'eigen' ? tx.eigeneFassung : tx.folgtNachzeichnen}
      </span>
    </div>
  );
}

function Hinweisliste() {
  const h = dok.value.hinweise;
  const fehler = h.filter((x) => x.art === 'fehler').length;
  return (
    <div class="hinweisliste" data-testid="hinweisliste">
      <p class="klein">
        {fehler === 0 ? tx.keineFehler : tx.fehler(fehler)}
        {h.length > fehler && ` · ${tx.hinweise(h.length - fehler)}`}
      </p>
      <ul>
        {h.map((x) => (
          <li class={x.art === 'fehler' ? 'h-fehler' : 'h-hinweis'}>
            {x.position !== undefined ? (
              <button class="verweis" title={tx.zurStelle} onClick={() => springeZu(x.position!, x.ende ?? x.position!)}>
                {x.text}
              </button>
            ) : (
              x.text
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Werkstatt() {
  const d = dok.value;
  const text = dokument.value.text;
  const m = markiert.value;

  // Markierungen im Code: Fehler und das gerade gezeigte Element bzw. den Befehl
  const marken = useMemo(() => {
    const liste: Marke[] = d.hinweise
      .filter((h) => h.position !== undefined)
      .map((h) => ({
        start: h.position!,
        ende: h.ende ?? h.position! + 1,
        klasse: h.art === 'fehler' ? 'cm-fehler' : 'cm-hinweis',
        titel: h.text,
      }));
    const p = m ? d.pfade[m.pfad] : undefined;
    if (p) {
      liste.push({ start: p.element.start, ende: p.element.ende, klasse: 'cm-element' });
      const b = m!.befehl !== null && !p.umgerechnet ? p.befehle[m!.befehl] : undefined;
      if (b) liste.push({ start: b.start, ende: b.ende, klasse: 'cm-befehl' });
    }
    return liste;
  }, [d, m?.pfad, m?.befehl]);

  const blick = m?.quelle === 'grafik' && d.pfade[m.pfad] ? (m.befehl !== null && !d.pfade[m.pfad]!.umgerechnet ? d.pfade[m.pfad]!.befehle[m.befehl]?.start : d.pfade[m.pfad]!.element.start) : null;

  return (
    <div class="werkstatt" data-testid="werkstatt">
      <section class="werkstatt-code">
        <Werkzeugleiste />
        <Editor
          text={text}
          onChange={aendereText}
          marken={marken}
          sprung={sprung.value}
          blick={blick ?? null}
          onCursor={(pos) => {
            const a = anStelle(d, pos);
            if (a) {
              auswahl.value = a.pfad;
              reiter.value = 'erklaerer';
            }
          }}
          onZeigen={(pos) => {
            const a = pos === null ? null : anStelle(d, pos);
            markiert.value = a ? { ...a, quelle: 'code' } : null;
          }}
        />
        <Hinweisliste />
      </section>
      <section class="werkstatt-vorschau">
        <div class="vorschau-leiste">
          <label class="schalter">
            <input type="checkbox" checked={cutterAnsicht.value} onChange={(e) => (cutterAnsicht.value = e.currentTarget.checked)} />
            {tx.cutterAnsicht}
          </label>
          <span class="knoepfe">
            <button onClick={() => (zoom.value = Math.max(0.25, zoom.value / 1.25))} title={tx.zoomRaus}>
              −
            </button>
            <button onClick={() => (zoom.value = 1)}>{tx.einpassen}</button>
            <button onClick={() => (zoom.value = Math.min(8, zoom.value * 1.25))} title={tx.zoomRein}>
              +
            </button>
          </span>
        </div>
        <Vorschau dok={d} />
      </section>
      <aside class="werkstatt-seite">
        <nav class="reiter">
          {(['erklaerer', 'checks', 'beispiele'] as Reiter[]).map((r) => (
            <button class={reiter.value === r ? 'aktiv' : ''} onClick={() => (reiter.value = r)}>
              {tx.reiter[r]}
            </button>
          ))}
        </nav>
        <div class="reiter-inhalt">
          {reiter.value === 'erklaerer' && <Erklaerer />}
          {reiter.value === 'checks' && <Checks />}
          {reiter.value === 'beispiele' && <Beispiele />}
        </div>
      </aside>
    </div>
  );
}
