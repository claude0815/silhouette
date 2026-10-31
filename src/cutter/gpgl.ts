/**
 * Übersetzung eines Auftrags in GPGL-Befehle (Graphtec Plotter Graphics Language).
 *
 * Alles hier sind reine Funktionen: gleiche Eingabe, gleiche Ausgabe, kein Gerät nötig.
 * Dieselbe Ausgabe wird an den Cutter gesendet und in der Simulation als Text gezeigt.
 *
 * Die Befehlsfolge folgt SilhouetteCameo.setup() und plot() aus
 * inkscape-silhouette, silhouette/Graphtec.py (Commit f376a08),
 * (c) 2013,2014 jw@suse.de, (c) 2016 juewei@fabmail.org, (c) 2016 Alexander Wenger,
 * (c) 2017 Johann Gail, „Distribute under GPLv2 or ask“.
 * https://github.com/fablabnbg/inkscape-silhouette
 * Erklärung der Befehle: docs/protokoll.md.
 */
import { matten, schneidebereichMm, type GeraeteProfil } from './profile';
import type { CutJob, GeraeteStatus, Polylinie, StatusAntwort } from './types';

// ---------------------------------------------------------------------------
// Steuerzeichen
// ---------------------------------------------------------------------------

/** End of Text: schließt jeden Befehl ab. */
export const ETX = 0x03;
/** Escape: leitet einen Steuerbefehl ein. */
export const ESC = 0x1b;

/** Gerät initialisieren (ESC EOT). */
export const BEFEHL_INITIALISIEREN = Uint8Array.of(ESC, 0x04);
/** Status abfragen (ESC ENQ). Antwort: "0" bereit, "1" in Bewegung, "2" keine Matte. */
export const BEFEHL_STATUS = Uint8Array.of(ESC, 0x05);
/** Werkzeugbelegung abfragen (ESC NAK), Cameo 4 und neuer. */
export const BEFEHL_WERKZEUGE = Uint8Array.of(ESC, 0x15);
/** Firmware-Version und Modellname abfragen. */
export const ABFRAGE_VERSION = 'FG';

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

/** Der Plotter bewegt sich in Schritten von 0,05 mm, also 20 Schritte pro mm. */
export const SCHRITTE_PRO_MM = 20;
/** 1 Zoll = 25,4 mm = 508 Schritte. */
export const SCHRITTE_PRO_ZOLL = 508;

/** Millimeter in ganze Geräteschritte umrechnen. */
export function mmZuSchritten(mm: number): number {
  return Math.round(mm * SCHRITTE_PRO_MM);
}

// ---------------------------------------------------------------------------
// Statusantwort
// ---------------------------------------------------------------------------

/** Wertet die Antwort auf BEFEHL_STATUS aus, z. B. die Bytes "0" und ETX. */
export function werteStatusAus(antwort: Uint8Array): StatusAntwort {
  let ende = antwort.length;
  if (ende > 0 && antwort[ende - 1] === ETX) ende--;
  const roh = new TextDecoder().decode(antwort.subarray(0, ende)).trim();
  const zuordnung: Record<string, GeraeteStatus> = {
    '0': 'bereit',
    '1': 'in-bewegung',
    '2': 'keine-matte',
  };
  return { status: zuordnung[roh] ?? 'unbekannt', roh };
}

// ---------------------------------------------------------------------------
// Auftrag → Befehle
// ---------------------------------------------------------------------------

/** Fehler, wenn ein Auftrag nicht gesendet werden darf. Die Meldung ist für die Oberfläche gedacht. */
export class AuftragsFehler extends Error {
  override name = 'AuftragsFehler';
}

function begrenze(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(wert)));
}

/**
 * Bewegungsbefehle für die Pfade.
 * Achtung: Der Plotter erwartet zuerst y (Vorschub), dann x (Wagen).
 * M = mit angehobenem Werkzeug fahren, D = mit abgesenktem Werkzeug fahren.
 */
export function pfadBefehle(pfade: readonly Polylinie[]): string[] {
  const befehle: string[] = [];
  for (const pfad of pfade) {
    const [start, ...rest] = pfad;
    if (!start || rest.length === 0) continue; // ein einzelner Punkt ergibt keinen Strich
    befehle.push(`M${mmZuSchritten(start.y)},${mmZuSchritten(start.x)}`);
    for (const p of rest) {
      befehle.push(`D${mmZuSchritten(p.y)},${mmZuSchritten(p.x)}`);
    }
  }
  return befehle;
}

/**
 * Prüft, ob alle Punkte im Schneidebereich liegen.
 * Anders als Graphtec.py wird nichts still abgeschnitten: Ein Fehler ist besser als ein
 * Schnitt, der anders aussieht als die Vorschau.
 */
export function pruefeAuftrag(job: CutJob, profil: GeraeteProfil): void {
  const bereich = schneidebereichMm(profil, job.matte);
  for (const [i, pfad] of job.pfade.entries()) {
    for (const p of pfad) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new AuftragsFehler(`Pfad ${i + 1} enthält einen ungültigen Punkt.`);
      }
      if (p.x < 0 || p.y < 0 || p.x > bereich.breite || p.y > bereich.hoehe) {
        const zahl = (n: number, stellen: number) => n.toFixed(stellen).replace('.', ',');
        throw new AuftragsFehler(
          `Pfad ${i + 1} liegt außerhalb des Schneidebereichs ` +
            `(${zahl(bereich.breite, 1)} × ${zahl(bereich.hoehe, 1)} mm): ` +
            `Punkt (${zahl(p.x, 2)} | ${zahl(p.y, 2)}) mm.`,
        );
      }
    }
  }
  if (job.werkzeug.halter === 2 && !profil.zweiHalter) {
    throw new AuftragsFehler(`${profil.name} hat keinen zweiten Werkzeughalter.`);
  }
  if (job.werkzeug.tiefe !== undefined && job.werkzeug.art === 'messer' && job.werkzeug.halter !== 1) {
    throw new AuftragsFehler('Die Klingentiefe (AutoBlade) lässt sich nur in Halter 1 einstellen.');
  }
}

/** Matte, Ausrichtung und Schneidebereich – der gemeinsame Anfang jedes Auftrags (set_cutting_mat). */
function kopfBefehle(profil: GeraeteProfil, mattenId: CutJob['matte']): string[] {
  const matte = matten[mattenId];
  const befehle = [`TG${matte.code}`, 'FN0', 'TB50,0']; // Hochformat; Silhouette Studio sendet beides
  // Schneidebereich: oben links \y,x und unten rechts Zy,x
  if (matte.breiteZoll !== undefined && matte.hoeheZoll !== undefined) {
    befehle.push('\\0,0', `Z${matte.hoeheZoll * SCHRITTE_PRO_ZOLL},${matte.breiteZoll * SCHRITTE_PRO_ZOLL}`);
  } else {
    befehle.push('\\0,0', `Z${mmZuSchritten(profil.laengeMm)},${mmZuSchritten(profil.breiteMm)}`);
  }
  return befehle;
}

/** Zurück zum Start (endposition 'start' in Graphtec.py) – das gemeinsame Ende jedes Auftrags. */
const END_BEFEHLE = ['L0', '\\0,0', 'M0,0', 'J0', 'FN0', 'TB50,0'];

/**
 * Testfahrt ohne Schnitt: Der Kopf fährt mit angehobenem Werkzeug (nur M-Befehle) ein Quadrat
 * ab und kehrt zurück. So erkennt man im Raum, welches Gerät verbunden ist, und sieht, ob der
 * Bereich frei ist – ohne Material zu beschädigen.
 */
export function testfahrtBefehle(profil: GeraeteProfil, mattenId: CutJob['matte'], seiteMm = 20, abstandMm = 10): string[] {
  const a = mmZuSchritten(abstandMm);
  const b = mmZuSchritten(abstandMm + seiteMm);
  return [...kopfBefehle(profil, mattenId), `M${a},${a}`, `M${a},${b}`, `M${b},${b}`, `M${b},${a}`, `M${a},${a}`, ...END_BEFEHLE];
}

/**
 * Übersetzt einen Auftrag in die Liste der GPGL-Befehle (ohne ETX).
 * Gilt für die Produktlinie ab Cameo 4, zu der auch Cameo 5 und Portrait 3/4 gehören.
 *
 * Nicht enthalten sind Initialisierung und Abfragen (ESC-Befehle, FG):
 * Die gehören zur Verbindung, nicht zum Auftrag.
 */
export function auftragZuBefehlen(job: CutJob, profil: GeraeteProfil): string[] {
  pruefeAuftrag(job, profil);

  const w = job.werkzeug;
  const h = w.halter;
  const stift = w.art === 'stift';
  const druck = begrenze(w.druck, 1, profil.maxDruck);
  const tempo = begrenze(w.geschwindigkeit, 1, 30);

  // 1. und 2. Matte, Ausrichtung und Schneidebereich (set_cutting_mat)
  const befehle: string[] = kopfBefehle(profil, job.matte);

  // 3. Werkzeug (setup, Zweig für die Produktlinie ab Cameo 4)
  if (profil.zweiHalter) befehle.push(`J${h}`);
  befehle.push(`FX${druck},${h}`); // Druck
  befehle.push('TJ0'); // Beschleunigung: beim ersten Mal immer 0
  befehle.push(`!${tempo},${h}`); // Geschwindigkeit
  befehle.push(`FC0,1,${h}`); // Werkzeugversatz zunächst 0 mm × 0,05 mm
  befehle.push(`FE0,${h}`); // zwischen Pfaden nicht extra anheben
  if (stift) {
    befehle.push(`FF0,0,${h}`, `FF0,0,${h}`); // Ecken schärfen aus
  } else {
    // Ecken schärfen: Start und Ende in 0,1 mm (nicht in Schritten!).
    // Graphtec.py nimmt je 0,1 mm und rechnet int((0,1 + 0,05) · 10) = 1.
    const ecken = 1;
    befehle.push(`FF${ecken},0,${h}`, `FF${ecken},${ecken},${h}`);
  }
  befehle.push(`FX${druck},${h}`); // Druck noch einmal, wie Silhouette Studio
  befehle.push('TJ3'); // Beschleunigung
  const versatz = stift ? 0 : mmZuSchritten(w.klingenVersatzMm ?? 0.9);
  befehle.push(`FC${versatz},1,${h}`); // Versatz für Stift (0) bzw. Klinge (0,9 mm = 18)
  // Klingentiefe der AutoBlade, nur Halter 1 (Graphtec.py: autoblade und depth)
  if (!stift && w.tiefe !== undefined) befehle.push(`TF${begrenze(w.tiefe, 0, 10)},1`);

  // 4. Die eigentlichen Pfade
  befehle.push(...pfadBefehle(job.pfade));

  // 5. Zurück zum Start
  befehle.push(...END_BEFEHLE);

  return befehle;
}

// ---------------------------------------------------------------------------
// Befehle → Bytes
// ---------------------------------------------------------------------------

/** Hängt an jeden Befehl ETX an und kodiert alles als ASCII-Bytes. */
export function befehleZuBytes(befehle: readonly string[]): Uint8Array {
  const text = befehle.map((b) => b + String.fromCharCode(ETX)).join('');
  return new TextEncoder().encode(text);
}

/**
 * Teilt die Bytes in Blöcke von höchstens `maxBytes`, und zwar nur direkt nach einem ETX,
 * damit kein Befehl zerrissen wird (wie safe_write in Graphtec.py, dort 1024 Byte).
 * Nach jedem Block wartet der Treiber, bis das Gerät wieder bereit ist.
 */
export function inBloeckeTeilen(bytes: Uint8Array, maxBytes = 1024): Uint8Array[] {
  const bloecke: Uint8Array[] = [];
  let start = 0;
  while (start < bytes.length) {
    const ende = Math.min(start + maxBytes, bytes.length);
    let schnitt = bytes.lastIndexOf(ETX, ende - 1) + 1;
    if (schnitt <= start) {
      // Ein einzelner Befehl ist länger als ein Block: dann eben bis zum nächsten ETX.
      const naechstes = bytes.indexOf(ETX, ende);
      schnitt = naechstes === -1 ? bytes.length : naechstes + 1;
    }
    bloecke.push(bytes.subarray(start, schnitt));
    start = schnitt;
  }
  return bloecke;
}

/**
 * Macht Bytes lesbar: Steuerzeichen erscheinen als <ESC>, <ETX> usw.
 * Für das Protokollfenster und die Anzeige in der Simulation.
 */
export function bytesAlsText(bytes: Uint8Array): string {
  const namen: Record<number, string> = {
    0x03: '<ETX>',
    0x04: '<EOT>',
    0x05: '<ENQ>',
    0x0b: '<VT>',
    0x15: '<NAK>',
    0x1b: '<ESC>',
  };
  let text = '';
  for (const b of bytes) {
    if (namen[b] !== undefined) text += namen[b];
    else if (b >= 0x20 && b < 0x7f) text += String.fromCharCode(b);
    else text += `<${b.toString(16).padStart(2, '0')}>`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Testfiguren
// ---------------------------------------------------------------------------

/** Ein Quadrat als geschlossene Polylinie, für den Machbarkeitstest. */
export function testQuadrat(seiteMm = 50, abstandMm = 10): Polylinie[] {
  const a = abstandMm;
  const b = abstandMm + seiteMm;
  return [
    [
      { x: a, y: a },
      { x: b, y: a },
      { x: b, y: b },
      { x: a, y: b },
      { x: a, y: a },
    ],
  ];
}
