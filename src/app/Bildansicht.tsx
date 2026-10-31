/**
 * Bildansicht mit Zoom bis auf einzelne Pixel.
 * Darunter liegt ein Canvas mit den Rasterdaten, darüber optional ein SVG in denselben
 * Pixelkoordinaten (Konturen, Punkte, Kurven).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/de';
import { zeiger } from './zustand';

export interface BildansichtProps {
  breite: number;
  hoehe: number;
  /** Rasterdaten; null = nur Überlagerung */
  bild: ImageData | null;
  /** Überlagerung in Pixelkoordinaten. `linie` = Strichbreite für ca. 1,5 Bildschirmpixel. */
  ueberlagerung?: (linie: number) => ComponentChildren;
  onKlick?: (x: number, y: number) => void;
}

interface Sicht {
  massstab: number;
  x: number;
  y: number;
}

export function Bildansicht(props: BildansichtProps) {
  const rahmen = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [sicht, setSicht] = useState<Sicht>({ massstab: 1, x: 0, y: 0 });
  const ziehen = useRef<{ x: number; y: number; sx: number; sy: number; bewegt: boolean } | null>(null);

  /** Ganzes Bild einpassen */
  const einpassen = () => {
    const r = rahmen.current;
    if (!r) return;
    const m = Math.min(r.clientWidth / props.breite, r.clientHeight / props.hoehe) * 0.95;
    setSicht({ massstab: m, x: (r.clientWidth - props.breite * m) / 2, y: (r.clientHeight - props.hoehe * m) / 2 });
  };
  useLayoutEffect(einpassen, [props.breite, props.hoehe]);

  useEffect(() => {
    const c = leinwand.current;
    if (!c || !props.bild) return;
    c.width = props.bild.width;
    c.height = props.bild.height;
    c.getContext('2d')!.putImageData(props.bild, 0, 0);
  }, [props.bild]);

  // Mausrad zoomt um den Mauszeiger; passiv: false, damit die Seite nicht scrollt.
  useEffect(() => {
    const r = rahmen.current;
    if (!r) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const box = r.getBoundingClientRect();
      const mx = e.clientX - box.left;
      const my = e.clientY - box.top;
      setSicht((s) => {
        const m = Math.min(64, Math.max(0.05, s.massstab * Math.pow(1.0015, -e.deltaY)));
        const f = m / s.massstab;
        return { massstab: m, x: mx - (mx - s.x) * f, y: my - (my - s.y) * f };
      });
    };
    r.addEventListener('wheel', rad, { passive: false });
    return () => r.removeEventListener('wheel', rad);
  }, []);

  const pixelUnter = (e: PointerEvent | MouseEvent) => {
    const box = rahmen.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - box.left - sicht.x) / sicht.massstab);
    const y = Math.floor((e.clientY - box.top - sicht.y) / sicht.massstab);
    return x >= 0 && y >= 0 && x < props.breite && y < props.hoehe ? { x, y } : null;
  };

  return (
    <div class="bildansicht-huelle">
      <div
        ref={rahmen}
        class="bildansicht"
        data-testid="bildansicht"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          ziehen.current = { x: e.clientX, y: e.clientY, sx: sicht.x, sy: sicht.y, bewegt: false };
        }}
        onPointerMove={(e) => {
          const z = ziehen.current;
          if (z) {
            const dx = e.clientX - z.x;
            const dy = e.clientY - z.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) z.bewegt = true;
            if (z.bewegt) setSicht((s) => ({ ...s, x: z.sx + dx, y: z.sy + dy }));
          }
          zeiger.value = pixelUnter(e);
        }}
        onPointerUp={(e) => {
          const z = ziehen.current;
          ziehen.current = null;
          if (z && !z.bewegt && props.onKlick) {
            const p = pixelUnter(e);
            if (p) props.onKlick(p.x, p.y);
          }
        }}
        onPointerLeave={() => (zeiger.value = null)}
        onDblClick={einpassen}
      >
        <div
          class="bildansicht-inhalt"
          style={{
            width: `${props.breite}px`,
            height: `${props.hoehe}px`,
            transform: `translate(${sicht.x}px, ${sicht.y}px) scale(${sicht.massstab})`,
          }}
        >
          {props.bild && <canvas ref={leinwand} class="pixelig" />}
          {props.ueberlagerung && (
            <svg class="ueberlagerung" width={props.breite} height={props.hoehe} viewBox={`0 0 ${props.breite} ${props.hoehe}`}>
              {props.ueberlagerung(1.5 / sicht.massstab)}
            </svg>
          )}
          {sicht.massstab >= 12 && zeiger.value && (
            <div
              class="pixelrahmen"
              style={{ left: `${zeiger.value.x}px`, top: `${zeiger.value.y}px`, borderWidth: `${2 / sicht.massstab}px` }}
            />
          )}
        </div>
      </div>
      <div class="bildansicht-fuss klein">
        {t.app.zoomHinweis} · {Math.round(sicht.massstab * 100)} %
      </div>
    </div>
  );
}
