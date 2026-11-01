/** Reiter „Werkzeuge“: Konturen versetzen (Offset) mit Anzeige der Abstandskarte. */
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n/de';
import { versatzInSvg, versetze, type VersatzErgebnis } from '../../werkzeuge/versatz';
import { aendereText, dokument } from '../dokument';
import { auswahl, dok } from './zustand';

const tv = t.app.werkstatt.versatz;

/** Letzte Rechnung (für die Abstandskarte) und Meldung; bleiben nach dem Einfügen stehen */
const letzte = signal<{ ergebnis: VersatzErgebnis; abstandMm: number } | null>(null);
const meldung = signal<string | null>(null);

export function Werkzeuge() {
  const [abstand, setAbstand] = useState(3);
  const [nurAuswahl, setNurAuswahl] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const gewaehlt = auswahl.value;
  const mitAuswahl = nurAuswahl && gewaehlt !== null;

  const ausfuehren = () => {
    const pfade = mitAuswahl ? [gewaehlt] : undefined;
    const ergebnis = versetze(dok.value, { abstandMm: abstand, pfade });
    if (!ergebnis) {
      meldung.value = tv.keineFormen;
      letzte.value = null;
      return;
    }
    letzte.value = { ergebnis, abstandMm: abstand };
    if (ergebnis.konturen.length === 0) {
      meldung.value = tv.nichtsUebrig;
      return;
    }
    meldung.value = tv.ergebnis(ergebnis.konturen.length, ergebnis.zelle);
    aendereText(versatzInSvg(dokument.value.text, dok.value, ergebnis.konturen, { abstandMm: abstand, ersetzen, pfade }));
  };

  return (
    <div class="werkzeuge" data-testid="versatz">
      <h3>{tv.titel}</h3>
      <p class="klein">{tv.einleitung}</p>
      <div class="zahlenfelder">
        <label class="zahlenfeld">
          {tv.abstand}
          <input
            type="number"
            min={-20}
            max={20}
            step={0.5}
            value={abstand}
            data-testid="versatz-abstand"
            onChange={(e) => {
              const n = e.currentTarget.valueAsNumber;
              if (Number.isFinite(n) && n !== 0 && Math.abs(n) <= 20) setAbstand(n);
            }}
          />
        </label>
      </div>
      <label class="haken">
        <input type="checkbox" checked={nurAuswahl} onChange={(e) => setNurAuswahl(e.currentTarget.checked)} />
        {gewaehlt === null ? tv.nurAuswahlKeine : tv.nurAuswahl(dok.value.pfade[gewaehlt]?.name ?? '')}
      </label>
      <label class="haken">
        <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.currentTarget.checked)} />
        {tv.ersetzen}
      </label>
      <button onClick={ausfuehren} data-testid="versatz-los">
        {abstand >= 0 ? tv.nachAussen : tv.nachInnen}
      </button>
      {meldung.value && (
        <p class="geschafft" data-testid="versatz-ergebnis">
          {meldung.value}
        </p>
      )}
      {letzte.value && <Abstandskarte {...letzte.value} />}
      <details class="erklaerung">
        <summary>{tv.wieTitel}</summary>
        <ol>
          {tv.wieSchritte.map((s) => (
            <li>{s}</li>
          ))}
        </ol>
        <p class="klein">{tv.wieFolgen}</p>
      </details>
    </div>
  );
}

/**
 * Zeichnet die Abstandskarte: je heller, desto weiter von der Form (bzw. vom Rand) entfernt.
 * Die Form selbst ist blau, der neue Bereich bis zum Versatz rot getönt.
 */
function Abstandskarte({ ergebnis, abstandMm }: { ergebnis: VersatzErgebnis; abstandMm: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { raster } = ergebnis;
  // Höchstens 320 Bildpunkte breit/hoch: jede Zelle der Anzeige fasst mehrere Rasterzellen zusammen
  const schritt = Math.max(1, Math.ceil(Math.max(raster.breite, raster.hoehe) / 320));
  const b = Math.ceil(raster.breite / schritt);
  const h = Math.ceil(raster.hoehe / schritt);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const bild = ctx.createImageData(b, h);
    const werte = ergebnis.abstandMm;
    let max = 0;
    for (const w of werte) if (w !== Infinity && w > max) max = w;
    const grenze = Math.abs(abstandMm);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < b; x++) {
        const i = y * schritt * raster.breite + x * schritt;
        const w = werte[i]!;
        const innen = raster.daten[i] === 1;
        const hell = w === Infinity ? 255 : Math.round(40 + 215 * Math.min(1, w / (max || 1)));
        let rgb: [number, number, number] = [hell, hell, hell];
        if (abstandMm >= 0) {
          if (innen) rgb = [37, 99, 235];
          else if (w <= grenze) rgb = [Math.min(255, hell + 60), hell * 0.6, hell * 0.6];
        } else {
          if (!innen) rgb = [241, 245, 249];
          else if (w <= grenze) rgb = [220, 38, 38];
          else rgb = [hell * 0.4, hell * 0.6, 255];
        }
        const o = (y * b + x) * 4;
        bild.data[o] = rgb[0];
        bild.data[o + 1] = rgb[1];
        bild.data[o + 2] = rgb[2];
        bild.data[o + 3] = 255;
      }
    ctx.putImageData(bild, 0, 0);
  }, [ergebnis, abstandMm, b, h, schritt]);
  return (
    <figure class="abstandskarte">
      <canvas ref={ref} width={b} height={h} data-testid="abstandskarte" />
      <figcaption class="klein">{abstandMm >= 0 ? tv.karteAussen : tv.karteInnen}</figcaption>
    </figure>
  );
}
