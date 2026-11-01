/** Reiter der Werkstatt: Pfad-Erklärer und Cutter-Checks (Werkzeuge in Werkzeuge.tsx). */
import { matten, profile } from '../../cutter/profile';
import type { MattenId } from '../../cutter/types';
import { t } from '../../i18n/de';
import { attribut } from '../../svg/dokument';
import { befehlsGeometrie } from '../../svg/pfad';
import { istEinheit } from '../../svg/transform';
import { dokument } from '../dokument';
import { befehlErklaerung } from '../svgansicht';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { setzeBruecken } from '../../werkzeuge/bruecken';
import { aendereText } from '../dokument';
import { auswahl, befunde, befundMarkiert, dok, markiert, pruefMatte, pruefProfil, springeZu } from './zustand';

const tx = t.app.werkstatt;
const MAX_ZEILEN = 300;

export function Erklaerer() {
  const d = dok.value;
  const i = auswahl.value;
  const p = i !== null ? d.pfade[i] : undefined;
  if (!p) return <p class="klein">{tx.keineAuswahl}</p>;
  const text = dokument.value.text;
  const quelle = p.umgerechnet ?? text;
  const geometrie = befehlsGeometrie(p.befehle);
  const transform = attribut(p.element, 'transform')?.wert;
  const m = markiert.value;
  return (
    <div class="erklaerer" data-testid="erklaerer">
      <p>
        <strong>{tx.element(p.name, i! + 1)}</strong>
        {p.id && <span class="klein"> · id="{p.id}"</span>}
        <br />
        <span class="klein">{tx.fuellung(p.stil.fuellung, p.stil.kontur)}</span>
      </p>
      {!istEinheit(p.matrix) && <p class="hinweis">{tx.transformHinweis(transform)}</p>}
      {p.umgerechnet ? (
        <p class="klein">{tx.umgerechnetAus(p.name)}</p>
      ) : (
        <p class="klein">{tx.ziehenHinweis}</p>
      )}
      {p.befehle.some((b) => b.relativ) && <p class="klein">{tx.relativHinweis}</p>}
      <ol class="befehlsliste">
        {p.befehle.slice(0, MAX_ZEILEN).map((b, nr) => (
          <li
            class={m?.pfad === i && m.befehl === nr ? 'aktiv' : ''}
            onMouseEnter={() => (markiert.value = { pfad: i!, befehl: nr, quelle: 'liste' })}
            onMouseLeave={() => (markiert.value = null)}
            onClick={() => !p.umgerechnet && springeZu(b.start, b.ende)}
          >
            <code>{quelle.slice(b.start, b.ende)}</code>
            <span>{befehlErklaerung(b.typ, geometrie.get(nr))}</span>
          </li>
        ))}
      </ol>
      {p.befehle.length > MAX_ZEILEN && <p class="klein">{t.app.vereinfachen.weitere(p.befehle.length - MAX_ZEILEN)}</p>}
    </div>
  );
}

const SYMBOL: Record<string, string> = { ok: '✓', info: 'ℹ', warnung: '⚠' };

export function Checks() {
  return (
    <div class="checks" data-testid="checks">
      <div class="zahlenfelder">
        <label class="zahlenfeld">
          {tx.matte}
          <select value={pruefProfil.value} onChange={(e) => (pruefProfil.value = e.currentTarget.value)}>
            {profile.map((p) => (
              <option value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label class="zahlenfeld">
          &nbsp;
          <select value={pruefMatte.value} onChange={(e) => (pruefMatte.value = e.currentTarget.value as MattenId)}>
            {Object.entries(matten).map(([id, m]) => (
              <option value={id}>{m.name}</option>
            ))}
          </select>
        </label>
      </div>
      <ul class="befunde">
        {befunde.value.map((b) => {
          const text = tx.checks[b.id]!;
          return (
            <li
              class={`befund ${b.stufe}`}
              data-testid={`befund-${b.id}`}
              onMouseEnter={() => (befundMarkiert.value = b.id)}
              onMouseLeave={() => (befundMarkiert.value = null)}
            >
              <span class="symbol" title={tx.checkStufe[b.stufe]}>
                {SYMBOL[b.stufe]}
              </span>
              <div>
                <strong>{text.titel}</strong>
                <p>{b.anzahl > 0 ? text.befund(b.anzahl, b.wert) : text.ok}</p>
                <details>
                  <summary>{t.app.wieFunktioniert}</summary>
                  <p>{text.erklaerung}</p>
                </details>
                {b.id === 'inseln' &&
                  (b.anzahl > 0 ? (
                    <Brueckenformular />
                  ) : (
                    brueckenMeldung.value && <p class="geschafft" data-testid="bruecken-ergebnis">{brueckenMeldung.value}</p>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Meldung nach dem Setzen; bleibt stehen, auch wenn der Inseln-Befund danach verschwindet */
const brueckenMeldung = signal<string | null>(null);

/** Brücken setzen: hält die Inseln einer Schablone fest. */
function Brueckenformular() {
  const tb = tx.bruecken;
  const [breite, setBreite] = useState(2);
  const [richtung, setRichtung] = useState<'senkrecht' | 'waagerecht'>('senkrecht');
  return (
    <div class="bruecken" data-testid="bruecken">
      <div class="zahlenfelder">
        <label class="zahlenfeld">
          {tb.breite}
          <input
            type="number"
            min={0.5}
            max={20}
            step={0.5}
            value={breite}
            onChange={(e) => {
              const n = e.currentTarget.valueAsNumber;
              if (Number.isFinite(n) && n > 0) setBreite(n);
            }}
          />
        </label>
        <label class="zahlenfeld">
          {tb.richtung}
          <select value={richtung} onChange={(e) => setRichtung(e.currentTarget.value as 'senkrecht' | 'waagerecht')}>
            <option value="senkrecht">{tb.senkrecht}</option>
            <option value="waagerecht">{tb.waagerecht}</option>
          </select>
        </label>
      </div>
      <button
        onClick={() => {
          const r = setzeBruecken(dokument.value.text, dok.value, { breiteMm: breite, richtung });
          if (r) {
            brueckenMeldung.value = tb.ergebnis(r.inseln);
            aendereText(r.text);
          }
        }}
      >
        {tb.setzen}
      </button>
      <p class="klein">{tb.hinweis}</p>
    </div>
  );
}
