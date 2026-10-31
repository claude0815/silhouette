/**
 * Zustand der App mit Signalen. Ändert sich ein Signal, aktualisiert sich die Anzeige.
 * Einstellungsänderungen schicken automatisch einen Auftrag an den Rechen-Worker.
 */
import { batch, effect, signal } from '@preact/signals';
import { STANDARD, type Einstellungen, type Ergebnis } from '../pipeline/ablauf';
import { schneideZu, type Farbbild, type Rechteck } from '../pipeline/bilder';
import { beispielbild, ladeDatei, type GeladenesBild } from './bildladen';
import { fuegeEin, Rechner } from './rechner';
import { t } from '../i18n/de';

export const schritt = signal(1);
export const geladen = signal<GeladenesBild | null>(null);
export const einstellungen = signal<Einstellungen>({ ...STANDARD });
export const ergebnis = signal<Partial<Ergebnis> | null>(null);
export const rechnet = signal(false);
export const fehler = signal<string | null>(null);
/** Pixel unter dem Mauszeiger (in Bildkoordinaten) */
export const zeiger = signal<{ x: number; y: number } | null>(null);
/** Ausgewählte Form (Index in vereinfacht/geglaettet) bzw. Kontur (Index in konturen) */
export const auswahlForm = signal<number | null>(null);
export const auswahlKontur = signal<number | null>(null);

let letzteNummer = 0;
let rechner: Rechner | null = null;
let gesendetesBild: Farbbild | null = null;

function holeRechner(): Rechner {
  rechner ??= new Rechner((antwort) => {
    if (antwort.nummer !== letzteNummer) return; // veraltet
    batch(() => {
      rechnet.value = false;
      if (antwort.art === 'fehler') fehler.value = antwort.text;
      else {
        fehler.value = null;
        ergebnis.value = fuegeEin(ergebnis.value, antwort.teil, geladen.value!.bild);
      }
    });
  });
  return rechner;
}

// Bei jeder Änderung von Bild oder Einstellungen neu rechnen lassen.
effect(() => {
  const g = geladen.value;
  const e = einstellungen.value;
  if (!g) return;
  const neuesBild = g.bild !== gesendetesBild;
  gesendetesBild = g.bild;
  rechnet.value = true;
  letzteNummer = holeRechner().rechne(e, neuesBild ? g.bild : undefined);
});

export function setze<K extends keyof Einstellungen>(name: K, wert: Einstellungen[K]): void {
  einstellungen.value = { ...einstellungen.value, [name]: wert };
}

function neuesBild(g: GeladenesBild): void {
  batch(() => {
    ergebnis.value = null;
    auswahlForm.value = null;
    auswahlKontur.value = null;
    zeiger.value = null;
    geladen.value = g;
  });
}

export async function oeffneDatei(datei: File): Promise<void> {
  try {
    neuesBild(await ladeDatei(datei));
  } catch {
    fehler.value = t.app.laden.ungueltig;
  }
}

export function oeffneBeispiel(): void {
  neuesBild(beispielbild());
}

/** Schneidet das Bild zu. Das Rechteck bezieht sich immer auf das Bild vor dem Zuschnitt. */
export function schneideBildZu(r: Rechteck): void {
  const g = geladen.value;
  if (!g) return;
  const vorher = g.zuschnitt?.vorher ?? g.bild;
  neuesBild({ ...g, bild: schneideZu(vorher, r), zuschnitt: { vorher, rechteck: r } });
}

export function hebeZuschnittAuf(): void {
  const g = geladen.value;
  if (!g?.zuschnitt) return;
  neuesBild({ ...g, bild: g.zuschnitt.vorher, zuschnitt: undefined });
}
