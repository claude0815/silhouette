/**
 * Beispiele und Mini-Aufgaben für die SVG-Werkstatt (Texte und SVG-Code).
 * Die Prüfungen dazu stehen in src/werkstatt/beispiele.ts unter derselben id.
 */

export interface AufgabeText {
  id: string;
  text: string;
  tipp?: string;
  /** Musterlösung als vollständiges SVG (auch für die Tests der Prüfung) */
  loesung?: string;
}

export interface BeispielText {
  id: string;
  titel: string;
  kurz: string;
  svg: string;
  aufgaben: AufgabeText[];
}

const kopf = (b: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${b}mm" height="${h}mm" viewBox="0 0 ${b} ${h}">`;

export const beispiele: BeispielText[] = [
  {
    id: 'rechteck',
    titel: 'Rechteck und Millimeter',
    kurz: 'width, height und viewBox legen fest: 1 Einheit = 1 mm. Der Ursprung liegt oben links, y zeigt nach unten.',
    svg: `${kopf(100, 60)}
  <!-- x und y: linke obere Ecke, width und height: Größe – alles in mm -->
  <rect x="10" y="10" width="30" height="20" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'breite40',
        text: 'Mach das Rechteck 40 mm breit.',
        tipp: 'Ändere width.',
        loesung: `${kopf(100, 60)}\n  <rect x="10" y="10" width="40" height="20" fill="none" stroke="black"/>\n</svg>\n`,
      },
      {
        id: 'ecke',
        text: 'Verschiebe das Rechteck so, dass seine linke obere Ecke bei (20 | 15) mm liegt.',
        tipp: 'Lies die Position am Lineal ab. y zählt von oben nach unten.',
        loesung: `${kopf(100, 60)}\n  <rect x="20" y="15" width="30" height="20" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'kreis',
    titel: 'Vom Kreis zum Pfad',
    kurz: 'Ein Cutter kennt nur Pfade. Wähle den Kreis aus und sieh im Pfad-Erklärer, wie er umgerechnet wird.',
    svg: `${kopf(80, 60)}
  <circle cx="40" cy="30" r="20" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'radius15',
        text: 'Gib dem Kreis einen Durchmesser von 30 mm.',
        tipp: 'r ist der Radius, also der halbe Durchmesser.',
        loesung: `${kopf(80, 60)}\n  <circle cx="40" cy="30" r="15" fill="none" stroke="black"/>\n</svg>\n`,
      },
      {
        id: 'ellipse',
        text: 'Mach daraus eine Ellipse, die 60 mm breit und 30 mm hoch ist.',
        tipp: '<ellipse cx="…" cy="…" rx="…" ry="…"/> – rx und ry sind die halben Achsen.',
        loesung: `${kopf(80, 60)}\n  <ellipse cx="40" cy="30" rx="30" ry="15" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'dreieck',
    titel: 'M, L und Z',
    kurz: 'M setzt den Stift auf, L zieht eine Strecke, Z schließt den Pfad. Ein offener Pfad ist ein Schnitt mit Anfang und Ende.',
    svg: `${kopf(60, 50)}
  <path d="M 10 40 L 30 10 L 50 40" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'schliessen',
        text: 'Schließe das Dreieck, damit es sich ausschneiden lässt.',
        tipp: 'Ein Buchstabe genügt. Die Cutter-Checks zeigen, ob es geklappt hat.',
        loesung: `${kopf(60, 50)}\n  <path d="M 10 40 L 30 10 L 50 40 Z" fill="none" stroke="black"/>\n</svg>\n`,
      },
      {
        id: 'viereck',
        text: 'Mach aus dem Dreieck ein geschlossenes Viereck mit vier Ecken.',
        tipp: 'Füge vor Z noch einen L-Befehl ein.',
        loesung: `${kopf(60, 50)}\n  <path d="M 10 40 L 30 10 L 50 40 L 30 48 Z" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'relativ',
    titel: 'Absolut und relativ',
    kurz: 'Großbuchstaben sind absolute Koordinaten, Kleinbuchstaben Abstände zum vorigen Punkt. Beide Quadrate sehen gleich aus.',
    svg: `${kopf(100, 50)}
  <!-- absolut: jeder Punkt mit seinen eigenen Koordinaten -->
  <path d="M 10 10 L 30 10 L 30 30 L 10 30 Z" fill="none" stroke="black"/>
  <!-- relativ: jeder Punkt als Schritt vom vorigen aus -->
  <path d="M 50 10 l 20 0 l 0 20 l -20 0 z" fill="none" stroke="blue"/>
</svg>
`,
    aufgaben: [
      {
        id: 'verschieben',
        text: 'Verschiebe das blaue Quadrat um 20 mm nach rechts. Wie viele Zahlen musst du ändern?',
        tipp: 'Beim relativen Pfad reicht es, den Startpunkt zu ändern.',
        loesung: `${kopf(100, 50)}\n  <path d="M 10 10 L 30 10 L 30 30 L 10 30 Z" fill="none" stroke="black"/>\n  <path d="M 70 10 l 20 0 l 0 20 l -20 0 z" fill="none" stroke="blue"/>\n</svg>\n`,
      },
      {
        id: 'groesser',
        text: 'Mach das schwarze Quadrat 30 mm groß, ohne es zu verschieben.',
        tipp: 'Beim absoluten Pfad musst du mehrere Punkte ändern.',
        loesung: `${kopf(100, 50)}\n  <path d="M 10 10 L 40 10 L 40 40 L 10 40 Z" fill="none" stroke="black"/>\n  <path d="M 50 10 l 20 0 l 0 20 l -20 0 z" fill="none" stroke="blue"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'bezier',
    titel: 'Bézier-Kurven',
    kurz: 'C x1 y1 x2 y2 x y: Die Kurve beginnt in Richtung des ersten Kontrollpunkts und kommt aus Richtung des zweiten an.',
    svg: `${kopf(100, 60)}
  <path d="M 10 20 C 30 50 70 50 90 20" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'nachOben',
        text: 'Ziehe die Kontrollpunkte so, dass die Kurve nach oben ausbeult statt nach unten.',
        tipp: 'Wähle die Kurve in der Vorschau aus und ziehe die hellen Kreise. y wird nach oben kleiner.',
        loesung: `${kopf(100, 60)}\n  <path d="M 10 40 C 30 5 70 5 90 40" fill="none" stroke="black"/>\n</svg>\n`,
      },
      {
        id: 'welle',
        text: 'Mach daraus eine Welle: erst nach unten, dann nach oben.',
        tipp: 'Die beiden Kontrollpunkte auf verschiedene Seiten der Linie legen.',
        loesung: `${kopf(100, 60)}\n  <path d="M 10 30 C 40 60 60 0 90 30" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'loch',
    titel: 'Das O mit Loch',
    kurz: 'Ein Pfad mit zwei Teilpfaden: außen und innen. Ob das Loch leer bleibt, bestimmt fill-rule.',
    svg: `${kopf(70, 70)}
  <path d="M 10 35 A 25 25 0 1 1 60 35 A 25 25 0 1 1 10 35 Z M 22 35 A 13 13 0 1 1 48 35 A 13 13 0 1 1 22 35 Z"/>
</svg>
`,
    aufgaben: [
      {
        id: 'evenodd',
        text: 'Das Loch ist schwarz gefüllt. Sorge dafür, dass es leer bleibt.',
        tipp: 'fill-rule="evenodd": Innen ist, was von einer ungeraden Zahl von Konturen umgeben ist.',
        loesung: `${kopf(70, 70)}\n  <path fill-rule="evenodd" d="M 10 35 A 25 25 0 1 1 60 35 A 25 25 0 1 1 10 35 Z M 22 35 A 13 13 0 1 1 48 35 A 13 13 0 1 1 22 35 Z"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'schablone',
    titel: 'Schablone ohne Inseln',
    kurz: 'Als Schablone geschnitten, fällt das Innere des Rings heraus. Schablonenschriften setzen deshalb Brücken.',
    svg: `${kopf(70, 70)}
  <!-- ein Ring: äußere und innere Kontur -->
  <path fill-rule="evenodd" d="M 10 35 A 25 25 0 1 1 60 35 A 25 25 0 1 1 10 35 Z M 22 35 A 13 13 0 1 1 48 35 A 13 13 0 1 1 22 35 Z"/>
</svg>
`,
    aufgaben: [
      {
        id: 'bruecken',
        text: 'Zerlege den Ring in zwei Bögen mit Lücken (Brücken), damit beim Schneiden keine Insel herausfällt.',
        tipp: 'Zwei geschlossene Pfade, z. B. obere und untere Ringhälfte, die sich links und rechts nicht berühren. Der Check „Inseln bei Schablonen“ wird grün.',
        loesung: `${kopf(70, 70)}
  <path d="M 10 33 A 25 25 0 0 1 60 33 L 48 33 A 13 13 0 0 0 22 33 Z"/>
  <path d="M 10 37 A 25 25 0 0 0 60 37 L 48 37 A 13 13 0 0 1 22 37 Z"/>
</svg>
`,
      },
    ],
  },
  {
    id: 'transform',
    titel: 'Gruppen und transform',
    kurz: 'transform verschiebt, dreht oder skaliert alles in einer Gruppe <g>. Die Koordinaten im Code bleiben gleich.',
    svg: `${kopf(100, 70)}
  <g transform="translate(30 35)">
    <polygon points="0,-20 6,-6 20,-6 9,3 13,18 0,9 -13,18 -9,3 -20,-6 -6,-6"/>
  </g>
</svg>
`,
    aufgaben: [
      {
        id: 'rechts',
        text: 'Verschiebe den Stern um 40 mm nach rechts, ohne die Punkte zu ändern.',
        tipp: 'Nur die Zahlen in translate(…) ändern.',
        loesung: `${kopf(100, 70)}\n  <g transform="translate(70 35)">\n    <polygon points="0,-20 6,-6 20,-6 9,3 13,18 0,9 -13,18 -9,3 -20,-6 -6,-6"/>\n  </g>\n</svg>\n`,
      },
      {
        id: 'doppelt',
        text: 'Mach den Stern doppelt so groß.',
        tipp: 'Hänge scale(2) an. Probiere auch, was passiert, wenn scale vor translate steht.',
        loesung: `${kopf(100, 70)}\n  <g transform="translate(30 35) scale(2)">\n    <polygon points="0,-20 6,-6 20,-6 9,3 13,18 0,9 -13,18 -9,3 -20,-6 -6,-6"/>\n  </g>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'matte',
    titel: 'Ab auf die Matte',
    kurz: 'Was außerhalb von Matte oder Dokument liegt, kann der Cutter nicht schneiden oder du siehst es nicht.',
    svg: `${kopf(100, 60)}
  <rect x="-15" y="10" width="40" height="20" fill="none" stroke="black"/>
  <circle cx="90" cy="50" r="20" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'rein',
        text: 'Verschiebe beide Formen so, dass sie vollständig im Dokument liegen.',
        tipp: 'Die Cutter-Checks zeigen, was noch hinausragt.',
        loesung: `${kopf(100, 60)}\n  <rect x="5" y="10" width="40" height="20" fill="none" stroke="black"/>\n  <circle cx="70" cy="35" r="20" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
  {
    id: 'luecke',
    titel: 'Fast geschlossen',
    kurz: 'Dieser Pfad endet 0,3 mm neben seinem Anfang. Mit bloßem Auge sieht man das kaum – der Cutter schon.',
    svg: `${kopf(60, 50)}
  <path d="M 10 10 L 50 10 L 50 40 L 10 40 L 10 10.3" fill="none" stroke="black"/>
</svg>
`,
    aufgaben: [
      {
        id: 'zu',
        text: 'Schließe die Lücke.',
        tipp: 'Entweder den letzten Punkt genau auf den ersten legen oder mit Z schließen.',
        loesung: `${kopf(60, 50)}\n  <path d="M 10 10 L 50 10 L 50 40 L 10 40 Z" fill="none" stroke="black"/>\n</svg>\n`,
      },
    ],
  },
];

export const beispielTexte = {
  titel: 'Beispiele und Aufgaben',
  einleitung: 'Lade ein Beispiel und probiere die Aufgaben aus. Es gibt keinen Kurs und keine Noten – nur Ausprobieren.',
  laden: 'Laden',
  ladenFrage: 'Das aktuelle Dokument wird durch das Beispiel ersetzt. Fortfahren?',
  geschafft: 'Geschafft!',
  offen: 'noch offen',
  tipp: 'Tipp',
  loesung: 'Lösung laden',
  loesungFrage: 'Die Musterlösung ersetzt das aktuelle Dokument. Fortfahren?',
  aktiv: 'geladen',
};
