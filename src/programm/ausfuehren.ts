/** Startet ein Programm im Programm-Worker – mit Zeitlimit gegen Endlosschleifen. */
import type { Programmergebnis } from './zeichnen';

export type Lauf = (Programmergebnis & { ms: number }) | { zeitlimit: true; ms: number };

export function starteProgramm(code: string, zeitlimitMs = 2000): Promise<Lauf> {
  return new Promise((fertig) => {
    // Für jeden Lauf ein frischer Worker: Kein Programm sieht Reste des vorigen.
    const worker = new Worker(new URL('./programm.worker.ts', import.meta.url), { type: 'module' });
    const start = performance.now();
    const ms = () => Math.round(performance.now() - start);
    const uhr = setTimeout(() => {
      worker.terminate();
      fertig({ zeitlimit: true, ms: zeitlimitMs });
    }, zeitlimitMs);
    worker.onmessage = (e: MessageEvent<Programmergebnis>) => {
      clearTimeout(uhr);
      worker.terminate();
      fertig({ ...e.data, ms: ms() });
    };
    worker.onerror = (e) => {
      clearTimeout(uhr);
      worker.terminate();
      fertig({ svg: '', ausgaben: [], formen: 0, fehler: { text: e.message || 'Fehler im Programm' }, ms: ms() });
    };
    worker.postMessage({ code });
  });
}
