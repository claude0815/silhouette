/**
 * „SVG per Programm“: eine kleine Zeichen-API für eigene Programme.
 *
 * Ein Programm ruft Funktionen wie kreis(50, 30, 10) auf; jede Funktion legt eine Form ab.
 * Am Ende entsteht daraus ein SVG-Dokument in Millimetern – dasselbe, das die Werkstatt,
 * die Simulation und der Cutter lesen. So sieht man, dass auch ein Computerprogramm am Ende
 * „nur“ Text erzeugt.
 *
 * Die Funktion fuehreAus() läuft im Programm-Worker (mit Zeitlimit) und in den Tests.
 */

export interface Optionen {
  /** Füllfarbe, z. B. 'black'; ohne Angabe keine Füllung */
  fuellung?: string;
  /** Konturfarbe; ohne Angabe 'black' */
  kontur?: string;
  /** SVG-transform, z. B. 'rotate(45 50 50)' */
  transform?: string;
}

export interface Programmergebnis {
  svg: string;
  /** Ausgaben von ausgabe(…) bzw. console.log(…) */
  ausgaben: string[];
  fehler?: { text: string; zeile?: number };
  formen: number;
}

export class ProgrammFehler extends Error {
  override name = 'ProgrammFehler';
}

export const MAX_FORMEN = 5000;

const zahl = (n: number) => String(Math.round(n * 1000) / 1000);

function pruefeZahlen(name: string, namen: string, werte: unknown[]): void {
  werte.forEach((w, i) => {
    if (typeof w !== 'number' || !Number.isFinite(w)) {
      throw new ProgrammFehler(`${name}(${namen}): Der ${i + 1}. Wert ist keine Zahl (${String(w)}).`);
    }
  });
}

/** Alle Funktionen, die ein Programm benutzen kann. */
export function erzeugeApi(ausgaben: string[]) {
  let breite = 100;
  let hoehe = 100;
  const formen: string[] = [];

  const stil = (o: Optionen = {}) => {
    const teile = [`fill="${o.fuellung ?? 'none'}"`, `stroke="${o.kontur ?? 'black'}"`];
    if (o.transform) teile.push(`transform="${o.transform.replace(/"/g, '')}"`);
    return teile.join(' ');
  };
  const lege = (svg: string) => {
    if (formen.length >= MAX_FORMEN) throw new ProgrammFehler(`Zu viele Formen (höchstens ${MAX_FORMEN}).`);
    formen.push(svg);
  };
  const alsPunkte = (punkte: unknown, name: string): [number, number][] => {
    if (!Array.isArray(punkte) || punkte.length < 2) throw new ProgrammFehler(`${name}: Es braucht eine Liste mit mindestens zwei Punkten, z. B. [[0, 0], [10, 5]].`);
    return punkte.map((p, i) => {
      const xy = Array.isArray(p) ? p : p && typeof p === 'object' ? [(p as { x: unknown }).x, (p as { y: unknown }).y] : [];
      if (typeof xy[0] !== 'number' || typeof xy[1] !== 'number' || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1]))
        throw new ProgrammFehler(`${name}: Punkt ${i + 1} ist kein Zahlenpaar.`);
      return [xy[0], xy[1]] as [number, number];
    });
  };

  const api = {
    /** Größe des Dokuments in mm */
    papier(b: number, h: number) {
      pruefeZahlen('papier', 'breite, höhe', [b, h]);
      if (b <= 0 || h <= 0) throw new ProgrammFehler('papier(breite, höhe): Beide Werte müssen größer als 0 sein.');
      breite = b;
      hoehe = h;
    },
    rechteck(x: number, y: number, b: number, h: number, o?: Optionen & { rundung?: number }) {
      pruefeZahlen('rechteck', 'x, y, breite, höhe', [x, y, b, h]);
      if (b <= 0 || h <= 0) throw new ProgrammFehler('rechteck: Breite und Höhe müssen größer als 0 sein.');
      const r = o?.rundung ? ` rx="${zahl(o.rundung)}"` : '';
      lege(`<rect x="${zahl(x)}" y="${zahl(y)}" width="${zahl(b)}" height="${zahl(h)}"${r} ${stil(o)}/>`);
    },
    kreis(x: number, y: number, r: number, o?: Optionen) {
      pruefeZahlen('kreis', 'x, y, r', [x, y, r]);
      if (r <= 0) throw new ProgrammFehler('kreis(x, y, r): Der Radius r muss größer als 0 sein.');
      lege(`<circle cx="${zahl(x)}" cy="${zahl(y)}" r="${zahl(r)}" ${stil(o)}/>`);
    },
    ellipse(x: number, y: number, rx: number, ry: number, o?: Optionen) {
      pruefeZahlen('ellipse', 'x, y, rx, ry', [x, y, rx, ry]);
      if (rx <= 0 || ry <= 0) throw new ProgrammFehler('ellipse: rx und ry müssen größer als 0 sein.');
      lege(`<ellipse cx="${zahl(x)}" cy="${zahl(y)}" rx="${zahl(rx)}" ry="${zahl(ry)}" ${stil(o)}/>`);
    },
    linie(x1: number, y1: number, x2: number, y2: number, o?: Optionen) {
      pruefeZahlen('linie', 'x1, y1, x2, y2', [x1, y1, x2, y2]);
      lege(`<line x1="${zahl(x1)}" y1="${zahl(y1)}" x2="${zahl(x2)}" y2="${zahl(y2)}" ${stil(o)}/>`);
    },
    /** Linienzug durch Punkte; mit geschlossen: true als Vieleck */
    vieleck(punkte: unknown, o?: Optionen & { geschlossen?: boolean }) {
      const p = alsPunkte(punkte, 'vieleck');
      const liste = p.map(([x, y]) => `${zahl(x)},${zahl(y)}`).join(' ');
      const element = o?.geschlossen === false ? 'polyline' : 'polygon';
      lege(`<${element} points="${liste}" ${stil(o)}/>`);
    },
    /** Pfad mit eigenen Pfadbefehlen, z. B. pfad('M 10 10 L 50 10 Z') */
    pfad(d: unknown, o?: Optionen) {
      if (typeof d !== 'string' || d.trim() === '') throw new ProgrammFehler('pfad(d): d muss Text mit Pfadbefehlen sein, z. B. "M 10 10 L 50 10".');
      lege(`<path d="${d.replace(/"/g, '')}" ${stil(o)}/>`);
    },
    /** Grad in Bogenmaß, für Math.sin und Math.cos */
    rad(grad: number) {
      return (grad * Math.PI) / 180;
    },
    ausgabe(...werte: unknown[]) {
      if (ausgaben.length < 200) ausgaben.push(werte.map((w) => (typeof w === 'string' ? w : JSON.stringify(w))).join(' '));
    },
  };
  const svg = () =>
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${zahl(breite)}mm" height="${zahl(hoehe)}mm" viewBox="0 0 ${zahl(breite)} ${zahl(hoehe)}">`,
      '  <!-- Erzeugt von einem Programm in der SVG-Werkstatt -->',
      ...formen.map((f) => `  ${f}`),
      '</svg>',
      '',
    ].join('\n');
  return { api, svg, anzahl: () => formen.length };
}

/** Zeilennummer aus einem Fehlerstapel (Chrome: „<anonymous>:ZEILE:SPALTE“), bezogen auf den Programmtext */
export function zeileAusFehler(e: unknown, versatz: number): number | undefined {
  const stapel = e instanceof Error ? (e.stack ?? '') : '';
  const m = /<anonymous>:(\d+):\d+/.exec(stapel);
  if (!m) return undefined;
  const zeile = Number(m[1]) - versatz;
  return zeile >= 1 ? zeile : undefined;
}

/**
 * Führt ein Programm aus. Die API-Funktionen stehen direkt zur Verfügung (kreis(…) statt api.kreis(…)).
 * Achtung: läuft ohne Zeitlimit – im Browser darum nur im Programm-Worker aufrufen.
 */
export function fuehreAus(code: string): Programmergebnis {
  const ausgaben: string[] = [];
  const { api, svg, anzahl } = erzeugeApi(ausgaben);
  const konsole = { log: api.ausgabe, info: api.ausgabe, warn: api.ausgabe, error: api.ausgabe };
  try {
    // „with“ macht die API-Funktionen direkt aufrufbar. new Function setzt zwei Zeilen davor
    // („function anonymous(…“ und „) {“) – daraus ergibt sich der Versatz für die Zeilennummer.
    const f = new Function('api', 'console', `with (api) {\n${code}\n}`) as (a: typeof api, c: typeof konsole) => void;
    f(api, konsole);
    return { svg: svg(), ausgaben, formen: anzahl() };
  } catch (e) {
    const text = e instanceof ProgrammFehler ? e.message : e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { svg: svg(), ausgaben, formen: anzahl(), fehler: { text, zeile: zeileAusFehler(e, 3) } };
  }
}
