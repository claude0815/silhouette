/// <reference lib="webworker" />
/**
 * Worker für „SVG per Programm“. Das Programm läuft hier, getrennt von der Seite:
 * Eine Endlosschleife friert nicht die Oberfläche ein, und die Seite kann den Worker
 * nach dem Zeitlimit einfach beenden. Netzwerkfunktionen werden abgeschaltet – für
 * Zeichenprogramme braucht man sie nicht.
 */
import { fuehreAus } from './zeichnen';

declare const self: DedicatedWorkerGlobalScope;
const senden = self.postMessage.bind(self);

for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches']) {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
  } catch {
    // nicht abschaltbar: dann bleibt es eben
  }
}

self.onmessage = (e: MessageEvent<{ code: string }>) => senden(fuehreAus(e.data.code));
