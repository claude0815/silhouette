/**
 * Größe und Lage des Motivs im zentralen Dokument ändern (Bereich „Schneiden“ und Werkstatt).
 *
 * Kommt das Dokument noch aus dem Nachzeichnen, werden die Regler von Schritt 8 verstellt;
 * so folgt das Dokument weiter dem Nachzeichnen. Sonst ändert sich nur die Wurzel des SVG
 * (width, height, viewBox), die Pfade bleiben unverändert.
 */
import { useMemo, useState } from 'preact/hooks';
import { t } from '../i18n/de';
import { leseSvg } from '../svg/dokument';
import { einpassen, motivRahmen, setzeGroesseUndLage } from '../svg/groesse';
import { istGespiegelt, schalteSpiegelung } from '../svg/spiegeln';
import { Schalter } from './schritte/Bausteine';
import { aendereText, dokument, nachgezeichnet } from './dokument';
import { einstellungen, setze } from './zustand';

const tg = t.app.groesse;
const runde = (n: number) => Math.round(n * 10) / 10;
const mm = (n: number) => String(runde(n)).replace('.', ',');

/** Folgt das Dokument gerade dem Nachzeichnen (und gibt es dort schon ein Ergebnis)? */
const ausNachzeichnen = () => dokument.value.quelle === 'nachzeichnen' && nachgezeichnet() === dokument.value.text;

/** Wendet die neue Größe und Lage an. Liefert einen Hinweis, wenn sie nicht genau erreicht wurde. */
function wende(ziel: { x: number; y: number; breite: number }): string | null {
  const d = dokument.value;
  const dok = leseSvg(d.text);
  const alt = motivRahmen(dok);
  if (!alt || alt.breite <= 0) return null;
  if (ausNachzeichnen()) {
    // Schritt 8 kennt die Breite des ganzen Bilds und den Abstand seiner linken oberen Ecke.
    // Das Motiv liegt darin um (alt − Position) versetzt; dieser Versatz wächst mit dem Maßstab.
    const e = einstellungen.value;
    const s = ziel.breite / alt.breite;
    const breite = e.breiteMm * s;
    const x = ziel.x - (alt.x - e.positionXMm) * s;
    const y = ziel.y - (alt.y - e.positionYMm) * s;
    const grenzen = { breite: [5, 600], x: [0, 300], y: [0, 300] } as const;
    const begrenzt = (n: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, n));
    setze('breiteMm', runde(begrenzt(breite, grenzen.breite)));
    setze('positionXMm', runde(begrenzt(x, grenzen.x)));
    setze('positionYMm', runde(begrenzt(y, grenzen.y)));
    const genau = breite >= 5 && breite <= 600 && x >= 0 && x <= 300 && y >= 0 && y <= 300;
    return genau ? null : tg.begrenzt;
  }
  const neu = setzeGroesseUndLage(d.text, dok, ziel);
  if (neu) aendereText(neu);
  return null;
}

/** Spiegeln ein- oder ausschalten; beim Nachzeichnen über den Schalter in Schritt 8 */
export function schalteSpiegeln(): void {
  if (ausNachzeichnen()) {
    setze('spiegeln', !einstellungen.value.spiegeln);
    return;
  }
  const text = dokument.value.text;
  const neu = schalteSpiegelung(text, leseSvg(text));
  if (neu) aendereText(neu);
}

export function GroesseUndLage(props: { bereich?: { breite: number; hoehe: number } }) {
  const text = dokument.value.text;
  const d = useMemo(() => leseSvg(text), [text]);
  const r = useMemo(() => motivRahmen(d), [d]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  if (!r) return <p class="klein">{tg.keinMotiv}</p>;
  const verhaeltnis = r.breite > 0 ? r.hoehe / r.breite : 1;
  const los = (ziel: { x: number; y: number; breite: number }) => setHinweis(wende(ziel));

  const feld = (label: string, wert: number, id: string, neu: (n: number) => { x: number; y: number; breite: number } | null, min = 0) => (
    <label class="zahlenfeld">
      {label}
      <input
        type="number"
        step={0.5}
        min={min}
        value={runde(wert)}
        data-testid={`groesse-${id}`}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          const ziel = Number.isFinite(n) && n >= min ? neu(n) : null;
          if (ziel) los(ziel);
          else e.currentTarget.value = String(runde(wert));
        }}
      />
    </label>
  );

  return (
    <div class="groesse" data-testid="groesse">
      <p data-testid="groesse-jetzt">{tg.jetzt(mm(r.breite), mm(r.hoehe))}</p>
      <div class="zahlenfelder">
        {feld(tg.breite, r.breite, 'breite', (n) => ({ x: r.x, y: r.y, breite: n }), 1)}
        {feld(tg.hoehe, r.hoehe, 'hoehe', (n) => (verhaeltnis > 0 ? { x: r.x, y: r.y, breite: n / verhaeltnis } : null), 1)}
      </div>
      <div class="zahlenfelder">
        {feld(tg.links, r.x, 'links', (n) => ({ x: n, y: r.y, breite: r.breite }))}
        {feld(tg.oben, r.y, 'oben', (n) => ({ x: r.x, y: n, breite: r.breite }))}
      </div>
      <div class="knoepfe">
        <button onClick={() => los({ x: r.x, y: r.y, breite: r.breite / 2 })}>{tg.halb}</button>
        <button onClick={() => los({ x: r.x, y: r.y, breite: r.breite * 2 })}>{tg.doppelt}</button>
        {props.bereich && (
          <button onClick={() => los(einpassen(r, props.bereich!, 10))} data-testid="groesse-einpassen">
            {tg.einpassen}
          </button>
        )}
      </div>
      <div data-testid="spiegeln">
        <Schalter label={tg.spiegeln} wert={istGespiegelt(d)} onChange={schalteSpiegeln} />
      </div>
      {hinweis && <p class="hinweis">{hinweis}</p>}
      <p class="klein">{ausNachzeichnen() ? tg.erklaerungNachzeichnen : tg.erklaerungEigen}</p>
      <p class="klein">{tg.spiegelnErklaerung}</p>
    </div>
  );
}
