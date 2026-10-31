/**
 * Ablaufsteuerung: führt die acht Schritte nacheinander aus.
 *
 * Wenn sich nur ein Regler ändert, muss nicht alles neu gerechnet werden: Ändert sich
 * z. B. die Toleranz beim Vereinfachen (Schritt 6), bleiben die Schritte 1 bis 5 gleich.
 * Darum merkt sich die Steuerung, welche Einstellungen zu welchem Schritt gehören,
 * und rechnet erst ab dem ersten Schritt neu, dessen Einstellungen sich geändert haben.
 */
import type { Binaerbild, Farbbild, Graubild, Punkt } from './bilder';
import { entrausche } from './entrauschen';
import { glaette, type Bezierpfad } from './glaetten';
import { formel, zuGraustufen, type GrauVerfahren } from './graustufen';
import { findeKonturen, gruppiere, type Kontur } from './konturen';
import { binarisiere, histogramm, otsu } from './schwellwert';
import { erzeugeSvg, type SvgErgebnis } from './svg-erzeugen';
import { vereinfacheGeschlossen } from './vereinfachen';

export interface Einstellungen {
  // Schritt 2
  grauVerfahren: GrauVerfahren;
  // Schritt 3
  schwelleAutomatisch: boolean;
  schwelle: number;
  invertieren: boolean;
  // Schritt 4
  entrauschen: boolean;
  mindestflaeche: number;
  // Schritt 6
  toleranz: number;
  // Schritt 7
  glaetten: boolean;
  staerke: number;
  eckenWinkel: number;
  // Schritt 8
  breiteMm: number;
  positionXMm: number;
  positionYMm: number;
}

export const STANDARD: Einstellungen = {
  grauVerfahren: 'luminanz',
  schwelleAutomatisch: true,
  schwelle: 128,
  invertieren: false,
  entrauschen: true,
  mindestflaeche: 10,
  toleranz: 1,
  glaetten: true,
  staerke: 1,
  eckenWinkel: 70,
  breiteMm: 100,
  positionXMm: 10,
  positionYMm: 10,
};

/** Welche Einstellungen gehören zu welchem Schritt? Schritt 1 ist das Bild selbst. */
export const EINSTELLUNGEN_JE_SCHRITT: Record<number, readonly (keyof Einstellungen)[]> = {
  2: ['grauVerfahren'],
  3: ['schwelleAutomatisch', 'schwelle', 'invertieren'],
  4: ['entrauschen', 'mindestflaeche'],
  5: [],
  6: ['toleranz'],
  7: ['glaetten', 'staerke', 'eckenWinkel'],
  8: ['breiteMm', 'positionXMm', 'positionYMm'],
};

export interface VereinfachteForm {
  aussen: Punkt[];
  loecher: Punkt[][];
}

export interface GeglaetteteForm {
  aussen: Bezierpfad;
  loecher: Bezierpfad[];
}

/** Die Ergebnisse aller Schritte. Jeder Teil gehört zu genau einem Schritt. */
export interface Ergebnis {
  // 1
  bild: Farbbild;
  // 2
  grau: Graubild;
  formel: string;
  // 3
  histogramm: Uint32Array;
  otsuSchwelle: number;
  /** Tatsächlich verwendeter Schwellwert (Otsu oder von Hand) */
  schwelle: number;
  binaer: Binaerbild;
  // 4
  entrauscht: Binaerbild;
  geaendert: Uint8Array;
  entfernteFlecken: number;
  gefuellteLoecher: number;
  // 5
  konturen: Kontur[];
  punkteRoh: number;
  // 6
  vereinfacht: VereinfachteForm[];
  punkteVereinfacht: number;
  // 7
  geglaettet: GeglaetteteForm[] | null;
  // 8
  svg: SvgErgebnis;
  /** Rechenzeit je Schritt in ms */
  zeiten: Record<number, number>;
}

/** Erster Schritt, dessen Einstellungen sich unterscheiden (9 = keiner). */
export function ersterGeaenderterSchritt(alt: Einstellungen, neu: Einstellungen): number {
  for (let schritt = 2; schritt <= 8; schritt++) {
    if (EINSTELLUNGEN_JE_SCHRITT[schritt]!.some((k) => alt[k] !== neu[k])) return schritt;
  }
  return 9;
}

const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Führt die Pipeline aus. Mit `vorher` (gleiches Bild, frühere Einstellungen und
 * Ergebnisse) wird erst ab dem ersten geänderten Schritt neu gerechnet.
 *
 * Rückgabe: das vollständige Ergebnis und `ab`, die Nummer des ersten neu berechneten Schritts.
 */
export function fuehreAus(
  bild: Farbbild,
  e: Einstellungen,
  vorher?: { einstellungen: Einstellungen; ergebnis: Ergebnis },
): { ergebnis: Ergebnis; ab: number } {
  const ab = vorher && vorher.ergebnis.bild === bild ? ersterGeaenderterSchritt(vorher.einstellungen, e) : 1;
  const r: Partial<Ergebnis> = ab > 1 ? { ...vorher!.ergebnis, zeiten: { ...vorher!.ergebnis.zeiten } } : {};
  const zeiten: Record<number, number> = r.zeiten ?? {};
  const miss = (schritt: number, f: () => void) => {
    const t0 = jetzt();
    f();
    zeiten[schritt] = jetzt() - t0;
  };

  if (ab <= 1) r.bild = bild;
  if (ab <= 2)
    miss(2, () => {
      r.grau = zuGraustufen(bild, e.grauVerfahren);
      r.formel = formel(e.grauVerfahren);
    });
  if (ab <= 3)
    miss(3, () => {
      r.histogramm = histogramm(r.grau!);
      r.otsuSchwelle = otsu(r.histogramm);
      r.schwelle = e.schwelleAutomatisch ? r.otsuSchwelle : e.schwelle;
      r.binaer = binarisiere(r.grau!, r.schwelle, e.invertieren);
    });
  if (ab <= 4)
    miss(4, () => {
      if (e.entrauschen) {
        const x = entrausche(r.binaer!, e.mindestflaeche);
        r.entrauscht = x.bild;
        r.geaendert = x.geaendert;
        r.entfernteFlecken = x.entfernteFlecken.length;
        r.gefuellteLoecher = x.gefuellteLoecher.length;
      } else {
        r.entrauscht = r.binaer!;
        r.geaendert = new Uint8Array(r.binaer!.daten.length);
        r.entfernteFlecken = 0;
        r.gefuellteLoecher = 0;
      }
    });
  if (ab <= 5)
    miss(5, () => {
      r.konturen = findeKonturen(r.entrauscht!);
      r.punkteRoh = r.konturen.reduce((s, k) => s + k.punkte.length, 0);
    });
  if (ab <= 6)
    miss(6, () => {
      r.vereinfacht = gruppiere(r.konturen!).map((f) => ({
        aussen: vereinfacheGeschlossen(f.aussen.punkte, e.toleranz),
        loecher: f.loecher.map((l) => vereinfacheGeschlossen(l.punkte, e.toleranz)),
      }));
      r.punkteVereinfacht = r.vereinfacht.reduce((s, f) => s + f.aussen.length + f.loecher.reduce((t, l) => t + l.length, 0), 0);
    });
  if (ab <= 7)
    miss(7, () => {
      const o = { staerke: e.staerke, eckenWinkel: e.eckenWinkel };
      r.geglaettet = e.glaetten
        ? r.vereinfacht!.map((f) => ({ aussen: glaette(f.aussen, o), loecher: f.loecher.map((l) => glaette(l, o)) }))
        : null;
    });
  if (ab <= 8)
    miss(8, () => {
      const formen = r.geglaettet ?? r.vereinfacht!;
      r.svg = erzeugeSvg(formen, {
        bildBreitePx: bild.breite,
        bildHoehePx: bild.hoehe,
        breiteMm: e.breiteMm,
        position: { x: e.positionXMm, y: e.positionYMm },
      });
    });

  r.zeiten = zeiten;
  return { ergebnis: r as Ergebnis, ab: Math.min(ab, 9) };
}
