/** Die Abschnitte der Testseite. Logik steckt in zustand.ts, hier nur die Anzeige. */
import { useSignal } from '@preact/signals';
import { matten, schneidebereichMm } from '../cutter/profile';
import { polylinienZuDxf, type DxfVariante } from '../export/dxf';
import { testformen } from '../export/testformen';
import { speichereText } from '../gemeinsam/datei';
import type { MattenId } from '../cutter/types';
import { t } from '../i18n/de';
import { berichtAlsMarkdown, berichtDateiname, erkenneBetriebssystem, protokollAlsText, protokollZeile } from './bericht';
import { pruefeUmgebung } from './umgebung';
import * as z from './zustand';

const tx = t.cutterTest;

export const betriebssystem = erkenneBetriebssystem(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '',
);

// ---------------------------------------------------------------------------

export function Umgebung() {
  const u = pruefeUmgebung(globalThis);
  const zeile = (name: string, ok: boolean) => (
    <li>
      {name}: <span class={ok ? 'ok' : 'fehlt'}>{ok ? tx.vorhanden : tx.fehlt}</span>
    </li>
  );
  return (
    <section>
      <h2>{tx.umgebung}</h2>
      <ul>
        {zeile(tx.sichererKontext, u.sichererKontext)}
        {zeile(tx.webUsb, u.webUsb)}
        {zeile(tx.webBluetooth, u.webBluetooth)}
        <li>
          {tx.betriebssystem}: {betriebssystem}
        </li>
      </ul>
      {(!u.webUsb || !u.webBluetooth) && <p class="hinweis">{tx.hinweisBrowser}</p>}
      {betriebssystem === 'Windows' && <p class="hinweis">{tx.hinweisWindows}</p>}
      {betriebssystem === 'macOS' && <p class="hinweis">{tx.hinweisMac}</p>}
      <p class="hinweis warnung">{tx.hinweisSicherheit}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Verbindung() {
  const u = pruefeUmgebung(globalThis);
  const c = z.cutter.value;
  const beschaeftigt = z.verbindet.value || z.laeuft.value;
  return (
    <section>
      <h2>{tx.verbindung}</h2>
      <div class="knoepfe">
        <button onClick={z.verbindeUsb} disabled={!u.webUsb || beschaeftigt}>
          {tx.perUsb}
        </button>
        <button onClick={z.verbindeBluetooth} disabled={!u.webBluetooth || beschaeftigt}>
          {tx.perBluetooth}
        </button>
        <button onClick={z.verbindeSimulation} disabled={beschaeftigt}>
          {tx.simulation}
        </button>
        {c && (
          <button onClick={z.trenne} disabled={z.laeuft.value}>
            {tx.trennen}
          </button>
        )}
      </div>
      <label class="zeile">
        <input
          type="checkbox"
          checked={z.alleBluetooth.value}
          onChange={(e) => (z.alleBluetooth.value = e.currentTarget.checked)}
        />
        {tx.alleBluetooth}
      </label>

      {z.verbindet.value && <p>{tx.verbindet}</p>}
      {!z.verbindet.value && !c && <p>{tx.nichtVerbunden}</p>}
      {c && (
        <div class="geraet" data-testid="geraet">
          <strong>{tx.verbundenMit(c.name)}</strong>
          <dl>
            <dt>{tx.modell}</dt>
            <dd>{c.profil && c.profil.id !== 'unbekannt' ? c.profil.name : tx.unbekanntesModell}</dd>
            <dt>{tx.firmware}</dt>
            <dd>{c.firmware ?? '–'}</dd>
            <dt>{tx.status}</dt>
            <dd data-testid="status">
              {z.status.value ? (tx.statusTexte[z.status.value.status] ?? z.status.value.status) : '–'}
              {z.status.value && (
                <span class="klein">
                  {' '}
                  ({tx.rohantwort}: „{z.status.value.roh}“)
                </span>
              )}
            </dd>
          </dl>
          <button onClick={z.frageStatus} disabled={z.laeuft.value}>
            {tx.statusAbfragen}
          </button>
        </div>
      )}
      <Fehler />
    </section>
  );
}

function Fehler() {
  const f = z.fehler.value;
  if (!f) return null;
  return (
    <div class="fehlermeldung" role="alert">
      <strong>{f.text}</strong>
      {f.tipp && (
        <p>
          {tx.tipp}: {f.tipp}
        </p>
      )}
      {f.technisch && (
        <p class="klein">
          {tx.technisch}: <code>{f.technisch}</code>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Zahl(props: { label: string; wert: { value: number }; min: number; max: number; schritt?: number }) {
  return (
    <label>
      {props.label}
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.schritt ?? 1}
        value={props.wert.value}
        onInput={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) props.wert.value = n;
        }}
      />
    </label>
  );
}

export function Testauftrag() {
  const c = z.cutter.value;
  const v = z.vorschau.value;
  const laeuft = z.laeuft.value;
  return (
    <section>
      <h2>{tx.testauftrag}</h2>
      <div class="raster">
        <div class="formular">
          <Zahl label={tx.seite} wert={z.seiteMm} min={1} max={300} />
          <Zahl label={tx.abstand} wert={z.abstandMm} min={0} max={300} />
          <label>
            {tx.werkzeug}
            <select
              value={z.werkzeugArt.value}
              onChange={(e) => (z.werkzeugArt.value = e.currentTarget.value as 'stift' | 'messer')}
            >
              <option value="stift">{tx.stift}</option>
              <option value="messer">{tx.messer}</option>
            </select>
          </label>
          <Zahl label={tx.druck} wert={z.druck} min={1} max={33} />
          <Zahl label={tx.geschwindigkeit} wert={z.geschwindigkeit} min={1} max={30} />
          <label>
            {tx.halter}
            <select value={z.halter.value} onChange={(e) => (z.halter.value = Number(e.currentTarget.value) as 1 | 2)}>
              <option value={1}>1</option>
              <option value={2} disabled={c?.profil?.zweiHalter === false}>
                2
              </option>
            </select>
          </label>
          <label>
            {tx.matte}
            <select value={z.matte.value} onChange={(e) => (z.matte.value = e.currentTarget.value as MattenId)}>
              {Object.entries(matten).map(([id, m]) => (
                <option value={id}>{m.name}</option>
              ))}
            </select>
          </label>
        </div>
        <Mattenvorschau />
      </div>
      {z.werkzeugArt.value === 'messer' && <p class="hinweis warnung">{tx.warnungMesser}</p>}

      <div class="knoepfe">
        <button onClick={z.zeichne} disabled={!c || laeuft || 'fehler' in v}>
          {tx.zeichnen}
        </button>
        <button class="abbrechen" onClick={z.brichAb} disabled={!laeuft}>
          {tx.abbrechen}
        </button>
        <button onClick={z.setzeZurueck} disabled={!c} title={tx.zuruecksetzenErklaerung}>
          {tx.zuruecksetzen}
        </button>
      </div>
      {z.fortschritt.value !== null && (laeuft || z.fertig.value) && (
        <p>
          <progress value={z.fortschritt.value} max={1} /> {tx.fortschritt(Math.round(z.fortschritt.value * 100))}
        </p>
      )}
      {z.fertig.value && !laeuft && <p class="ok">{tx.fertig}</p>}

      {'fehler' in v && <p class="fehlt">{v.fehler}</p>}
      {'befehle' in v && v.befehle.length > 0 && (
        <details>
          <summary>
            {tx.befehle} ({v.befehle.length})
          </summary>
          <pre class="befehle">{v.befehle.join('\n')}</pre>
        </details>
      )}
    </section>
  );
}

/** Zeigt Matte bzw. Schneidebereich und das Quadrat maßstäblich, y nach unten wie beim Cutter. */
function Mattenvorschau() {
  const profil = z.cutter.value?.profil;
  const m = matten[z.matte.value];
  const bereich = profil
    ? schneidebereichMm(profil, z.matte.value)
    : { breite: (m.breiteZoll ?? 12) * 25.4, hoehe: (m.hoeheZoll ?? 12) * 25.4 };
  const hoehe = Math.min(bereich.hoehe, 610);
  const a = z.abstandMm.value;
  const s = z.seiteMm.value;
  return (
    <figure class="mattenvorschau">
      <svg viewBox={`-5 -5 ${bereich.breite + 10} ${hoehe + 10}`} role="img" aria-label={tx.vorschau}>
        <rect x={0} y={0} width={bereich.breite} height={hoehe} class="matte" />
        <rect x={a} y={a} width={s} height={s} class="quadrat" />
        <circle cx={0} cy={0} r={3} class="ursprung" />
      </svg>
      <figcaption>
        {tx.vorschau}: {bereich.breite.toFixed(1).replace('.', ',')} × {bereich.hoehe.toFixed(1).replace('.', ',')} mm
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------

async function kopiere(text: string, kopiert: { value: boolean }) {
  await navigator.clipboard.writeText(text);
  kopiert.value = true;
  setTimeout(() => (kopiert.value = false), 1500);
}

export function Protokoll() {
  const kopiert = useSignal(false);
  const eintraege = z.protokoll.value;
  return (
    <section>
      <h2>{tx.protokoll}</h2>
      <div class="knoepfe">
        <button onClick={() => kopiere(protokollAlsText(eintraege), kopiert)} disabled={eintraege.length === 0}>
          {kopiert.value ? tx.kopiert : tx.kopieren}
        </button>
        <button onClick={() => (z.protokoll.value = [])} disabled={eintraege.length === 0}>
          {tx.leeren}
        </button>
      </div>
      <pre class="protokoll" data-testid="protokoll">
        {eintraege.length === 0
          ? tx.protokollLeer
          : eintraege.map((e) => <div class={`eintrag ${e.richtung}`}>{protokollZeile(e)}</div>)}
      </pre>
    </section>
  );
}

// ---------------------------------------------------------------------------

function berichtText(): string {
  const c = z.cutter.value;
  return berichtAlsMarkdown({
    datum: new Date(),
    browser: navigator.userAgent,
    betriebssystem,
    geraet: c?.name,
    firmware: c?.firmware,
    checkliste: z.checkliste.value,
    protokoll: z.protokoll.value,
  });
}

function ladeHerunter() {
  speichereDatei(berichtText(), berichtDateiname(new Date()), 'text/markdown');
}

export function Checkliste() {
  const kopiert = useSignal(false);
  return (
    <section>
      <h2>{tx.checkliste}</h2>
      <p class="klein">{tx.checklisteHinweis}</p>
      <ol class="checkliste">
        {tx.punkte.map((text, i) => {
          const p = z.checkliste.value[i]!;
          return (
            <li>
              <label class="zeile">
                <input
                  type="checkbox"
                  checked={p.erledigt}
                  onChange={(e) => z.aendereCheckliste(i, { erledigt: e.currentTarget.checked })}
                />
                {text}
              </label>
              <textarea
                aria-label={`${tx.notiz} ${i + 1}`}
                placeholder={tx.notiz}
                rows={1}
                value={p.notiz}
                onInput={(e) => z.aendereCheckliste(i, { notiz: e.currentTarget.value })}
              />
            </li>
          );
        })}
      </ol>
      <div class="knoepfe">
        <button onClick={ladeHerunter}>{tx.bericht}</button>
        <button onClick={() => kopiere(berichtText(), kopiert)}>{kopiert.value ? tx.kopiert : tx.berichtKopieren}</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const speichereDatei = speichereText;

const FLAECHE = { breite: 200, hoehe: 70 };

function ladeDxf(variante: DxfVariante) {
  const pfade = testformen().flatMap((f) => f.pfade);
  speichereDatei(
    polylinienZuDxf(pfade, { variante, hoeheMm: FLAECHE.hoehe }),
    `testformen-${variante}.dxf`,
    'application/dxf',
  );
}

export function DxfTest() {
  const formen = testformen();
  const d = (pfad: readonly { x: number; y: number }[]) =>
    pfad.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <section>
      <h2>{tx.dxf}</h2>
      <p>{tx.dxfErklaerung}</p>
      <svg
        class="testformen"
        viewBox={`0 0 ${FLAECHE.breite} ${FLAECHE.hoehe}`}
        role="img"
        aria-label={tx.dxf}
      >
        <rect width={FLAECHE.breite} height={FLAECHE.hoehe} class="flaeche" />
        {formen.flatMap((f) => f.pfade.map((p) => <path d={d(p)} />))}
      </svg>
      <h3>{tx.dxfPruefen}</h3>
      <ul>
        {formen.map((f) => (
          <li>
            <strong>{f.name}:</strong> {f.beschreibung}
          </li>
        ))}
      </ul>
      <div class="knoepfe">
        <button onClick={() => ladeDxf('polylinie')}>{tx.dxfPolylinie}</button>
        <button onClick={() => ladeDxf('linien')}>{tx.dxfLinien}</button>
      </div>
      <ul class="klein">
        <li>{tx.dxfVariantePolylinie}</li>
        <li>{tx.dxfVarianteLinien}</li>
      </ul>
    </section>
  );
}
