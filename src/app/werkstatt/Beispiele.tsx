/** Beispiele und Mini-Aufgaben als Karten. Gelöste Aufgaben werden live abgehakt. */
import { signal } from '@preact/signals';
import { beispielTexte as tx } from '../../i18n/beispiele.de';
import { beispiele } from '../../werkstatt/beispiele';
import { dokument, oeffneSvgText } from '../dokument';
import { auswahl, dok } from './zustand';

const aktiv = signal<string | null>(null);

function lade(svg: string, name: string, frage: string, id: string) {
  // Nur nachfragen, wenn eine eigene Fassung überschrieben würde, die kein unverändertes Beispiel ist
  const d = dokument.value;
  const unveraendert = beispiele.some((b) => b.svg === d.text);
  if (d.quelle === 'eigen' && !unveraendert && !confirm(frage)) return;
  oeffneSvgText(svg, name);
  auswahl.value = null;
  aktiv.value = id;
}

export function Beispiele() {
  const d = dok.value;
  return (
    <div class="beispiele" data-testid="beispiele">
      <p class="klein">{tx.einleitung}</p>
      {beispiele.map((b) => {
        const istAktiv = aktiv.value === b.id;
        return (
          <article class={`beispielkarte ${istAktiv ? 'aktiv' : ''}`} data-testid={`beispiel-${b.id}`}>
            <header>
              <strong>{b.titel}</strong>
              <button onClick={() => lade(b.svg, `${b.id}.svg`, tx.ladenFrage, b.id)}>{istAktiv ? tx.aktiv : tx.laden}</button>
            </header>
            <p class="klein">{b.kurz}</p>
            {istAktiv && (
              <ol class="aufgaben">
                {b.aufgaben.map((a) => {
                  const geloest = a.pruefe?.(d) ?? false;
                  return (
                    <li class={geloest ? 'geloest' : ''} data-testid={`aufgabe-${b.id}-${a.id}`}>
                      <span class="haken" aria-label={geloest ? tx.geschafft : tx.offen}>
                        {geloest ? '✓' : '○'}
                      </span>
                      <div>
                        <p>{a.text}</p>
                        {geloest && <p class="geschafft">{tx.geschafft}</p>}
                        {a.tipp && (
                          <details>
                            <summary>{tx.tipp}</summary>
                            <p>{a.tipp}</p>
                            {a.loesung && (
                              <button onClick={() => lade(a.loesung!, `${b.id}-loesung.svg`, tx.loesungFrage, b.id)}>{tx.loesung}</button>
                            )}
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </article>
        );
      })}
    </div>
  );
}
