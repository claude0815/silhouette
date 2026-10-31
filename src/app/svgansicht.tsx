/** Bausteine für SVG-Ansichten, die Schritt 8 und die Werkstatt gemeinsam nutzen. */
import type { Punkt } from '../cutter/types';
import { t } from '../i18n/de';
import { svgZahl } from '../pipeline/svg-erzeugen';
import type { BefehlsGeometrie } from '../svg/pfad';

const tx = t.app;

export const pkt = (p: Punkt) => `(${svgZahl(p.x)} | ${svgZahl(p.y)})`;

export function befehlErklaerung(typ: string, g: BefehlsGeometrie | undefined): string {
  const b = tx.svg.befehl;
  if (!g) return b.sonst(typ);
  if (g.art === 'punkt') return b.M(pkt(g.p));
  // Z zeichnet eine Strecke zurück zum Anfang des aktuellen Teilpfads; dieser Anfang ist g.p.
  if (typ === 'Z' && g.art === 'strecke') return b.Z(pkt(g.von), pkt(g.p));
  if (typ === 'H' && g.art === 'strecke') return b.H(pkt(g.von), pkt(g.p));
  if (typ === 'V' && g.art === 'strecke') return b.V(pkt(g.von), pkt(g.p));
  if (g.art === 'strecke') return b.L(pkt(g.von), pkt(g.p));
  if (g.art === 'bogen') return b.A(pkt(g.von), pkt(g.p), g.stuecke.length);
  if (typ === 'S') return b.S(pkt(g.von), pkt(g.c1), pkt(g.c2), pkt(g.p));
  if (typ === 'Q' || typ === 'T') {
    // Der Q-Kontrollpunkt lässt sich aus der kubischen Form zurückrechnen: q = von + 3/2 · (c1 − von)
    const q = { x: g.von.x + 1.5 * (g.c1.x - g.von.x), y: g.von.y + 1.5 * (g.c1.y - g.von.y) };
    return b.Q(pkt(g.von), pkt(q), pkt(g.p));
  }
  return b.C(pkt(g.von), pkt(g.c1), pkt(g.c2), pkt(g.p));
}

/** Hebt hervor, was ein einzelner Befehl zeichnet; bei Kurven mit Kontrollpunkten. */
export function Befehlsmarkierung(props: { g: BefehlsGeometrie }) {
  const g = props.g;
  if (g.art === 'punkt') return <circle cx={g.p.x} cy={g.p.y} r={1.2} class="befehl-punkt" />;
  if (g.art === 'strecke') return <line x1={g.von.x} y1={g.von.y} x2={g.p.x} y2={g.p.y} class="befehl-linie" />;
  if (g.art === 'bogen') {
    const d = `M${g.von.x} ${g.von.y}` + g.stuecke.map((st) => `C${st.c1.x} ${st.c1.y} ${st.c2.x} ${st.c2.y} ${st.p.x} ${st.p.y}`).join('');
    return <path d={d} class="befehl-linie" />;
  }
  return (
    <g>
      <line x1={g.von.x} y1={g.von.y} x2={g.c1.x} y2={g.c1.y} class="befehl-hebel" />
      <line x1={g.p.x} y1={g.p.y} x2={g.c2.x} y2={g.c2.y} class="befehl-hebel" />
      <path d={`M${g.von.x} ${g.von.y}C${g.c1.x} ${g.c1.y} ${g.c2.x} ${g.c2.y} ${g.p.x} ${g.p.y}`} class="befehl-linie" />
      <circle cx={g.c1.x} cy={g.c1.y} r={0.7} class="befehl-kontrolle" />
      <circle cx={g.c2.x} cy={g.c2.y} r={0.7} class="befehl-kontrolle" />
    </g>
  );
}
