import { t } from '../i18n/de';
import { Ablage, Schritt1, Schritt2, Schritt3, Schritt4 } from './schritte/RasterSchritte';
import { Schritt9 } from './schritte/SimulationSchritt';
import { Schritt5, Schritt6, Schritt7, Schritt8 } from './schritte/VektorSchritte';
import { ergebnis, fehler, geladen, rechnet, schritt } from './zustand';

const tx = t.app;
const ANSICHTEN = [Schritt1, Schritt2, Schritt3, Schritt4, Schritt5, Schritt6, Schritt7, Schritt8, Schritt9];

function Schrittleiste() {
  const zeiten = ergebnis.value?.zeiten ?? {};
  return (
    <nav class="schrittleiste" aria-label="Schritte">
      {tx.schritte.map((name, i) => {
        const n = i + 1;
        const zeit = zeiten[n];
        return (
          <button
            class={`schritt-knopf ${schritt.value === n ? 'aktiv' : ''}`}
            aria-current={schritt.value === n ? 'step' : undefined}
            disabled={!geladen.value}
            onClick={() => (schritt.value = n)}
          >
            <span class="nummer">{n}</span>
            <span class="name">{name}</span>
            {zeit !== undefined && <span class="zeit">{tx.rechenzeit(zeit)}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function Start() {
  return (
    <div class="startseite">
      <p class="einleitung">{tx.untertitel}.</p>
      <Ablage />
    </div>
  );
}

export function App() {
  const Ansicht = ANSICHTEN[schritt.value - 1]!;
  return (
    <div class="app">
      <header class="kopf">
        <h1>{tx.titel}</h1>
        <Schrittleiste />
        <div class="status" aria-live="polite">
          {rechnet.value && <span class="rechnet">{tx.rechnet}</span>}
        </div>
      </header>
      {fehler.value && (
        <p class="fehlermeldung" role="alert">
          {tx.fehler}: {fehler.value}
        </p>
      )}
      <main class="inhalt">{geladen.value ? <Ansicht /> : <Start />}</main>
      <footer class="fuss klein">
        <a href="./cutter-test.html">{tx.cutterTest}</a> · <a href="https://github.com/claude0815/silhouette">{tx.quellcode}</a> ·{' '}
        {tx.lizenz}
      </footer>
    </div>
  );
}
