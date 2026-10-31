/** Schritte 1 bis 4: Bild laden, Graustufen, Schwellwert, Entrauschen. */
import { useMemo, useRef, useState } from 'preact/hooks';
import { grauwert, LUMINANZ } from '../../pipeline/graustufen';
import { t } from '../../i18n/de';
import { speichereText } from '../../gemeinsam/datei';
import { Bildansicht } from '../Bildansicht';
import { ausBinaerbild, ausFarbbild, ausGraubild, binaerAlsCsv, speicherePng } from '../raster';
import { einstellungen, ergebnis, geladen, oeffneBeispiel, oeffneDatei, setze, zeiger } from '../zustand';
import { Erklaerung, Kasten, Pixelraster, Regler, Schalter, Schrittansicht } from './Bausteine';

const tx = t.app;

// ---------------------------------------------------------------------------
// 1. Bild laden

export function Ablage() {
  const [ziehtDrueber, setZiehtDrueber] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  return (
    <div
      class={`ablage ${ziehtDrueber ? 'aktiv' : ''}`}
      data-testid="ablage"
      onDragOver={(e) => {
        e.preventDefault();
        setZiehtDrueber(true);
      }}
      onDragLeave={() => setZiehtDrueber(false)}
      onDrop={(e) => {
        e.preventDefault();
        setZiehtDrueber(false);
        const datei = e.dataTransfer?.files[0];
        if (datei) void oeffneDatei(datei);
      }}
    >
      <p>{tx.laden.ziehen}</p>
      <p class="klein">{tx.laden.oder}</p>
      <div class="knoepfe">
        <button onClick={() => eingabe.current?.click()}>{tx.laden.waehlen}</button>
        <button onClick={oeffneBeispiel}>{tx.laden.beispiel}</button>
      </div>
      <input
        ref={eingabe}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        hidden
        data-testid="datei"
        onChange={(e) => {
          const datei = e.currentTarget.files?.[0];
          if (datei) void oeffneDatei(datei);
          e.currentTarget.value = '';
        }}
      />
      <p class="klein">{tx.laden.bleibtLokal}</p>
    </div>
  );
}

export function Schritt1() {
  const g = geladen.value!;
  const bild = useMemo(() => ausFarbbild(g.bild), [g.bild]);
  const { breite, hoehe, daten } = g.bild;
  return (
    <Schrittansicht
      haupt={<Bildansicht breite={breite} hoehe={hoehe} bild={bild} />}
      seite={
        <>
          <Kasten>
            <p>
              <strong>{g.name}</strong>
              <br />
              {tx.laden.groesse(breite, hoehe)}
            </p>
            {g.original && <p class="hinweis">{tx.laden.verkleinert(breite, hoehe, g.original.breite, g.original.hoehe)}</p>}
            <Ablage />
          </Kasten>
          <Kasten>
            <Pixelraster
              breite={breite}
              hoehe={hoehe}
              mitte={zeiger.value}
              radius={2}
              zelle={(x, y) => {
                const i = 4 * (y * breite + x);
                const [r, gr, b] = [daten[i]!, daten[i + 1]!, daten[i + 2]!];
                return { farbe: `rgb(${r},${gr},${b})`, text: `${r}\n${gr}\n${b}`, hell: grauwert(r, gr, b, 'luminanz') > 140 };
              }}
            />
            <button onClick={() => speicherePng(bild, 'schritt1-bild.png')}>{tx.alsPng}</button>
          </Kasten>
          <Erklaerung absaetze={tx.laden.erklaerung} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 2. Graustufen

export function Schritt2() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const e = einstellungen.value;
  const bild = useMemo(() => (r?.grau ? ausGraubild(r.grau) : null), [r?.grau]);
  const p = zeiger.value;
  const rechnung = (() => {
    if (!p) return null;
    const i = 4 * (p.y * g.breite + p.x);
    const [R, G, B] = [g.daten[i]!, g.daten[i + 1]!, g.daten[i + 2]!];
    const ergebnisWert = grauwert(R, G, B, e.grauVerfahren);
    return e.grauVerfahren === 'mittelwert'
      ? `(${R} + ${G} + ${B}) / 3 = ${ergebnisWert}`
      : `${LUMINANZ.r} · ${R} + ${LUMINANZ.g} · ${G} + ${LUMINANZ.b} · ${B} = ${ergebnisWert}`;
  })();
  return (
    <Schrittansicht
      haupt={<Bildansicht breite={g.breite} hoehe={g.hoehe} bild={bild} />}
      seite={
        <>
          <Kasten titel={tx.grau.verfahren}>
            {(['luminanz', 'mittelwert'] as const).map((v) => (
              <label class="schalter">
                <input type="radio" name="grau" checked={e.grauVerfahren === v} onChange={() => setze('grauVerfahren', v)} />
                {v === 'luminanz' ? tx.grau.luminanz : tx.grau.mittelwert}
              </label>
            ))}
            <p>
              {tx.grau.formel}: <code data-testid="formel">{r?.formel}</code>
            </p>
            {rechnung && (
              <p>
                {tx.grau.rechnung}: <code>{rechnung}</code>
              </p>
            )}
          </Kasten>
          <Kasten>
            {r?.grau && (
              <Pixelraster
                breite={g.breite}
                hoehe={g.hoehe}
                mitte={p}
                radius={3}
                zelle={(x, y) => {
                  const v = r.grau!.daten[y * g.breite + x]!;
                  return { farbe: `rgb(${v},${v},${v})`, text: String(v), hell: v > 140 };
                }}
              />
            )}
            {bild && <button onClick={() => speicherePng(bild, 'schritt2-graustufen.png')}>{tx.alsPng}</button>}
          </Kasten>
          <Erklaerung absaetze={tx.grau.erklaerung} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 3. Schwellwert

/** Histogramm als SVG mit Markierung des Schwellwerts. Klick setzt den Schwellwert. */
function Histogramm(props: { werte: Uint32Array; schwelle: number; otsu: number; onWahl: (t: number) => void }) {
  // Logarithmisch skaliert, sonst verschwinden kleine Berge neben dem riesigen Hintergrund-Berg
  const max = Math.log1p(Math.max(...props.werte));
  const balken = Array.from(props.werte, (n, g) => {
    const h = max > 0 ? (Math.log1p(n) / max) * 100 : 0;
    return <rect x={g} y={100 - h} width={1} height={h} fill={g < props.schwelle ? '#1e293b' : '#94a3b8'} />;
  });
  return (
    <svg
      class="histogramm"
      viewBox="0 0 256 112"
      preserveAspectRatio="none"
      data-testid="histogramm"
      onClick={(e) => {
        const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        props.onWahl(Math.round(((e.clientX - box.left) / box.width) * 256));
      }}
    >
      <rect x={0} y={0} width={256} height={100} fill="#f8fafc" />
      {balken}
      <line x1={props.otsu} x2={props.otsu} y1={0} y2={100} class="otsu-linie" />
      <line x1={props.schwelle} x2={props.schwelle} y1={0} y2={104} class="schwell-linie" />
      <rect x={0} y={104} width={256} height={8} fill="url(#grauverlauf)" />
      <defs>
        <linearGradient id="grauverlauf">
          <stop offset="0" stop-color="#000" />
          <stop offset="1" stop-color="#fff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Binaerdaten(props: { bild: { breite: number; hoehe: number; daten: Uint8Array }; geaendert?: Uint8Array }) {
  const { breite, hoehe, daten } = props.bild;
  return (
    <Pixelraster
      breite={breite}
      hoehe={hoehe}
      mitte={zeiger.value}
      radius={4}
      zelle={(x, y) => {
        const i = y * breite + x;
        const m = props.geaendert?.[i];
        const farbe = m === 1 ? '#fecaca' : m === 2 ? '#bfdbfe' : daten[i] ? '#1e293b' : '#fff';
        return { farbe, text: String(daten[i]), hell: !daten[i] || !!m };
      }}
    />
  );
}

export function Schritt3() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const e = einstellungen.value;
  const bild = useMemo(() => (r?.binaer ? ausBinaerbild(r.binaer) : null), [r?.binaer]);
  const vordergrund = useMemo(() => r?.binaer?.daten.reduce((s, v) => s + v, 0) ?? 0, [r?.binaer]);
  return (
    <Schrittansicht
      haupt={<Bildansicht breite={g.breite} hoehe={g.hoehe} bild={bild} />}
      seite={
        <>
          <Kasten titel={tx.schwelle.histogramm}>
            {r?.histogramm && (
              <Histogramm
                werte={r.histogramm}
                schwelle={r.schwelle!}
                otsu={r.otsuSchwelle!}
                onWahl={(w) => {
                  setze('schwelleAutomatisch', false);
                  setze('schwelle', w);
                }}
              />
            )}
            <Schalter label={tx.schwelle.automatisch} wert={e.schwelleAutomatisch} onChange={(b) => setze('schwelleAutomatisch', b)} />
            <Regler
              label={tx.schwelle.schwellwert}
              wert={e.schwelleAutomatisch ? (r?.schwelle ?? e.schwelle) : e.schwelle}
              min={0}
              max={256}
              deaktiviert={e.schwelleAutomatisch}
              onChange={(n) => setze('schwelle', n)}
            />
            {r?.otsuSchwelle !== undefined && <p class="klein">{tx.schwelle.otsuWert(r.otsuSchwelle)}</p>}
            <Schalter label={tx.schwelle.invertieren} wert={e.invertieren} onChange={(b) => setze('invertieren', b)} />
            <p class="klein" data-testid="vordergrund">
              {tx.schwelle.vordergrund(vordergrund, vordergrund / (g.breite * g.hoehe))}
            </p>
          </Kasten>
          <Kasten>
            {r?.binaer && <Binaerdaten bild={r.binaer} />}
            <div class="knoepfe">
              {bild && <button onClick={() => speicherePng(bild, 'schritt3-schwarzweiss.png')}>{tx.alsPng}</button>}
              {r?.binaer && (
                <button onClick={() => speichereText(binaerAlsCsv(r.binaer!), 'schritt3-matrix.csv', 'text/csv')}>{tx.alsCsv}</button>
              )}
            </div>
          </Kasten>
          <Erklaerung absaetze={tx.schwelle.erklaerung} />
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 4. Entrauschen

export function Schritt4() {
  const r = ergebnis.value;
  const g = geladen.value!.bild;
  const e = einstellungen.value;
  const bild = useMemo(
    () => (r?.entrauscht ? ausBinaerbild(r.binaer!, { geaendert: r.geaendert }) : null),
    [r?.entrauscht, r?.geaendert, r?.binaer],
  );
  const nachher = useMemo(() => (r?.entrauscht ? ausBinaerbild(r.entrauscht) : null), [r?.entrauscht]);
  return (
    <Schrittansicht
      haupt={<Bildansicht breite={g.breite} hoehe={g.hoehe} bild={bild} />}
      seite={
        <>
          <Kasten>
            <Schalter label={tx.rauschen.an} wert={e.entrauschen} onChange={(b) => setze('entrauschen', b)} />
            <Regler
              label={tx.rauschen.mindestflaeche}
              wert={e.mindestflaeche}
              min={1}
              max={500}
              deaktiviert={!e.entrauschen}
              onChange={(n) => setze('mindestflaeche', n)}
            />
            {r?.entfernteFlecken !== undefined && (
              <p data-testid="entrauscht">{tx.rauschen.ergebnis(r.entfernteFlecken, r.gefuellteLoecher!)}</p>
            )}
            <p class="legende">
              <span class="farbfeld fleck" /> {tx.rauschen.legendeFleck} <span class="farbfeld loch" /> {tx.rauschen.legendeLoch}
            </p>
          </Kasten>
          <Kasten>
            {r?.entrauscht && <Binaerdaten bild={r.entrauscht} geaendert={r.geaendert} />}
            {nachher && <button onClick={() => speicherePng(nachher, 'schritt4-entrauscht.png')}>{tx.alsPng}</button>}
          </Kasten>
          <Erklaerung absaetze={tx.rauschen.erklaerung} />
        </>
      }
    />
  );
}
