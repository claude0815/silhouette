/// <reference lib="webworker" />
/** Einstieg des Web Workers: verbindet den Rechendienst mit den Nachrichten der Seite. */
import { verbinde, type Antwort, type Auftrag } from './dienst';

declare const self: DedicatedWorkerGlobalScope;

verbinde(
  (f) => (self.onmessage = (e: MessageEvent<Auftrag>) => f(e.data)),
  (a: Antwort) => self.postMessage(a),
);
