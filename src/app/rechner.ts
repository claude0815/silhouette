/**
 * Verbindung zum Rechen-Worker. Gibt es keinen Worker (z. B. in Tests),
 * wird im selben Strang gerechnet – langsamer für die Oberfläche, aber gleiches Ergebnis.
 */
import type { Einstellungen, Ergebnis } from '../pipeline/ablauf';
import type { Farbbild } from '../pipeline/bilder';
import { Rechendienst, type Antwort, type Auftrag } from '../worker/dienst';

export type Rueckmeldung = (a: Antwort) => void;

export class Rechner {
  private worker: Worker | null = null;
  private ersatz: Rechendienst | null = null;
  private nummer = 0;

  constructor(private readonly rueckmeldung: Rueckmeldung) {
    try {
      this.worker = new Worker(new URL('../worker/pipeline.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<Antwort>) => this.rueckmeldung(e.data);
      this.worker.onerror = (e) =>
        this.rueckmeldung({ art: 'fehler', nummer: this.nummer, text: e.message || 'Fehler im Rechen-Worker' });
    } catch {
      this.ersatz = new Rechendienst();
    }
  }

  /** Gibt die Nummer des Auftrags zurück; nur die Antwort auf den neuesten zählt. */
  rechne(einstellungen: Einstellungen, bild?: Farbbild): number {
    const auftrag: Auftrag = { art: 'rechne', nummer: ++this.nummer, einstellungen, bild };
    if (this.worker) this.worker.postMessage(auftrag);
    else {
      const ersatz = this.ersatz!;
      setTimeout(() => this.rueckmeldung(ersatz.bearbeite(auftrag)), 0);
    }
    return this.nummer;
  }
}

/** Fügt einen Teil aus dem Worker in das bisherige Ergebnis ein. */
export function fuegeEin(bisher: Partial<Ergebnis> | null, teil: Partial<Ergebnis>, bild: Farbbild): Partial<Ergebnis> {
  return { ...(bisher ?? {}), ...teil, bild };
}
