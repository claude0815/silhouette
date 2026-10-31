/**
 * Der Rechendienst hinter dem Web Worker.
 *
 * Ein Web Worker ist ein eigener Ausführungsstrang im Browser. Rechnet er, bleibt die
 * Oberfläche bedienbar. Worker und Seite teilen sich keinen Speicher, sie schicken sich
 * Nachrichten; große Daten werden dabei kopiert.
 *
 * Damit wenig kopiert wird, hält der Dienst das Bild und alle Zwischenstände selbst
 * und schickt nur die Teile zurück, die er neu berechnet hat.
 */
import { fuehreAus, teilAb, type Einstellungen, type Ergebnis } from '../pipeline/ablauf';
import type { Farbbild } from '../pipeline/bilder';

export interface Auftrag {
  art: 'rechne';
  nummer: number;
  /** Nur beim ersten Mal oder bei einem neuen Bild */
  bild?: Farbbild;
  einstellungen: Einstellungen;
}

export type Antwort =
  | { art: 'ergebnis'; nummer: number; ab: number; teil: Partial<Ergebnis> }
  | { art: 'fehler'; nummer: number; text: string };

export class Rechendienst {
  private bild: Farbbild | null = null;
  private letzter: { einstellungen: Einstellungen; ergebnis: Ergebnis } | undefined;

  bearbeite(auftrag: Auftrag): Antwort {
    try {
      if (auftrag.bild) {
        this.bild = auftrag.bild;
        this.letzter = undefined;
      }
      if (!this.bild) return { art: 'fehler', nummer: auftrag.nummer, text: 'Es ist noch kein Bild geladen.' };
      const { ergebnis, ab } = fuehreAus(this.bild, auftrag.einstellungen, this.letzter);
      this.letzter = { einstellungen: auftrag.einstellungen, ergebnis };
      return { art: 'ergebnis', nummer: auftrag.nummer, ab, teil: teilAb(ergebnis, ab) };
    } catch (e) {
      return { art: 'fehler', nummer: auftrag.nummer, text: e instanceof Error ? e.message : String(e) };
    }
  }
}

/**
 * Verbindet den Dienst mit dem Nachrichtenkanal und überspringt veraltete Aufträge:
 * Während gerechnet wird, sammeln sich neue Nachrichten an. Danach wird nur der neueste
 * Auftrag bearbeitet – ein neues Bild darin geht aber nie verloren.
 */
export function verbinde(empfange: (f: (a: Auftrag) => void) => void, sende: (a: Antwort) => void): void {
  const dienst = new Rechendienst();
  let wartend: Auftrag | null = null;
  let geplant = false;
  empfange((auftrag) => {
    // Ein neues Bild aus einem übersprungenen Auftrag mitnehmen
    wartend = { ...auftrag, bild: auftrag.bild ?? wartend?.bild };
    if (geplant) return;
    geplant = true;
    setTimeout(() => {
      geplant = false;
      const a = wartend!;
      wartend = null;
      sende(dienst.bearbeite(a));
    }, 0);
  });
}
