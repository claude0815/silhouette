/**
 * Geräteprofile und Schneidematten.
 *
 * Herkunft der Werte: inkscape-silhouette, silhouette/Graphtec.py (Commit f376a08),
 * (c) 2013,2014 jw@suse.de, (c) 2016 juewei@fabmail.org, (c) 2016 Alexander Wenger,
 * (c) 2017 Johann Gail, „Distribute under GPLv2 or ask“.
 * https://github.com/fablabnbg/inkscape-silhouette
 * Übertragen nach TypeScript; Zusammenfassung in docs/protokoll.md.
 */
import type { MattenId } from './types';

/** Hersteller-ID von Graphtec, unter der sich Silhouette-Geräte am USB melden. */
export const VENDOR_ID_GRAPHTEC = 0x0b4d;
/** Der Cameo 5 Alpha meldet sich mit einer eigenen Hersteller-ID. */
export const VENDOR_ID_CAMEO5_ALPHA = 0x3844;

export interface GeraeteProfil {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  /** Größte Schneidebreite in mm. */
  breiteMm: number;
  /** Größte Schneidelänge ohne Matte in mm. */
  laengeMm: number;
  /** Zwei Werkzeughalter? Portrait-Modelle haben nur einen. */
  zweiHalter: boolean;
  /** Höchster erlaubter Druck. */
  maxDruck: number;
  /** Anfänge des Bluetooth-Namens bzw. der Firmware-Antwort (FG), in Großbuchstaben. */
  namen: readonly string[];
}

/**
 * Die Modelle der Schule und ihre nahen Verwandten.
 * Alle gehören in Graphtec.py zur Produktlinie „Cameo 4“ und sprechen denselben Befehlssatz.
 * Reihenfolge der Namen: Spezielle Namen müssen vor allgemeinen geprüft werden
 * („CAMEO 4 PLUS“ vor „CAMEO 4“), siehe profilFuerName().
 */
export const profile: readonly GeraeteProfil[] = [
  {
    id: 'cameo4',
    name: 'Cameo 4',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x1137,
    breiteMm: 304.8,
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 33,
    namen: ['CAMEO 4'],
  },
  {
    id: 'cameo4plus',
    name: 'Cameo 4 Plus',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x1138,
    breiteMm: 372, // laut Graphtec.py geschätzt
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 33,
    namen: ['CAMEO 4 PLUS'],
  },
  {
    id: 'cameo4pro',
    name: 'Cameo 4 Pro',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x1139,
    breiteMm: 600,
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 33,
    namen: ['CAMEO 4 PRO'],
  },
  {
    id: 'cameo5',
    name: 'Cameo 5',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x1140,
    breiteMm: 330.2,
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 33,
    namen: ['CAMEO 5'],
  },
  {
    id: 'cameo5plus',
    name: 'Cameo 5 Plus',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x1141,
    breiteMm: 372,
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 33,
    namen: ['CAMEO 5 PLUS'],
  },
  {
    id: 'cameo5alpha',
    name: 'Cameo 5 Alpha',
    vendorId: VENDOR_ID_CAMEO5_ALPHA,
    productId: 0x0001,
    breiteMm: 330.2,
    laengeMm: 3000,
    zweiHalter: true,
    maxDruck: 40,
    namen: ['CAMEO 5 ALPHA'],
  },
  {
    id: 'portrait3',
    name: 'Portrait 3',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x113a,
    breiteMm: 203,
    laengeMm: 18290,
    zweiHalter: false,
    maxDruck: 33,
    namen: ['PORTRAIT3', 'PORTRAIT 3'],
  },
  {
    id: 'portrait4',
    name: 'Portrait 4',
    vendorId: VENDOR_ID_GRAPHTEC,
    productId: 0x113f,
    breiteMm: 216,
    laengeMm: 18290,
    zweiHalter: false,
    maxDruck: 33,
    namen: ['PORTRAIT4', 'PORTRAIT 4'],
  },
];

/** Profil für unbekannte Geräte: vorsichtige Werte, Befehlssatz wie Cameo 4. */
export function unbekanntesProfil(vendorId: number, productId: number, name?: string): GeraeteProfil {
  const hex = (n: number) => '0x' + n.toString(16).padStart(4, '0');
  return {
    id: 'unbekannt',
    name: name ?? `Unbekanntes Gerät ${hex(vendorId)}:${hex(productId)}`,
    vendorId,
    productId,
    breiteMm: 203, // die kleinste bekannte Breite, damit nichts gegen den Anschlag fährt
    laengeMm: 3000,
    zweiHalter: false,
    maxDruck: 33,
    namen: [],
  };
}

export function profilFuerUsb(vendorId: number, productId: number): GeraeteProfil | undefined {
  return profile.find((p) => p.vendorId === vendorId && p.productId === productId);
}

/**
 * Sucht das Profil zu einem Bluetooth-Namen oder einer Firmware-Antwort,
 * z. B. "CAMEO 4 PLUS-123456" oder "CAMEO 5 V1.02".
 * Der längste passende Name gewinnt, damit „CAMEO 5 PLUS“ nicht als „CAMEO 5“ erkannt wird.
 */
export function profilFuerName(text: string): GeraeteProfil | undefined {
  const suche = text.trim().toUpperCase();
  let bestes: { profil: GeraeteProfil; laenge: number } | undefined;
  for (const profil of profile) {
    for (const name of profil.namen) {
      if (suche.includes(name) && (!bestes || name.length > bestes.laenge)) {
        bestes = { profil, laenge: name.length };
      }
    }
  }
  return bestes?.profil;
}

export interface Matte {
  name: string;
  /** Wert für den Befehl TGn. */
  code: number;
  /** Abmessungen in Zoll; bei „keine“ nicht gesetzt. */
  breiteZoll?: number;
  hoeheZoll?: number;
}

/** Schneidematten, Werte aus CAMEO_MATS in Graphtec.py. */
export const matten: Readonly<Record<MattenId, Matte>> = {
  keine: { name: 'Ohne Matte', code: 0 },
  'cameo-12x12': { name: 'Cameo 12″ × 12″', code: 1, breiteZoll: 12, hoeheZoll: 12 },
  'cameo-12x24': { name: 'Cameo 12″ × 24″', code: 2, breiteZoll: 12, hoeheZoll: 24 },
  'portrait-8x12': { name: 'Portrait 8″ × 12″', code: 3, breiteZoll: 8, hoeheZoll: 12 },
  'cameo-plus-15x15': { name: 'Cameo Plus 15″ × 15″', code: 8, breiteZoll: 15, hoeheZoll: 15 },
  'cameo-pro-24x24': { name: 'Cameo Pro 24″ × 24″', code: 9, breiteZoll: 24, hoeheZoll: 24 },
  'portrait-8.5x12': { name: 'Portrait 8,5″ × 12″', code: 11, breiteZoll: 8.5, hoeheZoll: 12 },
};

/**
 * Schneidebereich in mm für ein Gerät mit einer Matte.
 * Ist die Matte breiter als das Gerät (z. B. 12″-Matte im Portrait), begrenzt das Gerät.
 */
export function schneidebereichMm(profil: GeraeteProfil, mattenId: MattenId): { breite: number; hoehe: number } {
  const matte = matten[mattenId];
  if (matte.breiteZoll !== undefined && matte.hoeheZoll !== undefined) {
    // Über ganze Geräteschritte rechnen (508 pro Zoll, 20 pro mm):
    // 12 · 25,4 ergäbe in Gleitkomma 304,79999…, 12 · 508 / 20 genau 304,8.
    const zollZuMm = (zoll: number) => (zoll * 508) / 20;
    return {
      breite: Math.min(zollZuMm(matte.breiteZoll), profil.breiteMm),
      hoehe: zollZuMm(matte.hoeheZoll),
    };
  }
  return { breite: profil.breiteMm, hoehe: profil.laengeMm };
}
