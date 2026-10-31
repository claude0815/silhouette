import { t } from '../i18n/de';
import { Ablage, Schritt1, Schritt2, Schritt3, Schritt4 } from './schritte/RasterSchritte';
import { Simulation } from './schritte/SimulationSchritt';
import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { Schritt5, Schritt6, Schritt7, Schritt8 } from './schritte/VektorSchritte';
import { signal } from '@preact/signals';
import { Ueber } from './Ueber';
import { bereich, ergebnis, fehler, geladen, rechnet, schritt } from './zustand';

/** Zeigt statt der Schritte die Seite „Über und Lizenzen“ */
const zeigeUeber = signal(typeof location !== 'undefined' && location.hash === '#ueber');

const tx = t.app;
const ANSICHTEN = [Schritt1, Schritt2, Schritt3, Schritt4, Schritt5, Schritt6, Schritt7, Schritt8];

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
            onClick={() => {
              schritt.value = n;
              zeigeUeber.value = false;
            }}
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

function Bereichsleiste() {
  return (
    <nav class="bereichsleiste" aria-label="Bereiche">
      {(['nachzeichnen', 'werkstatt', 'simulation'] as const).map((b) => (
        <button
          class={`bereich-knopf ${bereich.value === b && !zeigeUeber.value ? 'aktiv' : ''}`}
          onClick={() => {
            bereich.value = b;
            zeigeUeber.value = false;
          }}
        >
          {tx.bereiche[b]}
        </button>
      ))}
    </nav>
  );
}

/**
 * Die Werkstatt (mit dem Code-Editor) wird erst geladen, wenn man sie öffnet.
 * So bleibt der erste Aufruf der App klein.
 */
function WerkstattLaden() {
  const [Werkstatt, setWerkstatt] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import('./werkstatt/Werkstatt').then((m) => setWerkstatt(() => m.Werkstatt));
  }, []);
  return Werkstatt ? <Werkstatt /> : <p class="laden">{tx.rechnet}</p>;
}

function Inhalt() {
  if (zeigeUeber.value) return <Ueber zurueck={() => (zeigeUeber.value = false)} />;
  if (bereich.value === 'werkstatt') return <WerkstattLaden />;
  if (bereich.value === 'simulation') return <Simulation />;
  const Ansicht = ANSICHTEN[schritt.value - 1]!;
  return geladen.value ? <Ansicht /> : <Start />;
}

export function App() {
  return (
    <div class="app">
      <header class="kopf">
        <h1>{tx.titel}</h1>
        <Bereichsleiste />
        {bereich.value === 'nachzeichnen' && <Schrittleiste />}
        <div class="status" aria-live="polite">
          {rechnet.value && <span class="rechnet">{tx.rechnet}</span>}
        </div>
      </header>
      {fehler.value && (
        <p class="fehlermeldung" role="alert">
          {tx.fehler}: {fehler.value}
        </p>
      )}
      <main class="inhalt">
        <Inhalt />
      </main>
      <footer class="fuss klein">
        <a href="./cutter-test.html">{tx.cutterTest}</a> · <a href="https://github.com/claude0815/silhouette">{tx.quellcode}</a> ·{' '}
        {tx.lizenz} ·{' '}
        <a
          href="#ueber"
          onClick={(e) => {
            e.preventDefault();
            zeigeUeber.value = true;
          }}
        >
          {tx.ueber}
        </a>
      </footer>
    </div>
  );
}
