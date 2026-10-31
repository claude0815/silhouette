/** Bausteine, die alle Schrittansichten verwenden. */
import type { ComponentChildren } from 'preact';
import type { Punkt } from '../../pipeline/bilder';
import { t } from '../../i18n/de';

/** Aufbau jeder Schrittansicht: links die große Ansicht, rechts Regler, Daten und Erklärung. */
export function Schrittansicht(props: { haupt: ComponentChildren; seite: ComponentChildren }) {
  return (
    <div class="schrittansicht">
      <div class="haupt">{props.haupt}</div>
      <aside class="seite">{props.seite}</aside>
    </div>
  );
}

export function Kasten(props: { titel?: string; children: ComponentChildren; testid?: string }) {
  return (
    <section class="kasten" data-testid={props.testid}>
      {props.titel && <h3>{props.titel}</h3>}
      {props.children}
    </section>
  );
}

/** Schieberegler mit Zahlenfeld daneben */
export function Regler(props: {
  label: string;
  wert: number;
  min: number;
  max: number;
  schritt?: number;
  deaktiviert?: boolean;
  onChange: (n: number) => void;
}) {
  const setze = (e: Event) => {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(n)) props.onChange(Math.min(props.max, Math.max(props.min, n)));
  };
  return (
    <label class="regler">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.schritt ?? 1}
        value={props.wert}
        disabled={props.deaktiviert}
        onInput={setze}
      />
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.schritt ?? 1}
        value={props.wert}
        disabled={props.deaktiviert}
        onChange={setze}
        aria-label={props.label}
      />
    </label>
  );
}

export function Schalter(props: { label: string; wert: boolean; onChange: (b: boolean) => void }) {
  return (
    <label class="schalter">
      <input type="checkbox" checked={props.wert} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      {props.label}
    </label>
  );
}

/** Aufklappbare Erklärung „Wie funktioniert das?“ */
export function Erklaerung(props: { absaetze: readonly string[] }) {
  return (
    <details class="erklaerung">
      <summary>{t.app.wieFunktioniert}</summary>
      {props.absaetze.map((a) => (
        <p>{a}</p>
      ))}
    </details>
  );
}

/**
 * Kleines Raster der Pixelwerte rund um den Mauszeiger.
 * `zelle` liefert Hintergrundfarbe und Text für ein Pixel.
 */
export function Pixelraster(props: {
  breite: number;
  hoehe: number;
  mitte: Punkt | null;
  radius: number;
  zelle: (x: number, y: number) => { farbe: string; text: string; hell?: boolean };
}) {
  if (!props.mitte) return <p class="klein">{t.app.keinPixel}</p>;
  const { x: mx, y: my } = props.mitte;
  const zeilen = [];
  for (let y = my - props.radius; y <= my + props.radius; y++) {
    const zellen = [];
    for (let x = mx - props.radius; x <= mx + props.radius; x++) {
      if (x < 0 || y < 0 || x >= props.breite || y >= props.hoehe) {
        zellen.push(<td class="aussen" />);
        continue;
      }
      const z = props.zelle(x, y);
      zellen.push(
        <td class={`${x === mx && y === my ? 'mitte' : ''} ${z.hell ? 'hell' : 'dunkel'}`} style={{ background: z.farbe }}>
          {z.text}
        </td>,
      );
    }
    zeilen.push(<tr>{zellen}</tr>);
  }
  return (
    <div>
      <p class="klein">
        {t.app.pixel(mx, my)} · {t.app.ausschnitt}
      </p>
      <table class="pixelraster" data-testid="pixelraster">
        <tbody>{zeilen}</tbody>
      </table>
    </div>
  );
}

/** Pfaddaten (d) für ein Vieleck in Pixelkoordinaten */
export function vieleckD(punkte: readonly Punkt[], schliessen = true): string {
  if (punkte.length === 0) return '';
  let d = `M${punkte[0]!.x} ${punkte[0]!.y}`;
  for (let i = 1; i < punkte.length; i++) d += `L${punkte[i]!.x} ${punkte[i]!.y}`;
  return schliessen ? d + 'Z' : d;
}
