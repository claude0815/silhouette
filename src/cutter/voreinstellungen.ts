/**
 * Material-Voreinstellungen: Werkzeug, Druck und Geschwindigkeit für typische Materialien.
 *
 * Achtung: Die Ausgangswerte stammen aus der Medientabelle von inkscape-silhouette
 * (silhouette/Graphtec.py, MEDIA, Commit f376a08; dort übernommen aus robocut). Sie wurden
 * für ältere Modelle ermittelt. Für Cameo 4/5 und Portrait 3/4 müssen sie im Machbarkeitstest
 * geprüft werden – bis dahin sind sie als Schätzwert gekennzeichnet (geprueft: false).
 * Nach dem Test hier die gemessenen Werte eintragen und geprueft auf true setzen.
 */
import type { Werkzeug } from './types';

export interface Voreinstellung {
  id: string;
  name: string;
  werkzeug: Omit<Werkzeug, 'halter'>;
  /** Woher stammen die Werte? */
  quelle: string;
  /** Am Gerät der Schule geprüft? */
  geprueft: boolean;
  hinweis?: string;
}

const MEDIENTABELLE = 'inkscape-silhouette, Graphtec.py, MEDIA';

export const VOREINSTELLUNGEN: readonly Voreinstellung[] = [
  {
    id: 'stift',
    name: 'Stift (zum Ausprobieren)',
    werkzeug: { art: 'stift', druck: 18, geschwindigkeit: 10 },
    quelle: `${MEDIENTABELLE} 113 „Pen“`,
    geprueft: false,
    hinweis: 'Erste Versuche immer mit Stift: Er zeigt Lage und Maße, ohne etwas zu zerschneiden.',
  },
  {
    id: 'papier-leicht',
    name: 'Druckerpapier, leicht (80 g/m²)',
    werkzeug: { art: 'messer', druck: 5, geschwindigkeit: 10, klingenVersatzMm: 0.9 },
    quelle: `${MEDIENTABELLE} 132 „Print Paper Light Weight“`,
    geprueft: false,
  },
  {
    id: 'papier-mittel',
    name: 'Papier, mittel (bis 120 g/m²)',
    werkzeug: { art: 'messer', druck: 25, geschwindigkeit: 10, klingenVersatzMm: 0.9 },
    quelle: `${MEDIENTABELLE} 133 „Print Paper Medium Weight“`,
    geprueft: false,
  },
  {
    id: 'karton',
    name: 'Tonkarton (bis 170 g/m²)',
    werkzeug: { art: 'messer', druck: 30, geschwindigkeit: 10, klingenVersatzMm: 0.9 },
    quelle: `${MEDIENTABELLE} 123 „Cover 40-60 lbs (170g)“`,
    geprueft: false,
    hinweis: 'Dicker Karton braucht oft zwei Durchgänge oder eine tiefer eingestellte Klinge.',
  },
  {
    id: 'vinyl',
    name: 'Vinylfolie (Plotterfolie)',
    werkzeug: { art: 'messer', druck: 10, geschwindigkeit: 5, klingenVersatzMm: 0.9 },
    quelle: `${MEDIENTABELLE} 102 „Vinyl Sticker“`,
    geprueft: false,
    hinweis: 'Nur die Folie schneiden, nicht das Trägerpapier: lieber mit wenig Druck beginnen.',
  },
  {
    id: 'aufkleber',
    name: 'Aufkleberpapier',
    werkzeug: { art: 'messer', druck: 20, geschwindigkeit: 10, klingenVersatzMm: 0.9 },
    quelle: `${MEDIENTABELLE} 134 „Sticker Sheet“`,
    geprueft: false,
  },
];

export const GRENZEN = {
  druck: { min: 1, max: 33 },
  geschwindigkeit: { min: 1, max: 30 },
  tiefe: { min: 0, max: 10 },
  klingenVersatzMm: { min: 0, max: 2.5 },
} as const;

/** Prüft eine (z. B. selbst gespeicherte) Voreinstellung; gibt Fehlermeldungen zurück. */
export function pruefeVoreinstellung(v: Voreinstellung): string[] {
  const fehler: string[] = [];
  const im = (name: keyof typeof GRENZEN, wert: number | undefined) => {
    if (wert === undefined) return;
    const g = GRENZEN[name];
    if (!Number.isFinite(wert) || wert < g.min || wert > g.max) fehler.push(`${name} muss zwischen ${g.min} und ${g.max} liegen.`);
  };
  if (!v.name.trim()) fehler.push('Name fehlt.');
  if (v.werkzeug.art !== 'stift' && v.werkzeug.art !== 'messer') fehler.push('Werkzeug muss Stift oder Messer sein.');
  im('druck', v.werkzeug.druck);
  im('geschwindigkeit', v.werkzeug.geschwindigkeit);
  im('tiefe', v.werkzeug.tiefe);
  im('klingenVersatzMm', v.werkzeug.klingenVersatzMm);
  return fehler;
}
