/**
 * Gemeinsame Typen für alle Cutter: Simulation, WebUSB und Web Bluetooth.
 *
 * Koordinaten sind immer in Millimetern, Ursprung oben links,
 * x nach rechts (Wagenrichtung), y nach unten (Vorschubrichtung) – wie in SVG.
 * Erst das GPGL-Modul rechnet in die Schritte des Geräts um.
 */

/** Ein Punkt in mm. */
export interface Punkt {
  x: number;
  y: number;
}

/** Ein zusammenhängender Strich: Werkzeug runter am ersten Punkt, hoch nach dem letzten. */
export type Polylinie = readonly Punkt[];

export type WerkzeugArt = 'stift' | 'messer';

export interface Werkzeug {
  art: WerkzeugArt;
  /** Druck, 1 bis 33 (bei manchen Modellen mehr). */
  druck: number;
  /** Geschwindigkeit, 1 bis 30. */
  geschwindigkeit: number;
  /** Werkzeughalter 1 (links) oder 2 (rechts). Portrait-Modelle haben nur Halter 1. */
  halter: 1 | 2;
  /** Durchmesser, um den die Klinge nachläuft; üblich sind 0,9 mm. Nur beim Messer. */
  klingenVersatzMm?: number;
  /**
   * Klingentiefe der AutoBlade (1 bis 10), nur in Halter 1. Ohne Angabe wird keine Tiefe gesendet
   * (z. B. bei der Ratchet-Klinge, deren Tiefe man von Hand einstellt).
   */
  tiefe?: number;
}

/** Schlüssel der bekannten Schneidematten, siehe `matten` in profile.ts. */
export type MattenId =
  | 'keine'
  | 'cameo-12x12'
  | 'cameo-12x24'
  | 'portrait-8x12'
  | 'cameo-plus-15x15'
  | 'cameo-pro-24x24'
  | 'portrait-8.5x12';

/** Ein Auftrag: alles, was der Cutter für einen Durchgang braucht. */
export interface CutJob {
  pfade: readonly Polylinie[];
  werkzeug: Werkzeug;
  matte: MattenId;
}

/** Was das Gerät auf die Statusabfrage antwortet. */
export type GeraeteStatus = 'bereit' | 'in-bewegung' | 'keine-matte' | 'unbekannt';

export interface StatusAntwort {
  status: GeraeteStatus;
  /** Rohantwort ohne ETX, z. B. "0". Hilfreich bei unbekannten Antworten. */
  roh: string;
}

/** Ein Eintrag im Protokoll der Kommunikation, für die Anzeige und die Fehlersuche. */
export interface ProtokollEintrag {
  zeit: number;
  richtung: 'gesendet' | 'empfangen' | 'info' | 'fehler';
  text: string;
  bytes?: Uint8Array;
}

export interface SendeOptionen {
  /** Wird nach jedem übertragenen Block aufgerufen. */
  onFortschritt?: (gesendet: number, gesamt: number) => void;
}

/**
 * Die gemeinsame Schnittstelle aller Cutter.
 * Simulation, WebUSB und Web Bluetooth sind dadurch austauschbar.
 */
export interface Cutter {
  /** Anzeigename, z. B. "Cameo 4 (USB)". Nach connect() genauer. */
  readonly name: string;
  connect(): Promise<void>;
  status(): Promise<StatusAntwort>;
  send(job: CutJob, optionen?: SendeOptionen): Promise<void>;
  /** Hört auf, weitere Daten zu senden. Bereits übertragene Befehle führt das Gerät noch aus. */
  cancel(): Promise<void>;
  disconnect(): Promise<void>;
}
