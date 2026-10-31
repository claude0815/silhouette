/**
 * Die Transportschicht trennt den Übertragungsweg (USB, Bluetooth, Simulation)
 * vom Protokoll. Der Treiber schiebt nur Bytes hinein und liest Antworten heraus.
 * Die Idee stammt aus inkscape-silhouette, silhouette/Transport.py.
 */
import { ETX } from './gpgl';

export interface Transport {
  /** Kurze Beschreibung für die Anzeige, z. B. "USB" oder "Bluetooth". */
  readonly art: string;
  /** Gerätename, soweit bekannt. */
  readonly geraetename?: string;
  schreibe(bytes: Uint8Array): Promise<void>;
  /** Liest eine Antwort bis einschließlich ETX. Liefert null, wenn in der Zeit nichts kommt. */
  lese(timeoutMs: number): Promise<Uint8Array | null>;
  /** Verwirft alles, was bisher empfangen, aber nicht gelesen wurde. */
  leereEingang(): void;
  schliesse(): Promise<void>;
}

/**
 * Sammelt eingehende Bytes und gibt sie Antwort für Antwort (jeweils bis ETX) heraus.
 *
 * USB und Bluetooth liefern Daten in beliebig zerstückelten Paketen. Ein eigener
 * Lese-Vorgang läuft im Hintergrund und legt alles hier ab; der Treiber holt sich
 * dann vollständige Antworten. So bleibt keine Leseanfrage hängen, wenn das
 * Gerät einmal nicht antwortet.
 */
export class Empfangspuffer {
  private daten: number[] = [];
  private wartende: Array<() => void> = [];
  private geschlossen = false;

  /** Neue Bytes vom Gerät ablegen. */
  hinzufuegen(bytes: Uint8Array): void {
    for (const b of bytes) this.daten.push(b);
    this.weckeAuf();
  }

  leeren(): void {
    this.daten = [];
  }

  /** Nach dem Schließen kehren alle wartenden Leser mit null zurück. */
  schliessen(): void {
    this.geschlossen = true;
    this.weckeAuf();
  }

  /** Wartet auf eine vollständige Antwort (bis ETX), höchstens timeoutMs. */
  async lese(timeoutMs: number): Promise<Uint8Array | null> {
    const ende = Date.now() + timeoutMs;
    for (;;) {
      const antwort = this.nimmAntwort();
      if (antwort) return antwort;
      const rest = ende - Date.now();
      if (this.geschlossen || rest <= 0) return null;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(fertig, rest);
        function fertig() {
          clearTimeout(timer);
          resolve();
        }
        this.wartende.push(fertig);
      });
    }
  }

  private nimmAntwort(): Uint8Array | null {
    const pos = this.daten.indexOf(ETX);
    if (pos === -1) return null;
    return Uint8Array.from(this.daten.splice(0, pos + 1));
  }

  private weckeAuf(): void {
    const w = this.wartende;
    this.wartende = [];
    for (const f of w) f();
  }
}
