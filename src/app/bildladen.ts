/** Bilder laden: aus einer Datei oder als eingebautes Beispielbild. */
import type { Farbbild, Rechteck } from '../pipeline/bilder';

/** Größte erlaubte Kantenlänge; größere Bilder werden verkleinert. */
export const MAX_KANTE = 2000;

export interface GeladenesBild {
  bild: Farbbild;
  name: string;
  /** Originalgröße, falls verkleinert wurde */
  original?: { breite: number; hoehe: number };
  /** Bild vor dem Zuschnitt und das gewählte Rechteck, falls zugeschnitten wurde */
  zuschnitt?: { vorher: Farbbild; rechteck: Rechteck };
}

function leinwand(breite: number, hoehe: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  return c.getContext('2d', { willReadFrequently: true })!;
}

function auslesen(ctx: CanvasRenderingContext2D): Farbbild {
  const { width, height } = ctx.canvas;
  return { breite: width, hoehe: height, daten: ctx.getImageData(0, 0, width, height).data };
}

/** Liest eine Bilddatei; zu große Bilder werden verkleinert. Das Bild verlässt das Gerät nicht. */
export async function ladeDatei(datei: File): Promise<GeladenesBild> {
  const bitmap = await createImageBitmap(datei);
  const faktor = Math.min(1, MAX_KANTE / Math.max(bitmap.width, bitmap.height));
  const breite = Math.max(1, Math.round(bitmap.width * faktor));
  const hoehe = Math.max(1, Math.round(bitmap.height * faktor));
  const ctx = leinwand(breite, hoehe);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close();
  return {
    bild: auslesen(ctx),
    name: datei.name,
    original: faktor < 1 ? { breite: bitmap.width, hoehe: bitmap.height } : undefined,
  };
}

/**
 * Beispielbild ohne externe Datei: Schriftzug, Ring mit Loch, Stern, dazu etwas Schmutz
 * und weiche Kanten – damit jeder Schritt etwas zu tun hat.
 */
export function beispielbild(): GeladenesBild {
  const breite = 640;
  const hoehe = 400;
  const ctx = leinwand(breite, hoehe);
  ctx.fillStyle = '#f4f1ea'; // leicht getöntes Papier
  ctx.fillRect(0, 0, breite, hoehe);

  ctx.fillStyle = '#1d3557';
  ctx.font = 'bold 150px system-ui, "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('SVG', 30, 120);

  // Ring mit Loch
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(510, 115, 85, 0, 2 * Math.PI);
  ctx.arc(510, 115, 45, 0, 2 * Math.PI, true);
  ctx.fill();

  // Stern
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 90 : 38;
    const w = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(140 + r * Math.cos(w), 300 + r * Math.sin(w));
  }
  ctx.closePath();
  ctx.fill();

  // Herz aus zwei Bézier-Kurven
  ctx.fillStyle = '#6d597a';
  ctx.beginPath();
  ctx.moveTo(400, 260);
  ctx.bezierCurveTo(400, 215, 330, 215, 330, 265);
  ctx.bezierCurveTo(330, 305, 380, 330, 400, 360);
  ctx.bezierCurveTo(420, 330, 470, 305, 470, 265);
  ctx.bezierCurveTo(470, 215, 400, 215, 400, 260);
  ctx.fill();

  // Schmutz: kleine Punkte, die das Entrauschen entfernen soll
  let saat = 7;
  const zufall = () => ((saat = (saat * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = '#333';
  for (let i = 0; i < 60; i++) {
    const r = 0.6 + zufall() * 1.4;
    ctx.beginPath();
    ctx.arc(zufall() * breite, zufall() * hoehe, r, 0, 2 * Math.PI);
    ctx.fill();
  }
  return { bild: auslesen(ctx), name: 'beispiel.png' };
}
