/**
 * Automatische Brücken für Schablonen.
 *
 * Bei einer Schablone fällt alles heraus, was innerhalb eines Lochs liegt – beim „O“ der
 * Innenkreis. Eine Brücke ist ein schmaler Steg, der nicht geschnitten wird und die Insel
 * mit dem übrigen Material verbindet. Geometrisch: Aus der Fläche der Form (Außenkontur
 * minus Löcher) wird ein Streifen quer durch das Loch herausgenommen. Wo der Streifen die
 * Form kreuzt, bleibt Material stehen.
 *
 * „Fläche ohne Streifen“ ist dasselbe wie „Fläche links von x₁“ vereinigt mit „Fläche rechts
 * von x₂“. Wir brauchen also nur eins: eine Fläche an einer senkrechten Geraden abschneiden.
 *
 *   1. Jede Kontur wird in Stücke zerlegt, die auf der gewünschten Seite der Geraden liegen.
 *      Wo eine Kante die Gerade kreuzt, entsteht ein Schnittpunkt.
 *   2. Auf der Geraden liegen alle Schnittpunkte übereinander. Nach der Gerade-Ungerade-Regel
 *      (wie fill-rule="evenodd") gehören die Strecken zwischen dem 1. und 2., dem 3. und 4.
 *      Schnittpunkt usw. zum Inneren der Fläche – sie werden die neuen Kanten.
 *   3. Stücke und neue Kanten werden an ihren gemeinsamen Endpunkten zu geschlossenen
 *      Konturen zusammengesetzt.
 */
import type { Punkt } from '../cutter/types';
import { imVieleck } from '../pipeline/geometrie';
import { vereinfacheGeschlossen } from '../pipeline/vereinfachen';
import { tiefen } from '../simulation/reihenfolge';
import { svgKonturen, type SvgDokument } from '../svg/dokument';

type Vieleck = Punkt[]; // geschlossen, letzter Punkt nicht wiederholt

/** Schneidet die Fläche (Gerade-Ungerade-Regel) an der Geraden x = c ab und behält die Seite `seite`. */
export function schneideAb(konturen: readonly Vieleck[], c: number, seite: 'links' | 'rechts'): Vieleck[] {
  // Liegt ein Punkt genau auf der Geraden, wird die Gerade ein winziges Stück verschoben.
  // So gibt es nur echte Kreuzungen und keine Sonderfälle.
  if (konturen.some((k) => k.some((p) => p.x === c))) c += 1.2345e-7;
  const innen = (p: Punkt) => (seite === 'links' ? p.x < c : p.x > c);

  const ergebnis: Vieleck[] = [];
  interface Stueck {
    punkte: Punkt[];
    anfang: number; // Nummer des Schnittpunkts am Anfang
    ende: number;
  }
  const stuecke: Stueck[] = [];
  const schnitte: Array<{ y: number; nummer: number }> = [];

  for (const k of konturen) {
    if (k.every(innen)) {
      ergebnis.push(k.slice());
      continue;
    }
    if (!k.some(innen)) continue;
    // Bei einem Punkt außerhalb beginnen, damit jedes Stück vollständig ist
    const s = k.findIndex((p) => !innen(p));
    const n = k.length;
    let aktuell: Punkt[] | null = null;
    let anfang = -1;
    for (let i = 0; i < n; i++) {
      const a = k[(s + i) % n]!;
      const b = k[(s + i + 1) % n]!;
      if (innen(a) !== innen(b)) {
        // Kreuzung: Schnittpunkt mit der Geraden
        const t = (c - a.x) / (b.x - a.x);
        const p = { x: c, y: a.y + t * (b.y - a.y) };
        const nummer = schnitte.length;
        schnitte.push({ y: p.y, nummer });
        if (!innen(a)) {
          aktuell = [p];
          anfang = nummer;
        } else if (aktuell) {
          aktuell.push(p);
          stuecke.push({ punkte: aktuell, anfang, ende: nummer });
          aktuell = null;
        }
      }
      if (innen(b) && aktuell) aktuell.push(b);
    }
  }

  // 2. Kanten auf der Geraden: Schnittpunkte von oben nach unten, immer zwei zusammen
  const sortiert = [...schnitte].sort((p, q) => p.y - q.y);
  const partner = new Map<number, number>();
  for (let i = 0; i + 1 < sortiert.length; i += 2) {
    partner.set(sortiert[i]!.nummer, sortiert[i + 1]!.nummer);
    partner.set(sortiert[i + 1]!.nummer, sortiert[i]!.nummer);
  }

  // 3. Zusammensetzen: vom Ende eines Stücks über die Kante zum nächsten Stück
  const stueckAn = new Map<number, { stueck: Stueck; vorwaerts: boolean }>();
  for (const st of stuecke) {
    stueckAn.set(st.anfang, { stueck: st, vorwaerts: true });
    stueckAn.set(st.ende, { stueck: st, vorwaerts: false });
  }
  const benutzt = new Set<Stueck>();
  for (const start of stuecke) {
    if (benutzt.has(start)) continue;
    const kontur: Punkt[] = [];
    let st = start;
    let vorwaerts = true;
    for (let schutz = 0; schutz <= stuecke.length; schutz++) {
      benutzt.add(st);
      kontur.push(...(vorwaerts ? st.punkte : [...st.punkte].reverse()));
      const ende = vorwaerts ? st.ende : st.anfang;
      const weiter = stueckAn.get(partner.get(ende) ?? -1);
      if (!weiter || benutzt.has(weiter.stueck)) break;
      st = weiter.stueck;
      // Kommen wir am Anfang des Stücks an, geht es vorwärts weiter, sonst rückwärts
      vorwaerts = weiter.vorwaerts;
    }
    if (kontur.length >= 3) ergebnis.push(kontur);
  }
  return ergebnis;
}

/** Nimmt aus der Fläche den Streifen x₁ < x < x₂ heraus. */
export function entferneStreifen(konturen: readonly Vieleck[], x1: number, x2: number): Vieleck[] {
  return [...schneideAb(konturen, x1, 'links'), ...schneideAb(konturen, x2, 'rechts')];
}

const tausche = (k: readonly Vieleck[]) => k.map((v) => v.map((p) => ({ x: p.y, y: p.x })));

export interface BrueckenOptionen {
  /** Breite einer Brücke in mm */
  breiteMm: number;
  /** senkrecht: Brücken oben und unten am Loch; waagerecht: links und rechts */
  richtung: 'senkrecht' | 'waagerecht';
}

export interface BrueckenErgebnis {
  text: string;
  /** Zahl der Inseln, die jetzt festgehalten werden */
  inseln: number;
}

const zahl = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Setzt Brücken in alle Formen mit Löchern und gibt den neuen SVG-Text zurück
 * (null, wenn es keine Inseln gibt). Betroffene Elemente werden durch einen Pfad ersetzt;
 * alle anderen bleiben unverändert im Text.
 */
export function setzeBruecken(text: string, dok: SvgDokument, o: BrueckenOptionen): BrueckenErgebnis | null {
  const alle = svgKonturen(dok);
  const geschlossen = alle.filter((k) => k.geschlossen || (k.punkte[0]!.x === k.punkte.at(-1)!.x && k.punkte[0]!.y === k.punkte.at(-1)!.y));
  const vielecke = geschlossen.map((k) => k.punkte.slice(0, -1));
  const t = tiefen(geschlossen.map((k) => k.punkte));

  // Gruppen: jede Außenkontur (gerade Tiefe) mit ihren direkten Löchern
  const gruppen: Array<{ aussen: number; loecher: number[] }> = [];
  vielecke.forEach((v, i) => {
    if (t[i]! % 2 !== 0) return;
    const loecher = vielecke
      .map((_, j) => j)
      .filter((j) => t[j] === t[i]! + 1 && imVieleck(vielecke[j]![0]!, v));
    if (loecher.length) gruppen.push({ aussen: i, loecher });
  });
  if (gruppen.length === 0) return null;

  const neueKonturen: Vieleck[] = [];
  const betroffen = new Set<number>(); // Indizes in `geschlossen`
  let inseln = 0;
  for (const g of gruppen) {
    const waagerecht = o.richtung === 'waagerecht';
    let flaeche: Vieleck[] = [g.aussen, ...g.loecher].map((i) => vielecke[i]!);
    if (waagerecht) flaeche = tausche(flaeche);
    for (const h of g.loecher) {
      const loch = waagerecht ? tausche([vielecke[h]!])[0]! : vielecke[h]!;
      const xs = loch.map((p) => p.x);
      const mitte = (Math.min(...xs) + Math.max(...xs)) / 2;
      flaeche = entferneStreifen(flaeche, mitte - o.breiteMm / 2, mitte + o.breiteMm / 2);
      inseln++;
    }
    if (waagerecht) flaeche = tausche(flaeche);
    neueKonturen.push(...flaeche.map((v) => vereinfacheGeschlossen(v, 0.005)));
    for (const i of [g.aussen, ...g.loecher]) betroffen.add(i);
  }

  // Elemente, deren Konturen sich ändern; ihre übrigen Konturen werden mitgenommen
  const elemente = new Set([...betroffen].map((i) => geschlossen[i]!.pfad));
  const uebrigGeschlossen = geschlossen.filter((k, i) => elemente.has(k.pfad) && !betroffen.has(i)).map((k) => k.punkte.slice(0, -1));
  const uebrigOffen = alle.filter((k) => elemente.has(k.pfad) && !geschlossen.includes(k)).map((k) => k.punkte);

  // mm → Koordinaten der viewBox
  const einheit = (p: Punkt) => `${zahl(p.x / dok.mmJeEinheit.x + dok.ursprung.x)} ${zahl(p.y / dok.mmJeEinheit.y + dok.ursprung.y)}`;
  const d = (v: readonly Punkt[], schliessen: boolean) =>
    v.map((p, i) => `${i === 0 ? 'M' : 'L'} ${einheit(p)}`).join(' ') + (schliessen ? ' Z' : '');
  const stil = dok.pfade[[...elemente][0]!]!.stil;
  const fuellung = stil.fuellung ?? 'black';
  const kontur = stil.kontur ? ` stroke="${stil.kontur}"` : '';
  const neu = [
    `  <!-- Brücken: ${zahl(o.breiteMm)} mm, ${o.richtung} – ${inseln} ${inseln === 1 ? 'Insel' : 'Inseln'} festgehalten -->`,
    `  <path fill-rule="evenodd" fill="${fuellung}"${kontur} d="${[...neueKonturen, ...uebrigGeschlossen].map((v) => d(v, true)).join(' ')}"/>`,
    ...uebrigOffen.map((v) => `  <path fill="none" stroke="${stil.kontur ?? 'black'}" d="${d(v, false)}"/>`),
  ].join('\n');

  // Betroffene Elemente aus dem Text entfernen (von hinten nach vorn), neue Pfade vor </svg> einfügen
  let ergebnis = text;
  for (const i of [...elemente].sort((a, b) => dok.pfade[b]!.element.start - dok.pfade[a]!.element.start)) {
    const e = dok.pfade[i]!.element;
    // Die ganze Zeile entfernen, wenn das Element allein darauf steht
    let von = e.start;
    let bis = e.elementEnde;
    while (von > 0 && (ergebnis[von - 1] === ' ' || ergebnis[von - 1] === '\t')) von--;
    if (ergebnis[bis] === '\n' && (von === 0 || ergebnis[von - 1] === '\n')) bis++;
    ergebnis = ergebnis.slice(0, von) + ergebnis.slice(bis);
  }
  const schluss = ergebnis.lastIndexOf('</svg>');
  ergebnis = schluss === -1 ? ergebnis + '\n' + neu + '\n' : ergebnis.slice(0, schluss) + neu + '\n' + ergebnis.slice(schluss);
  return { text: ergebnis, inseln };
}
