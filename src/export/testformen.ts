/**
 * Testformen für den DXF-Export: Mit ihnen lässt sich in Silhouette Studio prüfen,
 * ob Maße, Lage, Löcher, offene Pfade und Kurven richtig ankommen.
 * Alle Maße in mm, Ursprung oben links, y nach unten.
 */
import type { Polylinie, Punkt } from '../cutter/types';

export function rechteck(x: number, y: number, breite: number, hoehe: number): Polylinie {
  return [
    { x, y },
    { x: x + breite, y },
    { x: x + breite, y: y + hoehe },
    { x, y: y + hoehe },
    { x, y },
  ];
}

/** Ein Kreis, angenähert durch ein Vieleck mit `ecken` Ecken. */
export function kreis(mx: number, my: number, r: number, ecken = 72): Polylinie {
  const punkte: Punkt[] = [];
  for (let i = 0; i <= ecken; i++) {
    const w = (2 * Math.PI * (i % ecken)) / ecken;
    punkte.push({ x: mx + r * Math.cos(w), y: my + r * Math.sin(w) });
  }
  return punkte;
}

export interface Testform {
  name: string;
  beschreibung: string;
  pfade: Polylinie[];
}

/** Die Testformen, nebeneinander auf einer Fläche von 200 × 70 mm. */
export function testformen(): Testform[] {
  return [
    {
      name: 'Quadrat 50 mm',
      beschreibung: 'Nachmessen: 50 × 50 mm, Abstand zum Rahmen daneben 10 mm.',
      pfade: [rechteck(10, 10, 50, 50)],
    },
    {
      name: 'Rahmen mit Loch',
      beschreibung: 'Außen 40 mm, innen 20 mm: Das Loch muss als eigener Pfad erscheinen.',
      pfade: [rechteck(70, 15, 40, 40), rechteck(80, 25, 20, 20)],
    },
    {
      name: 'Kreis Ø 30 mm',
      beschreibung: 'Vieleck mit 72 Ecken: Kommt er rund und mit 30 mm Durchmesser an?',
      pfade: [kreis(135, 35, 15)],
    },
    {
      name: 'Offene Zickzacklinie',
      beschreibung: 'Ein offener Pfad: Er darf nicht geschlossen werden.',
      pfade: [
        [
          { x: 160, y: 55 },
          { x: 170, y: 15 },
          { x: 180, y: 55 },
          { x: 190, y: 15 },
        ],
      ],
    },
  ];
}
