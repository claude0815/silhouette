/**
 * Aus Plotterbefehlen werden Fahrten: Die Simulation liest dieselben GPGL-Befehle,
 * die auch an den Cutter gehen. Sie zeigt also genau das, was das Gerät tun würde.
 *
 *   M y,x  → Leerfahrt (Messer oben) zum Punkt
 *   D y,x  → Schnitt (Messer unten) zum Punkt
 * Koordinaten in Geräteschritten von 0,05 mm, zuerst y, dann x.
 * Alle anderen Befehle sind Einstellungen und bewegen nichts.
 */
import { SCHRITTE_PRO_MM } from '../cutter/gpgl';
import type { Punkt } from '../cutter/types';

export interface Fahrt {
  art: 'leer' | 'schnitt';
  von: Punkt;
  nach: Punkt;
  /** Länge in mm */
  laenge: number;
  /** Index des Befehls in der Befehlsliste */
  befehl: number;
  /** Nummer des geschnittenen Pfads (0, 1, …); bei Leerfahrten der folgende Pfad */
  pfad: number;
}

export function befehleZuFahrten(befehle: readonly string[]): Fahrt[] {
  const fahrten: Fahrt[] = [];
  let hier: Punkt = { x: 0, y: 0 };
  let pfad = -1;
  befehle.forEach((b, i) => {
    const m = /^([MD])(-?\d+),(-?\d+)$/.exec(b);
    if (!m) return;
    const nach = { x: Number(m[3]) / SCHRITTE_PRO_MM, y: Number(m[2]) / SCHRITTE_PRO_MM };
    const art = m[1] === 'M' ? 'leer' : 'schnitt';
    if (art === 'leer') pfad++;
    const laenge = Math.hypot(nach.x - hier.x, nach.y - hier.y);
    if (laenge > 0 || art === 'schnitt') fahrten.push({ art, von: hier, nach, laenge, befehl: i, pfad });
    hier = nach;
  });
  return fahrten;
}

export interface Zeitannahmen {
  /** Geschwindigkeit beim Schneiden in mm/s */
  schnittMmS: number;
  /** Geschwindigkeit bei Leerfahrten in mm/s */
  leerMmS: number;
  /** Zeit für Absenken und Anheben je Pfad in s */
  hebenS: number;
}

/**
 * Grobe Annahme: Stufe n ≈ n cm/s (so beschreibt es die Graphtec-Anleitung für Stufen 1–10).
 * Ob das für Cameo 4/5 und Stufen bis 30 stimmt, klärt erst eine Messung am Gerät.
 */
export function zeitannahmen(geschwindigkeitsStufe: number): Zeitannahmen {
  const mmS = Math.max(1, geschwindigkeitsStufe) * 10;
  return { schnittMmS: mmS, leerMmS: mmS, hebenS: 0.15 };
}

export interface Kennzahlen {
  schnittMm: number;
  leerMm: number;
  pfade: number;
  dauerS: number;
}

export function kennzahlen(fahrten: readonly Fahrt[], z: Zeitannahmen): Kennzahlen {
  let schnittMm = 0;
  let leerMm = 0;
  const pfade = new Set<number>();
  for (const f of fahrten) {
    if (f.art === 'schnitt') {
      schnittMm += f.laenge;
      pfade.add(f.pfad);
    } else leerMm += f.laenge;
  }
  return {
    schnittMm,
    leerMm,
    pfade: pfade.size,
    dauerS: schnittMm / z.schnittMmS + leerMm / z.leerMmS + pfade.size * z.hebenS,
  };
}

/** Zeitplan: Startzeit jeder Fahrt in s (letzter Eintrag = Gesamtdauer). */
export function zeitplan(fahrten: readonly Fahrt[], z: Zeitannahmen): number[] {
  const zeiten = [0];
  let t = 0;
  let letzterPfad = -1;
  for (const f of fahrten) {
    if (f.art === 'schnitt' && f.pfad !== letzterPfad) {
      t += z.hebenS; // Absenken zu Beginn eines Pfads
      letzterPfad = f.pfad;
    }
    t += f.laenge / (f.art === 'schnitt' ? z.schnittMmS : z.leerMmS);
    zeiten.push(t);
  }
  return zeiten;
}

/** Wo ist das Messer zur Zeit t? Index der laufenden Fahrt und Position. */
export function zustandZurZeit(fahrten: readonly Fahrt[], zeiten: readonly number[], t: number): { index: number; position: Punkt } {
  if (fahrten.length === 0) return { index: -1, position: { x: 0, y: 0 } };
  // Binäre Suche: letzte Fahrt, deren Startzeit ≤ t ist
  let lo = 0;
  let hi = fahrten.length - 1;
  while (lo < hi) {
    const mitte = (lo + hi + 1) >> 1;
    if (zeiten[mitte]! <= t) lo = mitte;
    else hi = mitte - 1;
  }
  const f = fahrten[lo]!;
  const dauer = zeiten[lo + 1]! - zeiten[lo]!;
  const anteil = dauer > 0 ? Math.min(1, Math.max(0, (t - zeiten[lo]!) / dauer)) : 1;
  return { index: lo, position: { x: f.von.x + (f.nach.x - f.von.x) * anteil, y: f.von.y + (f.nach.y - f.von.y) * anteil } };
}
