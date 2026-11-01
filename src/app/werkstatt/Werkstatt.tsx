/**
 * SVG-Werkstatt: Code-Editor mit Live-Vorschau, Pfad-Erklärer, Cutter-Checks und Beispielen.
 * Grundlage ist das zentrale Dokument – dasselbe, das Simulation und Export lesen.
 */
import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { programme, programmTexte as tp } from '../../i18n/programme.de';
import { starteProgramm, type Lauf } from '../../programm/ausfuehren';
import { svgZuDxf } from '../../export/aus-svg';
import { speichereText } from '../../gemeinsam/datei';
import { t } from '../../i18n/de';
import { aendereText, dokument, nachgezeichnet, oeffneSvgText, STARTDOKUMENT, uebernimmNachzeichnen } from '../dokument';
import { Editor, type Marke } from './Editor';
import { Beispiele } from './Beispiele';
import { Checks, Erklaerer } from './Seitenleiste';
import { Vorschau } from './Vorschau';
import { anStelle, auswahl, cutterAnsicht, dok, markiert, modus, programmText, reiter, springeZu, sprung, zoom, type Reiter } from './zustand';

const tx = t.app.werkstatt;

/** Letzter Lauf des Programms */
const lauf = signal<Lauf | null>(null);
const laeuft = signal(false);

function Modusschalter() {
  return (
    <div class="modusschalter" role="tablist">
      {(['svg', 'programm'] as const).map((m) => (
        <button role="tab" aria-selected={modus.value === m} class={modus.value === m ? 'aktiv' : ''} onClick={() => (modus.value = m)}>
          {m === 'svg' ? tp.modusSvg : tp.modusProgramm}
        </button>
      ))}
    </div>
  );
}

function Werkzeugleiste() {
  const eingabe = useRef<HTMLInputElement>(null);
  const d = dokument.value;
  if (modus.value === 'programm') {
    return (
      <div class="werkzeugleiste">
        <Modusschalter />
        <select
          data-testid="programmvorlage"
          value=""
          onChange={(e) => {
            const v = programme.find((x) => x.id === e.currentTarget.value);
            e.currentTarget.value = '';
            if (v && confirm(tp.vorlageFrage)) programmText.value = v.code;
          }}
        >
          <option value="">{tp.vorlage}</option>
          {programme.map((v) => (
            <option value={v.id}>{v.titel}</option>
          ))}
        </select>
        <button onClick={() => speichereText(d.text, 'programm.svg', 'image/svg+xml')}>{tx.speichern}</button>
        <span class="klein quelle">{tp.hinweis}</span>
      </div>
    );
  }
  return (
    <div class="werkzeugleiste">
      <Modusschalter />
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

/** Ausgabe des Programms: Status, Fehler mit Zeile, Ausgaben, Befehlsübersicht */
function Programmausgabe() {
  const l = lauf.value;
  const zeilenStart = (n: number) => programmText.value.split('\n').slice(0, n - 1).reduce((s, z) => s + z.length + 1, 0);
  return (
    <div class="hinweisliste" data-testid="programmausgabe">
      {laeuft.value && <p class="klein">{tp.laeuft}</p>}
      {l && 'zeitlimit' in l && <p class="h-fehler">{tp.zeitlimit(l.ms)}</p>}
      {l && !('zeitlimit' in l) && (
        <>
          {l.fehler ? (
            <p class="h-fehler" data-testid="programmfehler">
              {tp.fehler}
              {l.fehler.zeile !== undefined && (
                <>
                  {' '}
                  <button class="verweis" onClick={() => springeZu(zeilenStart(l.fehler!.zeile!))}>
                    ({tp.zeile(l.fehler.zeile)})
                  </button>
                </>
              )}
              : {l.fehler.text}
            </p>
          ) : (
            <p class="klein" data-testid="programmstatus">{tp.ok(l.formen, l.ms)}</p>
          )}
          {l.ausgaben.length > 0 && (
            <>
              <p class="klein">{tp.ausgabe}:</p>
              <pre class="programm-ausgabe">{l.ausgaben.join('\n')}</pre>
            </>
          )}
        </>
      )}
      <details>
        <summary>{tp.hilfeTitel}</summary>
        <ul class="klein">
          {tp.hilfe.map((h) => (
            <li>
              <code>{h}</code>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Führt das Programm kurz nach jeder Änderung aus; die Ausgabe wird das zentrale Dokument. */
function useProgrammLauf() {
  const code = programmText.value;
  const aktiv = modus.value === 'programm';
  useEffect(() => {
    if (!aktiv) return;
    let abgebrochen = false;
    const uhr = setTimeout(async () => {
      laeuft.value = true;
      const ergebnis = await starteProgramm(code);
      if (abgebrochen) return;
      laeuft.value = false;
      lauf.value = ergebnis;
      if (!('zeitlimit' in ergebnis) && ergebnis.svg) {
        aendereText(ergebnis.svg);
        dokument.value = { ...dokument.value, name: 'programm.svg' };
      }
    }, 300);
    return () => {
      abgebrochen = true;
      clearTimeout(uhr);
    };
  }, [code, aktiv]);
}

export function Werkstatt() {
  const d = dok.value;
  const text = dokument.value.text;
  const m = markiert.value;
  const programmModus = modus.value === 'programm';
  useProgrammLauf();

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
        {programmModus ? (
          <Editor
            key="programm"
            sprache="javascript"
            text={programmText.value}
            onChange={(t) => (programmText.value = t)}
            marken={programmMarken(lauf.value, programmText.value)}
            sprung={sprung.value}
          />
        ) : (
        <Editor
          key="svg"
          text={text}
          onChange={aendereText}
          marken={marken}
          sprung={sprung.value}
          blick={blick ?? null}
          onCursor={(pos) => {
            // Nur auswählen, den Reiter nicht wechseln: Wer an einer Aufgabe arbeitet, behält sie im Blick
            const a = anStelle(d, pos);
            if (a) auswahl.value = a.pfad;
          }}
          onZeigen={(pos) => {
            const a = pos === null ? null : anStelle(d, pos);
            markiert.value = a ? { ...a, quelle: 'code' } : null;
          }}
        />
        )}
        {programmModus ? <Programmausgabe /> : <Hinweisliste />}
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

/** Fehlerzeile des Programms im Editor markieren */
function programmMarken(l: Lauf | null, code: string): Marke[] {
  if (!l || 'zeitlimit' in l || !l.fehler?.zeile) return [];
  const zeilen = code.split('\n');
  const start = zeilen.slice(0, l.fehler.zeile - 1).reduce((s, z) => s + z.length + 1, 0);
  return [{ start, ende: start + (zeilen[l.fehler.zeile - 1]?.length ?? 0), klasse: 'cm-fehler', titel: l.fehler.text }];
}
