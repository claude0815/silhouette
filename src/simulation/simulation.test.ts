import { describe, expect, it } from 'vitest';
import { auftragZuBefehlen } from '../cutter/gpgl';
import { profile } from '../cutter/profile';
import type { CutJob, Polylinie } from '../cutter/types';
import { rechteck } from '../export/testformen';
import { befehleZuFahrten, kennzahlen, zeitannahmen, zeitplan, zustandZurZeit } from './fahrten';
import { aussenZuFrueh, drehe, ordne, REIHENFOLGEN, tiefen } from './reihenfolge';

// Ein „O“ (außen, dann Loch) und weit rechts ein kleines Quadrat
const aussen = rechteck(10, 10, 40, 40);
const loch = rechteck(20, 20, 20, 20);
const rechts = rechteck(100, 10, 10, 10);
const pfade: Polylinie[] = [aussen, rechts, loch];

const job = (p: readonly Polylinie[]): CutJob => ({
  pfade: p,
  matte: 'cameo-12x12',
  werkzeug: { art: 'stift', druck: 10, geschwindigkeit: 10, halter: 1 },
});
const cameo4 = profile[0]!;

describe('Reihenfolge', () => {
  it('bestimmt die Verschachtelungstiefe', () => {
    expect(tiefen(pfade)).toEqual([0, 0, 1]);
  });

  it('innen vor außen: das Loch zuerst, sonst Dokumentreihenfolge', () => {
    expect(ordne(pfade, 'innen-vor-aussen').map((g) => g.original)).toEqual([2, 0, 1]);
  });

  it('warnt, wenn eine Außenkontur vor ihrem Loch kommt', () => {
    expect(aussenZuFrueh(ordne(pfade, 'original'))).toEqual([0]);
    for (const art of ['innen-vor-aussen', 'naechster-nachbar'] as const) {
      expect(aussenZuFrueh(ordne(pfade, art))).toEqual([]);
    }
  });

  it('nächster Nachbar: Loch zuerst, Startpunkte an der nächsten Ecke', () => {
    const g = ordne(pfade, 'naechster-nachbar');
    expect(g.map((x) => x.original)).toEqual([2, 0, 1]);
    // Das Loch beginnt an der Ecke, die dem Ursprung am nächsten liegt
    expect(g[0]!.pfad[0]).toEqual({ x: 20, y: 20 });
    // Danach beginnt das „O“ an der Ecke, die dem Ende des Lochs am nächsten liegt
    expect(g[1]!.pfad[0]).toEqual({ x: 10, y: 10 });
  });

  it('dreht geschlossene Pfade, ohne die Form zu ändern', () => {
    const d = drehe(aussen, 2);
    expect(d[0]).toEqual(aussen[2]);
    expect(d.at(-1)).toEqual(d[0]);
    expect(new Set(d.map((p) => `${p.x},${p.y}`))).toEqual(new Set(aussen.map((p) => `${p.x},${p.y}`)));
  });
});

describe('Fahrten aus Plotterbefehlen', () => {
  it('liest M als Leerfahrt und D als Schnitt, mit y vor x', () => {
    const f = befehleZuFahrten(['TG1', 'M200,100', 'D200,300', 'M0,0']);
    expect(f.map((x) => [x.art, x.nach, x.befehl])).toEqual([
      ['leer', { x: 5, y: 10 }, 1],
      ['schnitt', { x: 15, y: 10 }, 2],
      ['leer', { x: 0, y: 0 }, 3],
    ]);
    expect(f[1]!.laenge).toBe(10);
  });

  it('jede Reihenfolge schneidet gleich viel, aber mit unterschiedlichen Leerfahrten', () => {
    const z = zeitannahmen(10);
    const werte = REIHENFOLGEN.map((art) => {
      const geordnet = ordne(pfade, art).map((g) => g.pfad);
      return kennzahlen(befehleZuFahrten(auftragZuBefehlen(job(geordnet), cameo4)), z);
    });
    for (const k of werte) {
      expect(k.schnittMm).toBeCloseTo(160 + 80 + 40); // Umfänge der drei Quadrate
      expect(k.pfade).toBe(3);
    }
    // Unter derselben Bedingung (Löcher zuerst) ist der nächste Nachbar nicht schlechter.
    const [, innen, nachbar] = werte;
    expect(nachbar!.leerMm).toBeLessThanOrEqual(innen!.leerMm + 1e-9);
  });

  it('nächster Nachbar spart Leerfahrten, wenn die Dokumentreihenfolge hin und her springt', () => {
    const z = zeitannahmen(10);
    const reihe = [10, 160, 60, 110].map((x) => rechteck(x, 10, 5, 5));
    const leer = (art: 'original' | 'naechster-nachbar') =>
      kennzahlen(befehleZuFahrten(auftragZuBefehlen(job(ordne(reihe, art).map((g) => g.pfad)), cameo4)), z).leerMm;
    expect(leer('naechster-nachbar')).toBeLessThan(leer('original') - 50);
  });

  it('nächster Nachbar ist gierig: Den Rückweg zum Ursprung bedenkt er nicht', () => {
    // Hier ist die Originalreihenfolge kürzer – sie schneidet aber die Außenkontur vor dem Loch.
    const z = zeitannahmen(10);
    const leer = (art: 'original' | 'naechster-nachbar') =>
      kennzahlen(befehleZuFahrten(auftragZuBefehlen(job(ordne(pfade, art).map((g) => g.pfad)), cameo4)), z).leerMm;
    expect(leer('original')).toBeLessThan(leer('naechster-nachbar'));
  });

  it('Zeitplan und Kennzahlen passen zusammen; die Position läuft mit', () => {
    const z = zeitannahmen(10);
    const fahrten = befehleZuFahrten(auftragZuBefehlen(job([rechts]), cameo4));
    const zeiten = zeitplan(fahrten, z);
    expect(zeiten.at(-1)).toBeCloseTo(kennzahlen(fahrten, z).dauerS);
    expect(zustandZurZeit(fahrten, zeiten, 0).position).toEqual({ x: 0, y: 0 });
    expect(zustandZurZeit(fahrten, zeiten, zeiten.at(-1)!).position).toEqual({ x: 0, y: 0 }); // zurück am Ursprung
    const mitte = zustandZurZeit(fahrten, zeiten, zeiten[1]! + (zeiten[2]! - zeiten[1]!) * 0.999);
    expect(fahrten[mitte.index]!.art).toBe('schnitt');
  });
});
