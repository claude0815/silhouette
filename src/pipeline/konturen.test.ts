import { describe, expect, it } from 'vitest';
import { binaerAusText, type Binaerbild } from './bilder';
import { findeBereiche } from './entrauschen';
import { FALL_SEGMENTE, fall, findeKonturen, gruppiere, kantenmitte, vorzeichenFlaeche, zellenMitKontur } from './konturen';

describe('Fallnummern', () => {
  it('liest die vier Ecken als Binärzahl', () => {
    const bild = binaerAusText(['#.', '##']);
    expect(fall(bild, 0, 0)).toBe(8 + 0 + 2 + 1);
    // Zelle links oben außerhalb: nur das Pixel (0|0) liegt als „unten rechts“ darin
    expect(fall(bild, -1, -1)).toBe(2);
  });

  it('jedes Teilstück hat den Vordergrund rechts', () => {
    const ecken = { 8: [0.5, 0.5], 4: [1.5, 0.5], 2: [1.5, 1.5], 1: [0.5, 1.5] } as const;
    FALL_SEGMENTE.forEach((segmente, f) => {
      for (const [von, nach] of segmente) {
        const a = kantenmitte(0, 0, von);
        const b = kantenmitte(0, 0, nach);
        for (const [bit, [ex, ey]] of Object.entries(ecken)) {
          if (!(f & Number(bit))) continue;
          // Nur Ecken prüfen, die an diesem Teilstück anliegen (Abstand ≤ 0,5 zu einer Kantenmitte)
          const nah = Math.min(Math.hypot(ex - a.x, ey - a.y), Math.hypot(ex - b.x, ey - b.y)) <= 0.5;
          if (!nah) continue;
          const kreuz = (b.x - a.x) * (ey - a.y) - (b.y - a.y) * (ex - a.x);
          expect(kreuz, `Fall ${f}, ${von}→${nach}, Ecke ${bit}`).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('findeKonturen', () => {
  it('ein einzelnes Pixel ergibt eine Raute', () => {
    const [k, ...rest] = findeKonturen(binaerAusText(['#']));
    expect(rest).toHaveLength(0);
    expect(k!.aussen).toBe(true);
    expect(k!.flaeche).toBe(0.5);
    expect(k!.punkte).toHaveLength(4);
  });

  it('ein Rahmen ergibt eine Außenkontur und ein Loch im selben Bereich', () => {
    const konturen = findeKonturen(binaerAusText(['###', '#.#', '###']));
    expect(konturen.map((k) => k.aussen).sort()).toEqual([false, true]);
    const [a, b] = konturen;
    expect(a!.bereich).toBe(b!.bereich);
    const formen = gruppiere(konturen);
    expect(formen).toHaveLength(1);
    expect(formen[0]!.loecher).toHaveLength(1);
  });

  it('diagonal benachbarte Pixel bleiben getrennt (Sattelfall)', () => {
    const konturen = findeKonturen(binaerAusText(['#.', '.#']));
    expect(konturen).toHaveLength(2);
    expect(konturen.every((k) => k.aussen)).toBe(true);
  });

  it('Außenkonturen laufen im Uhrzeigersinn, Löcher dagegen', () => {
    for (const k of findeKonturen(binaerAusText(['####', '#..#', '####']))) {
      expect(Math.sign(vorzeichenFlaeche(k.punkte))).toBe(k.aussen ? 1 : -1);
    }
  });

  it('Konturen sind geschlossen und bestehen aus kurzen Teilstücken', () => {
    for (const k of findeKonturen(binaerAusText(['.##..', '####.', '.#.##', '..###']))) {
      for (let i = 0; i < k.punkte.length; i++) {
        const a = k.punkte[i]!;
        const b = k.punkte[(i + 1) % k.punkte.length]!;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        expect([1, Math.SQRT1_2].some((l) => Math.abs(d - l) < 1e-9)).toBe(true);
      }
    }
  });

  it('Vordergrund am Bildrand wird sauber umschlossen', () => {
    const [k] = findeKonturen(binaerAusText(['##', '##']));
    const xs = k!.punkte.map((p) => p.x);
    expect(Math.min(...xs)).toBe(0); // Kantenmitte zwischen gedachtem Rand und Pixel
    expect(Math.max(...xs)).toBe(2);
  });

  it('Zufallsbilder: so viele Außenkonturen wie Bereiche, so viele Löcher wie eingeschlossene Lücken', () => {
    let saat = 42;
    const zufall = () => ((saat = (saat * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let runde = 0; runde < 40; runde++) {
      const breite = 3 + Math.floor(zufall() * 15);
      const hoehe = 3 + Math.floor(zufall() * 15);
      const dichte = 0.3 + zufall() * 0.4;
      const bild: Binaerbild = {
        breite,
        hoehe,
        daten: Uint8Array.from({ length: breite * hoehe }, () => (zufall() < dichte ? 1 : 0)),
      };
      const { bereiche } = findeBereiche(bild);
      const konturen = findeKonturen(bild);
      const aussen = konturen.filter((k) => k.aussen).length;
      const loecher = konturen.length - aussen;
      expect(aussen).toBe(bereiche.filter((b) => b.wert === 1).length);
      expect(loecher).toBe(bereiche.filter((b) => b.wert === 0 && !b.amRand).length);
      // Jedes Loch findet seine Außenkontur
      const zugeordnet = gruppiere(konturen).reduce((s, f) => s + f.loecher.length, 0);
      expect(zugeordnet).toBe(loecher);
    }
  });
});

describe('zellenMitKontur', () => {
  it('liefert die Zellen in Lesereihenfolge, ohne Fall 0 und 15', () => {
    const zellen = zellenMitKontur(binaerAusText(['#']));
    expect(zellen.map((z) => z.fall)).toEqual([2, 1, 4, 8]);
  });
});
