/**
 * Schritt 9: Schnitt-Simulation. Liest das SVG-Dokument, ordnet die Pfade, übersetzt sie
 * mit derselben reinen Funktion wie für den echten Cutter in GPGL-Befehle und spielt
 * diese Befehle ab.
 */
import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { auftragZuBefehlen } from '../../cutter/gpgl';
import { matten, profile, schneidebereichMm } from '../../cutter/profile';
import type { CutJob, MattenId, Punkt, WerkzeugArt } from '../../cutter/types';
import { formatiereDauer, formatiereLaenge, t } from '../../i18n/de';
import { befehleZuFahrten, kennzahlen, zeitannahmen, zeitplan, zustandZurZeit, type Fahrt } from '../../simulation/fahrten';
import { aussenZuFrueh, ordne, REIHENFOLGEN, type Reihenfolge } from '../../simulation/reihenfolge';
import { leseSvg, svgZuPolylinien } from '../../svg/dokument';
import { ergebnis } from '../zustand';
import { Erklaerung, Kasten, Regler, Schrittansicht, vieleckD } from './Bausteine';

const tx = t.app.simulation;

const reihenfolge = signal<Reihenfolge>('innen-vor-aussen');
const profilId = signal(profile[0]!.id);
const matte = signal<MattenId>('cameo-12x12');
const werkzeug = signal<WerkzeugArt>('stift');
const geschwindigkeit = signal(10);
const druck = signal(10);
const zeitraffer = signal(5);
const laeuft = signal(false);
const zeit = signal(0);

interface Plan {
  befehle: string[];
  fahrten: Fahrt[];
  zeiten: number[];
  fehler?: string;
}

function plane(pfade: Punkt[][], art: Reihenfolge, job: Omit<CutJob, 'pfade'>, profilIndex: number): Plan {
  const geordnet = ordne(pfade, art).map((g) => g.pfad);
  try {
    const befehle = auftragZuBefehlen({ ...job, pfade: geordnet }, profile[profilIndex]!);
    const fahrten = befehleZuFahrten(befehle);
    return { befehle, fahrten, zeiten: zeitplan(fahrten, zeitannahmen(job.werkzeug.geschwindigkeit)) };
  } catch (e) {
    return { befehle: [], fahrten: [], zeiten: [0], fehler: e instanceof Error ? e.message : String(e) };
  }
}

/** Pfaddaten für eine Reihe von Fahrten (nur Endpunkte, verbunden). */
function fahrtenD(fahrten: readonly Fahrt[], art: Fahrt['art']): string {
  let d = '';
  for (const f of fahrten) if (f.art === art) d += `M${f.von.x} ${f.von.y}L${f.nach.x} ${f.nach.y}`;
  return d;
}

export function Schritt9() {
  const text = ergebnis.value?.svg?.text ?? '';
  const pfade = useMemo(() => svgZuPolylinien(leseSvg(text)) as Punkt[][], [text]);
  const profilIndex = Math.max(0, profile.findIndex((p) => p.id === profilId.value));
  const profil = profile[profilIndex]!;
  const jobOhnePfade: Omit<CutJob, 'pfade'> = {
    matte: matte.value,
    werkzeug: { art: werkzeug.value, druck: druck.value, geschwindigkeit: geschwindigkeit.value, halter: 1 },
  };
  const schluessel = JSON.stringify(jobOhnePfade) + profilIndex;
  const plaene = useMemo(
    () => Object.fromEntries(REIHENFOLGEN.map((art) => [art, plane(pfade, art, jobOhnePfade, profilIndex)])) as Record<Reihenfolge, Plan>,
    [pfade, schluessel],
  );
  const plan = plaene[reihenfolge.value];
  const gesamt = plan.zeiten.at(-1) ?? 0;
  const z = zeitannahmen(geschwindigkeit.value);
  const k = kennzahlen(plan.fahrten, z);
  const warnungen = useMemo(() => aussenZuFrueh(ordne(pfade, reihenfolge.value)).length, [pfade, reihenfolge.value]);
  const bereich = schneidebereichMm(profil, matte.value);
  // Sichtbar: vom Ursprung (dort startet das Messer) bis knapp hinter das Motiv, höchstens die Matte
  const sichtBreite = Math.min(bereich.breite, Math.max(60, ...pfade.flat().map((p) => p.x)) + 15);
  const sichtHoehe = Math.min(bereich.hoehe, Math.max(40, ...pfade.flat().map((p) => p.y)) + 15);

  // Neuer Plan → von vorn
  useEffect(() => {
    zeit.value = 0;
    laeuft.value = false;
  }, [plan]);

  // Animation: pro Bildschirmbild die Zeit weiterzählen
  useEffect(() => {
    if (!laeuft.value) return;
    let letzte = performance.now();
    let id = requestAnimationFrame(function tick(jetzt) {
      const neu = zeit.value + ((jetzt - letzte) / 1000) * zeitraffer.value;
      letzte = jetzt;
      if (neu >= gesamt) {
        zeit.value = gesamt;
        laeuft.value = false;
        return;
      }
      zeit.value = neu;
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [laeuft.value, gesamt]);

  const zustand = zustandZurZeit(plan.fahrten, plan.zeiten, zeit.value);
  const fertig = plan.fahrten.slice(0, Math.max(0, zustand.index));
  const laufend = plan.fahrten[zustand.index];
  const aktuellerBefehl = laufend?.befehl ?? -1;

  // Start und Richtung je Pfad: erster Schnitt jedes Pfads
  const starts = useMemo(() => {
    const s: Fahrt[] = [];
    let letzter = -1;
    for (const f of plan.fahrten) if (f.art === 'schnitt' && f.pfad !== letzter) {
      s.push(f);
      letzter = f.pfad;
    }
    return s;
  }, [plan]);

  return (
    <Schrittansicht
      haupt={
        <div class="sim-teilung">
          <div class="sim-flaeche" data-testid="sim-flaeche">
            {!text ? (
              <p>{tx.keinSvg}</p>
            ) : (
              <svg viewBox={`-5 -5 ${sichtBreite + 10} ${sichtHoehe + 10}`}>
                <defs>
                  <marker id="sim-pfeil" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0 0L10 5L0 10z" class="sim-pfeil" />
                  </marker>
                </defs>
                <rect width={sichtBreite} height={sichtHoehe} class="sim-matte" />
                {Array.from({ length: Math.floor(sichtBreite / 10) + 1 }, (_, i) => (
                  <line x1={i * 10} x2={i * 10} y1={0} y2={sichtHoehe} class="raster-linie" />
                ))}
                {Array.from({ length: Math.floor(sichtHoehe / 10) + 1 }, (_, i) => (
                  <line y1={i * 10} y2={i * 10} x1={0} x2={sichtBreite} class="raster-linie" />
                ))}
                <path d={pfade.map((p) => vieleckD(p, false)).join('')} class="sim-vorlage" />
                <path d={fahrtenD(fertig, 'leer')} class="sim-leer" />
                <path d={fahrtenD(fertig, 'schnitt')} class="sim-schnitt" />
                {laufend && (
                  <line
                    x1={laufend.von.x}
                    y1={laufend.von.y}
                    x2={zustand.position.x}
                    y2={zustand.position.y}
                    class={laufend.art === 'schnitt' ? 'sim-schnitt' : 'sim-leer'}
                  />
                )}
                {starts.map((f) => {
                  const dx = f.nach.x - f.von.x;
                  const dy = f.nach.y - f.von.y;
                  const l = Math.hypot(dx, dy) || 1;
                  const lang = Math.min(4, l);
                  return (
                    <g>
                      <circle cx={f.von.x} cy={f.von.y} r={0.9} class="sim-start" />
                      <line
                        x1={f.von.x}
                        y1={f.von.y}
                        x2={f.von.x + (dx / l) * lang}
                        y2={f.von.y + (dy / l) * lang}
                        class="sim-richtung"
                        marker-end="url(#sim-pfeil)"
                      />
                    </g>
                  );
                })}
                <circle cx={zustand.position.x} cy={zustand.position.y} r={1.6} class={`sim-messer ${laufend?.art ?? ''}`} />
              </svg>
            )}
          </div>
          <Befehlsliste befehle={plan.befehle} aktuell={aktuellerBefehl} />
        </div>
      }
      seite={
        <>
          <Kasten>
            <div class="knoepfe">
              <button onClick={() => {
                if (zeit.value >= gesamt) zeit.value = 0;
                laeuft.value = !laeuft.value;
              }} disabled={plan.fahrten.length === 0}>
                {laeuft.value ? tx.pause : tx.abspielen}
              </button>
              <button onClick={() => { zeit.value = 0; laeuft.value = false; }}>{tx.vonVorn}</button>
              <label class="schalter">
                {tx.zeitraffer}
                <select value={zeitraffer.value} onChange={(e) => (zeitraffer.value = Number(e.currentTarget.value))}>
                  {[1, 2, 5, 10, 20, 50].map((f) => <option value={f}>{f}×</option>)}
                </select>
              </label>
            </div>
            <input
              type="range"
              class="zeitleiste"
              min={0}
              max={gesamt}
              step={gesamt / 1000 || 1}
              value={zeit.value}
              aria-label={tx.zeitleiste}
              onInput={(e) => {
                laeuft.value = false;
                zeit.value = e.currentTarget.valueAsNumber;
              }}
            />
            <p class="klein" data-testid="sim-zeit">{tx.zeit(zeit.value, gesamt)}</p>
            <p class="legende">
              <span class="farbfeld aussen" /> {tx.legendeSchnitt} <span class="farbfeld leer" /> {tx.legendeLeer}{' '}
              <span class="farbfeld start" /> {tx.legendeStart}
            </p>
          </Kasten>
          {plan.fehler && <p class="fehlermeldung" role="alert">{plan.fehler}</p>}
          {warnungen > 0 && !plan.fehler && <p class="hinweis warnung" data-testid="sim-warnung">{tx.warnungAussen(warnungen)}</p>}
          <Kasten titel={tx.reihenfolge}>
            <table class="vergleich" data-testid="sim-vergleich">
              <thead>
                <tr>
                  <th />
                  <th>{tx.spalteSchnitt}</th>
                  <th>{tx.spalteLeer}</th>
                  <th>{tx.spalteDauer}</th>
                </tr>
              </thead>
              <tbody>
                {REIHENFOLGEN.map((art) => {
                  const kk = kennzahlen(plaene[art].fahrten, z);
                  const bestes = Math.min(...REIHENFOLGEN.map((a) => kennzahlen(plaene[a].fahrten, z).leerMm));
                  return (
                    <tr class={art === reihenfolge.value ? 'gewaehlt' : ''}>
                      <th>
                        <label class="schalter">
                          <input type="radio" name="reihenfolge" checked={art === reihenfolge.value} onChange={() => (reihenfolge.value = art)} />
                          {tx.reihenfolgen[art]}
                        </label>
                      </th>
                      <td>{formatiereLaenge(kk.schnittMm)}</td>
                      <td class={Math.abs(kk.leerMm - bestes) < 0.5 ? 'bestwert' : ''}>{formatiereLaenge(kk.leerMm)}</td>
                      <td>{formatiereDauer(kk.dauerS)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Kasten>
          <Kasten titel={tx.kennzahlen}>
            <dl class="kennzahlen" data-testid="sim-kennzahlen">
              <dt>{tx.pfade}</dt>
              <dd>{k.pfade}</dd>
              <dt>{tx.schnittlaenge}</dt>
              <dd>{formatiereLaenge(k.schnittMm)}</dd>
              <dt>{tx.leerfahrt}</dt>
              <dd>{formatiereLaenge(k.leerMm)}</dd>
              <dt>{tx.dauer}</dt>
              <dd>{formatiereDauer(k.dauerS)}</dd>
            </dl>
            <p class="klein">{tx.annahme}</p>
          </Kasten>
          <Kasten>
            <label class="regler">
              <span>{tx.geraet}</span>
              <select value={profilId.value} onChange={(e) => (profilId.value = e.currentTarget.value)}>
                {profile.map((p) => <option value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label class="regler">
              <span>{tx.matte}</span>
              <select value={matte.value} onChange={(e) => (matte.value = e.currentTarget.value as MattenId)}>
                {Object.entries(matten).map(([id, m]) => <option value={id}>{m.name}</option>)}
              </select>
            </label>
            <label class="regler">
              <span>{tx.werkzeug}</span>
              <select value={werkzeug.value} onChange={(e) => (werkzeug.value = e.currentTarget.value as WerkzeugArt)}>
                <option value="stift">{tx.stift}</option>
                <option value="messer">{tx.messer}</option>
              </select>
            </label>
            <Regler label={tx.geschwindigkeit} wert={geschwindigkeit.value} min={1} max={30} onChange={(n) => (geschwindigkeit.value = n)} />
            <Regler label={tx.druck} wert={druck.value} min={1} max={33} onChange={(n) => (druck.value = n)} />
          </Kasten>
          <Erklaerung absaetze={tx.erklaerung} />
        </>
      }
    />
  );
}

/** Zeigt ein Fenster der Befehlsliste um den aktuellen Befehl – so bleibt es auch bei tausenden Zeilen flüssig. */
function Befehlsliste(props: { befehle: string[]; aktuell: number }) {
  const fenster = 40;
  const mitte = props.aktuell < 0 ? 0 : props.aktuell;
  const von = Math.max(0, Math.min(mitte - fenster / 2, props.befehle.length - fenster));
  const zeilen = props.befehle.slice(von, von + fenster);
  const aktiv = useRef<HTMLDivElement>(null);
  useEffect(() => aktiv.current?.scrollIntoView({ block: 'nearest' }), [props.aktuell]);
  return (
    <div class="sim-befehle">
      <h3>
        {tx.befehle}
        {props.aktuell >= 0 && <span class="klein"> · {tx.befehlInfo(props.aktuell + 1, props.befehle.length)}</span>}
      </h3>
      <pre data-testid="sim-befehle">
        {zeilen.map((b, i) => {
          const n = von + i;
          return (
            <div ref={n === props.aktuell ? aktiv : undefined} class={`befehl ${n === props.aktuell ? 'aktuell' : ''} ${b[0] === 'D' ? 'd' : b[0] === 'M' ? 'm' : ''}`}>
              <span class="zeilennummer">{n + 1}</span> {b}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
