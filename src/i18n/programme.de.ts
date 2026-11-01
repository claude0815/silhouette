/** Vorlagen für „SVG per Programm“. Jede erzeugt ein schneidbares Dokument. */

export interface Programmvorlage {
  id: string;
  titel: string;
  code: string;
}

export const programme: Programmvorlage[] = [
  {
    id: 'erste-schritte',
    titel: 'Erste Schritte',
    code: `// Alles in Millimetern. Der Ursprung liegt oben links, y zeigt nach unten.
papier(100, 60);

rechteck(10, 10, 30, 20);          // x, y, Breite, Höhe
kreis(70, 20, 10);                 // Mittelpunkt x, y und Radius
linie(10, 45, 90, 45);             // von (10 | 45) nach (90 | 45)
ellipse(50, 45, 15, 6, { fuellung: 'black' });
`,
  },
  {
    id: 'raster',
    titel: 'Kreise im Raster',
    code: `// Zwei Schleifen ineinander: Zeilen und Spalten
papier(120, 80);

for (let zeile = 0; zeile < 4; zeile++) {
  for (let spalte = 0; spalte < 6; spalte++) {
    const r = 3 + spalte;           // nach rechts größer
    kreis(12 + spalte * 19, 12 + zeile * 19, r);
  }
}
ausgabe('Anzahl Kreise:', 4 * 6);
`,
  },
  {
    id: 'stern',
    titel: 'Stern mit Funktion',
    code: `// Eine eigene Funktion: Stern mit beliebig vielen Zacken
papier(120, 60);

function stern(cx, cy, aussen, innen, zacken) {
  const punkte = [];
  for (let i = 0; i < 2 * zacken; i++) {
    const r = i % 2 === 0 ? aussen : innen;     // abwechselnd außen und innen
    const w = rad(-90 + i * 180 / zacken);      // Winkel in Bogenmaß
    punkte.push([cx + r * Math.cos(w), cy + r * Math.sin(w)]);
  }
  vieleck(punkte);
}

stern(30, 30, 25, 10, 5);
stern(90, 30, 25, 18, 12);
`,
  },
  {
    id: 'spirale',
    titel: 'Spirale (offener Pfad)',
    code: `// Ein offener Linienzug – gut zum Zeichnen mit dem Stift
papier(100, 100);

const punkte = [];
for (let w = 0; w < 6 * 360; w += 5) {
  const r = 2 + w / 360 * 7;        // Radius wächst mit dem Winkel
  punkte.push([50 + r * Math.cos(rad(w)), 50 + r * Math.sin(rad(w))]);
}
vieleck(punkte, { geschlossen: false });
`,
  },
  {
    id: 'zahnrad',
    titel: 'Zahnrad mit Loch',
    code: `// Zahnrad: Zähne entstehen durch abwechselnd großen und kleinen Radius
papier(80, 80);

const zaehne = 14;
const punkte = [];
for (let i = 0; i < zaehne * 4; i++) {
  const r = (i % 4 < 2) ? 34 : 28;
  const w = rad(i * 360 / (zaehne * 4));
  punkte.push([40 + r * Math.cos(w), 40 + r * Math.sin(w)]);
}
vieleck(punkte, { fuellung: 'black' });
kreis(40, 40, 8, { fuellung: 'white' });   // Loch für die Achse
`,
  },
  {
    id: 'schild',
    titel: 'Namensschild',
    code: `// Schild mit abgerundeten Ecken und zwei Löchern zum Aufhängen
papier(110, 50);

rechteck(5, 5, 100, 40, { rundung: 6 });
kreis(15, 15, 2.5);
kreis(95, 15, 2.5);
// Eine Zierlinie aus Bögen
pfad('M 25 35 Q 40 25 55 35 T 85 35');
`,
  },
];

export const programmTexte = {
  modusSvg: 'SVG-Code',
  modusProgramm: 'Programm',
  vorlage: 'Vorlage laden …',
  vorlageFrage: 'Das Programm wird durch die Vorlage ersetzt. Fortfahren?',
  hinweis: 'Im Programm-Modus wird das Dokument bei jeder Änderung neu erzeugt.',
  laeuft: 'läuft …',
  ok: (formen: number, ms: number) => `${formen} ${formen === 1 ? 'Form' : 'Formen'} erzeugt (${ms} ms).`,
  fehler: 'Fehler',
  zeile: (n: number) => `Zeile ${n}`,
  zeitlimit: (ms: number) => `Das Programm wurde nach ${ms} ms abgebrochen – vielleicht eine Endlosschleife?`,
  ausgabe: 'Ausgabe',
  hilfeTitel: 'Befehle',
  hilfe: [
    'papier(breite, höhe) – Größe in mm',
    'rechteck(x, y, breite, höhe, { rundung })',
    'kreis(x, y, r) · ellipse(x, y, rx, ry)',
    'linie(x1, y1, x2, y2)',
    'vieleck([[x, y], …], { geschlossen: false })',
    "pfad('M 10 10 L 50 10 Z')",
    'rad(grad) – für Math.sin und Math.cos',
    "ausgabe(…) – Text unter dem Programm",
    "Letzter Wert jeweils optional: { fuellung: 'black', kontur: 'red', transform: 'rotate(45 50 50)' }",
  ],
};
