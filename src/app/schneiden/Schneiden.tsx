/**
 * Bereich „Schneiden“: das zentrale SVG-Dokument an einen echten Cutter senden.
 * Dieselben Befehle wie in der Simulation, über USB, Bluetooth oder ein simuliertes Gerät.
 */
import { useMemo, useState } from 'preact/hooks';
import { pruefe } from '../../checks/cutter-checks';
import { matten, profile, schneidebereichMm } from '../../cutter/profile';
import type { MattenId } from '../../cutter/types';
import { GRENZEN } from '../../cutter/voreinstellungen';
import { formatiereDauer, formatiereLaenge, t } from '../../i18n/de';
import { befehleZuFahrten, kennzahlen, zeitannahmen } from '../../simulation/fahrten';
import { REIHENFOLGEN, type Reihenfolge } from '../../simulation/reihenfolge';
import { leseSvg } from '../../svg/dokument';
import { erkenneBetriebssystem, protokollAlsText, protokollZeile } from '../../cutter-test/bericht';
import { pruefeUmgebung } from '../../cutter-test/umgebung';
import { dokument } from '../dokument';
import { Erklaerung, Kasten, Regler, Schalter } from '../schritte/Bausteine';
import { bereich } from '../zustand';
import * as v from './verbindung';

const tx = t.app.schneiden;
const ZOLL = 25.4;

const betriebssystem = erkenneBetriebssystem(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '',
);

/** Matte von oben: Raster in Zoll wie auf den Silhouette-Matten, Schneidebereich, Pfade */
function Mattenvorschau() {
  const p = v.profil.value;
  const bereichMm = schneidebereichMm(p, v.matte.value);
  const m = matten[v.matte.value];
  const mattenBreite = m.breiteZoll ? m.breiteZoll * ZOLL : bereichMm.breite;
  const pfade = v.pfade.value;
  const maxY = Math.max(0, ...pfade.flat().map((q) => q.y));
  // Ohne Matte: nur bis knapp hinter das Motiv zeigen, sonst die ganze Matte
  const hoehe = m.hoeheZoll ? m.hoeheZoll * ZOLL : Math.min(bereichMm.hoehe, Math.max(100, maxY + 30));
  const ausserhalb = (q: { x: number; y: number }) => q.x < 0 || q.y < 0 || q.x > bereichMm.breite || q.y > bereichMm.hoehe;
  const linien = [];
  for (let x = 0; x <= mattenBreite + 0.01; x += ZOLL) linien.push(<line x1={x} x2={x} y1={0} y2={hoehe} class="matte-raster" />);
  for (let y = 0; y <= hoehe + 0.01; y += ZOLL) linien.push(<line y1={y} y2={y} x1={0} x2={mattenBreite} class="matte-raster" />);
  return (
    <div class="matten-flaeche" data-testid="mattenvorschau">
      <svg viewBox={`-12 -22 ${mattenBreite + 24} ${hoehe + 34}`}>
        <defs>
          <marker id="einzug-pfeil" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L10 5L0 10z" class="einzug-spitze" />
          </marker>
        </defs>
        <rect x={0} y={0} width={mattenBreite} height={hoehe} class="matte" />
        {linien}
        <rect x={0} y={0} width={Math.min(bereichMm.breite, mattenBreite)} height={Math.min(bereichMm.hoehe, hoehe)} class="schneidebereich" />
        <line x1={mattenBreite / 2} x2={mattenBreite / 2} y1={-4} y2={-16} class="einzug" marker-end="url(#einzug-pfeil)" />
        <text x={mattenBreite / 2 + 6} y={-8} class="einzug-text">
          {tx.einzug}
        </text>
        {pfade.map((pfad) => (
          <polyline
            points={pfad.map((q) => `${q.x},${q.y}`).join(' ')}
            class={pfad.some(ausserhalb) ? 'matte-pfad draussen' : 'matte-pfad'}
          />
        ))}
        {pfade.map((pfad) => pfad[0] && <circle cx={pfad[0].x} cy={pfad[0].y} r={1.2} class="matte-start" />)}
        <circle cx={0} cy={0} r={2} class="ursprung-punkt" />
      </svg>
    </div>
  );
}

/** Während eines Auftrags zeigt die Anzeige „arbeitet“, sonst den zuletzt abgefragten Status */
const anzeigeStatus = () => (v.sendet.value ? 'arbeitet' : (v.status.value?.status ?? 'unbekannt'));

function Statusanzeige() {
  const c = v.cutter.value;
  const s = anzeigeStatus();
  return (
    <div class={`geraet-status ${s === 'arbeitet' ? 'in-bewegung' : s}`} data-testid="geraet-status">
      <strong>{c ? c.name : tx.nichtVerbunden}</strong>
      {c && <span>{tx.statusTexte[s]}</span>}
      {c?.firmware && <span class="klein">{c.firmware}</span>}
    </div>
  );
}

/** Kurze Anzeige in der Kopfzeile, damit man im Raum sofort sieht, welches Gerät verbunden ist */
export function Kopfzeilenstatus() {
  const c = v.cutter.value;
  if (!c) return null;
  return (
    <button class={`kopf-status ${anzeigeStatus() === 'arbeitet' ? 'in-bewegung' : anzeigeStatus()}`} onClick={() => (bereich.value = 'schneiden')} data-testid="kopf-status">
      ● {tx.kopfzeile(c.name, tx.statusTexte[anzeigeStatus()]!)}
    </button>
  );
}

function Meldungsfeld() {
  const m = v.meldung.value;
  if (!m) return null;
  return (
    <div class={`meldung ${m.art}`} role={m.art === 'fehler' ? 'alert' : 'status'} data-testid="schneiden-meldung">
      <strong>{m.text}</strong>
      {m.tipp && (
        <p>
          {tx.fehlerTipp}: {m.tipp}
        </p>
      )}
      {m.technisch && (
        <p class="klein">
          {tx.fehlerTechnisch}: <code>{m.technisch}</code>
        </p>
      )}
    </div>
  );
}

export function Schneiden() {
  const u = pruefeUmgebung(globalThis);
  const c = v.cutter.value;
  const sendet = v.sendet.value;
  const w = v.werkzeug.value;
  const p = v.profil.value;
  const voreinstellung = v.alleVoreinstellungen.value.find((x) => x.id === v.voreinstellungId.value);
  const b = v.befehle.value;
  const [kopiert, setKopiert] = useState(false);

  const kz = useMemo(() => ('befehle' in b ? kennzahlen(befehleZuFahrten(b.befehle), zeitannahmen(w.geschwindigkeit)) : null), [b, w.geschwindigkeit]);
  const warnungen = useMemo(() => {
    const dok = leseSvg(dokument.value.text);
    return pruefe(dok, { bereich: schneidebereichMm(p, v.matte.value) }).filter((x) => x.stufe === 'warnung').length;
  }, [dokument.value.text, p, v.matte.value]);

  return (
    <div class="schneiden" data-testid="schneiden">
      <div class="schneiden-haupt">
        <Mattenvorschau />
      </div>
      <aside class="seite">
        <Kasten titel={tx.verbindung}>
          <Statusanzeige />
          <div class="knoepfe">
            <button onClick={v.verbindeUsb} disabled={!u.webUsb || v.verbindet.value || !!sendet}>
              {tx.perUsb}
            </button>
            <button onClick={v.verbindeBluetooth} disabled={!u.webBluetooth || v.verbindet.value || !!sendet}>
              {tx.perBluetooth}
            </button>
            <button onClick={v.verbindeSimulation} disabled={v.verbindet.value || !!sendet}>
              {tx.simulation}
            </button>
          </div>
          <Schalter label={tx.alleBluetooth} wert={v.alleBluetooth.value} onChange={(x) => (v.alleBluetooth.value = x)} />
          {v.verbindet.value && <p>{tx.verbindet}</p>}
          {c && (
            <div class="knoepfe">
              <button onClick={v.frageStatus} disabled={!!sendet}>
                {tx.statusAbfragen}
              </button>
              <button onClick={v.testfahrt} disabled={!!sendet} title={tx.testfahrtErklaerung}>
                {tx.testfahrt}
              </button>
              <button onClick={v.trenne} disabled={!!sendet}>
                {tx.trennen}
              </button>
            </div>
          )}
          {(!u.webUsb || !u.webBluetooth) && <p class="hinweis">{tx.hinweisBrowser}</p>}
          {betriebssystem === 'Windows' && <p class="hinweis">{tx.hinweisWindows}</p>}
          <p class="klein">{tx.hinweisStudio}</p>
        </Kasten>

        <Kasten titel={tx.material}>
          <label class="regler">
            <span>{tx.voreinstellung}</span>
            <select value={v.voreinstellungId.value} onChange={(e) => v.waehleVoreinstellung(e.currentTarget.value)} data-testid="voreinstellung">
              {v.alleVoreinstellungen.value.map((x) => (
                <option value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          {voreinstellung && (
            <p class={voreinstellung.geprueft ? 'klein' : 'hinweis warnung'}>
              {voreinstellung.geprueft ? tx.geprueft : tx.schaetzwert}{' '}
              <span class="klein">
                ({tx.quelle}: {voreinstellung.quelle})
              </span>
            </p>
          )}
          {voreinstellung?.hinweis && <p class="klein">{voreinstellung.hinweis}</p>}
          <label class="regler">
            <span>{tx.werkzeug}</span>
            <select value={w.art} onChange={(e) => v.aendereWerkzeug({ art: e.currentTarget.value as 'stift' | 'messer' })} data-testid="werkzeug">
              <option value="stift">{tx.stift}</option>
              <option value="messer">{tx.messer}</option>
            </select>
          </label>
          {w.art === 'messer' && <p class="hinweis warnung">{tx.hinweisStift}</p>}
          <Regler label={tx.druck} wert={w.druck} min={GRENZEN.druck.min} max={Math.min(GRENZEN.druck.max, p.maxDruck)} onChange={(n) => v.aendereWerkzeug({ druck: n })} />
          <Regler
            label={tx.geschwindigkeit}
            wert={w.geschwindigkeit}
            min={GRENZEN.geschwindigkeit.min}
            max={GRENZEN.geschwindigkeit.max}
            onChange={(n) => v.aendereWerkzeug({ geschwindigkeit: n })}
          />
          {w.art === 'messer' && (
            <>
              <Regler
                label={tx.klingenVersatz}
                wert={w.klingenVersatzMm ?? 0.9}
                min={GRENZEN.klingenVersatzMm.min}
                max={GRENZEN.klingenVersatzMm.max}
                schritt={0.05}
                onChange={(n) => v.aendereWerkzeug({ klingenVersatzMm: n })}
              />
              <Schalter label={tx.tiefeSenden} wert={v.tiefeSenden.value} onChange={(x) => (v.tiefeSenden.value = x)} />
              {v.tiefeSenden.value && <Regler label={tx.tiefe} wert={v.tiefe.value} min={1} max={10} onChange={(n) => (v.tiefe.value = n)} />}
            </>
          )}
          <label class="regler">
            <span>{tx.halter}</span>
            <select value={v.halter.value} onChange={(e) => (v.halter.value = Number(e.currentTarget.value) as 1 | 2)}>
              <option value={1}>1</option>
              <option value={2} disabled={!p.zweiHalter}>
                2
              </option>
            </select>
          </label>
          <div class="knoepfe">
            <button
              onClick={() => {
                const name = prompt(tx.speichernName);
                if (name) {
                  const fehler = v.speichereVoreinstellung(name);
                  if (fehler.length) alert(fehler.join('\n'));
                }
              }}
            >
              {tx.speichernAls}
            </button>
            {v.eigeneVoreinstellungen.value.some((x) => x.id === v.voreinstellungId.value) && (
              <button onClick={() => v.loescheVoreinstellung(v.voreinstellungId.value)}>{tx.loeschen}</button>
            )}
          </div>
        </Kasten>

        <Kasten titel={tx.mattenvorschau}>
          {!c && (
            <label class="regler">
              <span>{tx.vorschauGeraet}</span>
              <select value={v.vorschauProfilId.value} onChange={(e) => (v.vorschauProfilId.value = e.currentTarget.value)}>
                {profile.map((x) => (
                  <option value={x.id}>{x.name}</option>
                ))}
              </select>
            </label>
          )}
          <label class="regler">
            <span>{tx.matte}</span>
            <select value={v.matte.value} onChange={(e) => (v.matte.value = e.currentTarget.value as MattenId)}>
              {Object.entries(matten).map(([id, m]) => (
                <option value={id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label class="regler">
            <span>{tx.reihenfolge}</span>
            <select value={v.reihenfolge.value} onChange={(e) => (v.reihenfolge.value = e.currentTarget.value as Reihenfolge)}>
              {REIHENFOLGEN.map((r) => (
                <option value={r}>{t.app.simulation.reihenfolgen[r]}</option>
              ))}
            </select>
          </label>
          {kz && (
            <p data-testid="schneiden-kennzahlen">{tx.kennzahlen(kz.pfade, formatiereLaenge(kz.schnittMm), formatiereDauer(kz.dauerS))}</p>
          )}
          {'fehler' in b && <p class="hinweis warnung" data-testid="auftrag-fehler">{b.fehler}</p>}
          {warnungen > 0 && (
            <p class="hinweis warnung">
              {tx.hinweisWarnungen(warnungen)}{' '}
              <button class="verweis" onClick={() => (bereich.value = 'werkstatt')}>
                {tx.zuDenChecks}
              </button>
            </p>
          )}
          <button class="verweis" onClick={() => (bereich.value = 'werkstatt')}>
            {tx.imDokumentAendern}
          </button>
        </Kasten>

        <Kasten>
          <div class="sende-knoepfe">
            <button class="schneiden-knopf" onClick={() => v.schneide()} disabled={!c || !!sendet || 'fehler' in b} data-testid="schneiden-knopf">
              {w.art === 'stift' ? tx.zeichnen : tx.schneiden}
            </button>
            <button class="abbrechen" onClick={v.brichAb} disabled={!sendet} data-testid="abbrechen-knopf">
              {tx.abbrechen}
            </button>
          </div>
          {sendet && (
            <p>
              <progress value={v.fortschritt.value} max={1} /> {tx.sendetAuftrag(Math.round(v.fortschritt.value * 100))}
            </p>
          )}
          <Meldungsfeld />
          {c && (
            <button onClick={v.setzeZurueck} title={tx.zuruecksetzenErklaerung}>
              {tx.zuruecksetzen}
            </button>
          )}
        </Kasten>

        <details class="erklaerung">
          <summary>{tx.protokoll}</summary>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(protokollAlsText(v.protokoll.value));
              setKopiert(true);
              setTimeout(() => setKopiert(false), 1500);
            }}
          >
            {kopiert ? t.app.svg.kopiert : tx.kopieren}
          </button>
          <pre class="protokoll">
            {v.protokoll.value.slice(-200).map((e) => (
              <div class={`eintrag ${e.richtung}`}>{protokollZeile(e)}</div>
            ))}
          </pre>
        </details>
        <Erklaerung absaetze={tx.erklaerung} />
      </aside>
    </div>
  );
}
