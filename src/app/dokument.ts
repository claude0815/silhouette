/**
 * Das zentrale SVG-Dokument: die gemeinsame Grundlage für Werkstatt, Simulation und Export.
 *
 * Es folgt dem Nachzeichnen, bis man es in der Werkstatt bearbeitet oder eine SVG-Datei
 * öffnet. Danach ist es eine eigene Fassung; Änderungen im Nachzeichnen ändern sie nicht
 * mehr, bis man sie ausdrücklich wieder übernimmt. Eigene Fassungen bleiben im Browser
 * gespeichert (localStorage), damit beim Neuladen nichts verloren geht.
 */
import { effect, signal } from '@preact/signals';
import { ergebnis } from './zustand';

export type Quelle = 'nachzeichnen' | 'eigen';

export interface Dokument {
  text: string;
  quelle: Quelle;
  /** Dateiname zum Speichern */
  name: string;
}

/** Startdokument, solange es weder ein Bild noch eine eigene Fassung gibt. */
export const STARTDOKUMENT = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">
  <!-- Ein Rechteck, ein Kreis mit Loch und ein Pfad. Ändere die Zahlen! -->
  <rect x="10" y="10" width="30" height="20" fill="none" stroke="black"/>
  <path fill-rule="evenodd" d="M 55 20 A 10 10 0 1 1 75 20 A 10 10 0 1 1 55 20 Z M 60 20 A 5 5 0 1 1 70 20 A 5 5 0 1 1 60 20 Z"/>
  <path d="M 10 50 L 30 40 C 40 35 50 55 60 45 L 90 50" fill="none" stroke="black"/>
</svg>
`;

const SPEICHER = 'vom-pixel-zum-schnitt:dokument';

function ladeGespeichert(): Dokument | null {
  try {
    const d = JSON.parse(globalThis.localStorage?.getItem(SPEICHER) ?? 'null') as Dokument | null;
    return d && typeof d.text === 'string' ? { ...d, quelle: 'eigen' } : null;
  } catch {
    return null;
  }
}

export const dokument = signal<Dokument>(ladeGespeichert() ?? { text: STARTDOKUMENT, quelle: 'nachzeichnen', name: 'zeichnung.svg' });

/** SVG aus dem Nachzeichnen, sobald es eines gibt */
export function nachgezeichnet(): string | null {
  return ergebnis.value?.svg?.text ?? null;
}

// Dem Nachzeichnen folgen, solange es keine eigene Fassung gibt
effect(() => {
  const text = nachgezeichnet();
  if (text && dokument.peek().quelle === 'nachzeichnen' && dokument.peek().text !== text) {
    dokument.value = { text, quelle: 'nachzeichnen', name: 'vom-pixel-zum-schnitt.svg' };
  }
});

function speichere(d: Dokument): void {
  try {
    if (d.quelle === 'eigen') globalThis.localStorage?.setItem(SPEICHER, JSON.stringify(d));
    else globalThis.localStorage?.removeItem(SPEICHER);
  } catch {
    // Speichern nicht möglich (z. B. privater Modus): dann nur für diese Sitzung
  }
}

// Eigene Fassungen speichern (kurz verzögert, damit nicht bei jedem Tastendruck geschrieben wird)
let speicherZeit: ReturnType<typeof setTimeout> | undefined;
effect(() => {
  const d = dokument.value;
  clearTimeout(speicherZeit);
  speicherZeit = setTimeout(() => speichere(d), 300);
});
// Beim Verlassen der Seite sofort speichern, damit die letzte Änderung nicht verloren geht
globalThis.addEventListener?.('pagehide', () => {
  clearTimeout(speicherZeit);
  speichere(dokument.peek());
});

/** Text aus dem Editor oder vom Ziehen eines Punkts: Ab jetzt ist es eine eigene Fassung. */
export function aendereText(text: string): void {
  if (text === dokument.value.text) return;
  dokument.value = { ...dokument.value, text, quelle: 'eigen' };
}

export function oeffneSvgText(text: string, name: string): void {
  dokument.value = { text, quelle: 'eigen', name };
}

export function uebernimmNachzeichnen(): void {
  dokument.value = { text: nachgezeichnet() ?? STARTDOKUMENT, quelle: 'nachzeichnen', name: 'vom-pixel-zum-schnitt.svg' };
}
