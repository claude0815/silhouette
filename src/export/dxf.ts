/**
 * Export als DXF (Drawing Exchange Format), damit Silhouette Studio die Pfade öffnen kann.
 * Die Schulversion von Studio öffnet kein SVG, DXF aber schon.
 *
 * Aufbau einer DXF-Datei: Sie besteht nur aus Paaren von Zeilen.
 * Die erste Zeile ist ein Gruppencode (eine Zahl), die zweite der Wert.
 *   0  → Beginn eines neuen Elements, z. B. "SECTION", "POLYLINE", "EOF"
 *   2  → Name, z. B. der Abschnitt "ENTITIES"
 *   8  → Ebene (Layer)
 *   10, 20 → x- und y-Koordinate
 *   70 → Schalter, z. B. 1 = geschlossene Polylinie
 *
 * Gewählt ist das alte, sehr einfache Format R12 (AC1009): Es braucht keine Kennungen
 * (Handles) und keine Objekttabellen und wird von fast allen Programmen gelesen.
 *
 * Achtung Koordinaten: In SVG und beim Cutter zeigt y nach unten, in DXF nach oben
 * (wie im Mathematikunterricht). Damit die Zeichnung nicht auf dem Kopf steht,
 * wird gespiegelt: y_DXF = Höhe − y_SVG.
 */
import type { Punkt, Polylinie } from '../cutter/types';

export type DxfVariante = 'polylinie' | 'linien';

export interface DxfOptionen {
  /**
   * 'polylinie': jeder Pfad als POLYLINE mit VERTEX-Punkten (Standard).
   * 'linien': jedes Teilstück als eigene LINE. Einfacher, verliert aber die Zusammengehörigkeit.
   * Welche Variante Silhouette Studio besser liest, klärt der Machbarkeitstest.
   */
  variante?: DxfVariante;
  /** Höhe der Zeichenfläche in mm für die Spiegelung. Standard: größtes y aller Punkte. */
  hoeheMm?: number;
  /** Name der Ebene. */
  ebene?: string;
}

/** Abstand, unter dem zwei Punkte als gleich gelten (in mm). */
const GLEICH_MM = 1e-6;

function gleich(a: Punkt, b: Punkt): boolean {
  return Math.abs(a.x - b.x) < GLEICH_MM && Math.abs(a.y - b.y) < GLEICH_MM;
}

/** Ein Pfad ist geschlossen, wenn er dort endet, wo er beginnt. */
export function istGeschlossen(pfad: Polylinie): boolean {
  return pfad.length > 2 && gleich(pfad[0]!, pfad[pfad.length - 1]!);
}

/** Zahlen mit Punkt als Dezimaltrennzeichen und höchstens 4 Nachkommastellen, ohne „-0“. */
export function dxfZahl(n: number): string {
  const gerundet = Math.round(n * 10_000) / 10_000;
  return (Object.is(gerundet, -0) ? 0 : gerundet).toString();
}

/** Erzeugt den Text einer DXF-Datei aus Polylinien in mm. */
export function polylinienZuDxf(pfade: readonly Polylinie[], optionen: DxfOptionen = {}): string {
  const variante = optionen.variante ?? 'polylinie';
  const ebene = optionen.ebene ?? '0';
  const nutzbar = pfade.filter((p) => p.length >= 2);
  const alleY = nutzbar.flat().map((p) => p.y);
  const hoehe = optionen.hoeheMm ?? (alleY.length ? Math.max(...alleY) : 0);

  const zeilen: string[] = [];
  /** Hängt ein Paar aus Gruppencode und Wert an. */
  const paar = (code: number, wert: string | number) => zeilen.push(String(code), String(wert));
  const punkt = (p: Punkt, codeX = 10) => {
    paar(codeX, dxfZahl(p.x));
    paar(codeX + 10, dxfZahl(hoehe - p.y)); // spiegeln, siehe oben
  };

  // Kopf: Version R12 und Einheit Millimeter.
  paar(0, 'SECTION');
  paar(2, 'HEADER');
  paar(9, '$ACADVER');
  paar(1, 'AC1009');
  paar(9, '$INSUNITS'); // Einheit der Zeichnung: 4 = Millimeter
  paar(70, 4);
  paar(9, '$MEASUREMENT'); // 1 = metrisch
  paar(70, 1);
  paar(0, 'ENDSEC');

  // Inhalt
  paar(0, 'SECTION');
  paar(2, 'ENTITIES');
  for (const pfad of nutzbar) {
    const geschlossen = istGeschlossen(pfad);
    // Bei geschlossenen Pfaden den doppelten Endpunkt weglassen, das Schließen übernimmt der Schalter.
    const punkte = geschlossen ? pfad.slice(0, -1) : pfad;

    if (variante === 'polylinie') {
      paar(0, 'POLYLINE');
      paar(8, ebene);
      paar(66, 1); // „es folgen Punkte“
      paar(10, 0); // Pflichtangabe in R12, ohne Bedeutung
      paar(20, 0);
      paar(30, 0);
      paar(70, geschlossen ? 1 : 0);
      for (const p of punkte) {
        paar(0, 'VERTEX');
        paar(8, ebene);
        punkt(p);
      }
      paar(0, 'SEQEND');
      paar(8, ebene);
    } else {
      for (let i = 1; i < pfad.length; i++) {
        paar(0, 'LINE');
        paar(8, ebene);
        punkt(pfad[i - 1]!, 10); // Anfang: 10/20
        punkt(pfad[i]!, 11); // Ende: 11/21
      }
    }
  }
  paar(0, 'ENDSEC');
  paar(0, 'EOF');

  // DXF stammt aus der DOS-Welt: Zeilenende CR LF ist am verträglichsten.
  return zeilen.join('\r\n') + '\r\n';
}
