/**
 * Seite „Über und Lizenzen“: Pflicht aus der GPL (Quellcode verlinken, Lizenzen nennen).
 * Lizenztexte werden beim Bauen aus den Originaldateien eingebunden (Vite: „?raw“),
 * damit sie nie von den ausgelieferten Bibliotheken abweichen.
 */
import gpl from '../../LICENSE?raw';
import preactLizenz from '../../node_modules/preact/LICENSE?raw';
import signalsLizenz from '../../node_modules/@preact/signals/LICENSE?raw';
import signalsCoreLizenz from '../../node_modules/@preact/signals-core/LICENSE?raw';
import preactPaket from '../../node_modules/preact/package.json';
import signalsPaket from '../../node_modules/@preact/signals/package.json';
import signalsCorePaket from '../../node_modules/@preact/signals-core/package.json';
import { t } from '../i18n/de';

const tx = t.ueber;
const QUELLCODE = 'https://github.com/claude0815/silhouette';

const bibliotheken = [
  { name: 'Preact', paket: preactPaket, url: 'https://github.com/preactjs/preact', text: preactLizenz },
  { name: '@preact/signals', paket: signalsPaket, url: 'https://github.com/preactjs/signals', text: signalsLizenz },
  { name: '@preact/signals-core', paket: signalsCorePaket, url: 'https://github.com/preactjs/signals', text: signalsCoreLizenz },
];

export function Ueber(props: { zurueck: () => void }) {
  return (
    <div class="ueber" data-testid="ueber">
      <p>
        <button onClick={props.zurueck}>{tx.zurueck}</button>
      </p>
      <h2>{tx.titel}</h2>
      {tx.absaetze.map((a) => (
        <p>{a}</p>
      ))}

      <h3>{tx.lizenzTitel}</h3>
      <p>{tx.lizenzText}</p>
      <p>
        {tx.quellcode}: <a href={QUELLCODE}>{QUELLCODE}</a>
      </p>
      <details>
        <summary>{tx.gplVolltext}</summary>
        <pre class="lizenztext">{gpl}</pre>
      </details>

      <h3>{tx.fremdTitel}</h3>
      <p class="klein">{tx.fremdHinweis}</p>
      <table class="bibliotheken" data-testid="bibliotheken">
        <tbody>
          {bibliotheken.map((b) => (
            <tr>
              <td>
                <a href={b.url}>{b.name}</a> {b.paket.version}
              </td>
              <td>{b.paket.license}</td>
              <td>
                <details>
                  <summary>{tx.lizenztext}</summary>
                  <pre class="lizenztext">{b.text}</pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{tx.uebernommenTitel}</h3>
      <p>
        {tx.uebernommenText} <a href="https://github.com/fablabnbg/inkscape-silhouette">inkscape-silhouette</a>
      </p>
      <p class="klein">{tx.uebernommenCopyright}</p>

      <h3>{tx.algorithmenTitel}</h3>
      <p>{tx.algorithmenText}</p>
    </div>
  );
}
