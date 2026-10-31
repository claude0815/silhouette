/** Rasterdaten der Schritte als ImageData für die Anzeige und als PNG zum Speichern. */
import type { Binaerbild, Farbbild, Graubild } from '../pipeline/bilder';
import { FLECK_ENTFERNT, LOCH_GEFUELLT } from '../pipeline/entrauschen';
import { speichereBlob } from '../gemeinsam/datei';

export function ausFarbbild(b: Farbbild): ImageData {
  return new ImageData(new Uint8ClampedArray(b.daten), b.breite, b.hoehe);
}

export function ausGraubild(b: Graubild): ImageData {
  const d = new Uint8ClampedArray(b.daten.length * 4);
  for (let i = 0; i < b.daten.length; i++) {
    const g = b.daten[i]!;
    d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = g;
    d[4 * i + 3] = 255;
  }
  return new ImageData(d, b.breite, b.hoehe);
}

/**
 * Binärbild: Vordergrund dunkel, Hintergrund weiß. Mit `blass` sehr hell, als Unterlage für Konturen.
 * Mit `geaendert` werden entfernte Flecken rot und gefüllte Löcher blau markiert.
 */
export function ausBinaerbild(b: Binaerbild, optionen: { blass?: boolean; geaendert?: Uint8Array } = {}): ImageData {
  const d = new Uint8ClampedArray(b.daten.length * 4);
  const vorne = optionen.blass ? 215 : 20;
  for (let i = 0; i < b.daten.length; i++) {
    let r: number, g: number, bl: number;
    const m = optionen.geaendert?.[i];
    if (m === FLECK_ENTFERNT) [r, g, bl] = [230, 57, 70];
    else if (m === LOCH_GEFUELLT) [r, g, bl] = [37, 99, 235];
    else r = g = bl = b.daten[i] ? vorne : 255;
    d[4 * i] = r;
    d[4 * i + 1] = g;
    d[4 * i + 2] = bl;
    d[4 * i + 3] = 255;
  }
  return new ImageData(d, b.breite, b.hoehe);
}

export function speicherePng(bild: ImageData, dateiname: string): void {
  const c = document.createElement('canvas');
  c.width = bild.width;
  c.height = bild.height;
  c.getContext('2d')!.putImageData(bild, 0, 0);
  c.toBlob((blob) => blob && speichereBlob(blob, dateiname), 'image/png');
}

/** Binärbild als CSV-Matrix aus 0 und 1, z. B. für Tabellenkalkulation oder Arbeitsblätter. */
export function binaerAlsCsv(b: Binaerbild): string {
  const zeilen: string[] = [];
  for (let y = 0; y < b.hoehe; y++) zeilen.push(Array.from(b.daten.subarray(y * b.breite, (y + 1) * b.breite)).join(';'));
  return zeilen.join('\n') + '\n';
}
