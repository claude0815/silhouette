import { describe, expect, it } from 'vitest';
import { leseSvg, svgZuPolylinien } from './dokument';
import { motivRahmen } from './groesse';
import { istGespiegelt, schalteSpiegelung } from './spiegeln';

const text =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60">\n  <path d="M 10 10 L 40 10 L 10 30 Z"/>\n</svg>\n';

describe('schalteSpiegelung', () => {
  it('spiegelt seitenverkehrt an derselben Stelle', () => {
    const neu = schalteSpiegelung(text, leseSvg(text))!;
    const d = leseSvg(neu);
    expect(istGespiegelt(d)).toBe(true);
    expect(motivRahmen(d)).toEqual(motivRahmen(leseSvg(text)));
    // Die spitze Ecke lag links unten (10|30) und liegt jetzt rechts unten (40|30)
    const punkte = svgZuPolylinien(d)[0]!;
    expect(punkte.some((p) => Math.abs(p.x - 40) < 1e-9 && Math.abs(p.y - 30) < 1e-9)).toBe(true);
    expect(neu).toContain('<path d="M 10 10 L 40 10 L 10 30 Z"/>');
  });

  it('zweimal schalten ergibt wieder den Ausgangstext', () => {
    const einmal = schalteSpiegelung(text, leseSvg(text))!;
    expect(schalteSpiegelung(einmal, leseSvg(einmal))).toBe(text);
  });

  it('beachtet eine verschobene viewBox und andere Einheiten', () => {
    const t2 = '<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="2in" viewBox="-50 0 400 200"><rect x="0" y="0" width="100" height="50"/></svg>';
    const neu = schalteSpiegelung(t2, leseSvg(t2))!;
    const vorher = motivRahmen(leseSvg(t2))!;
    const nachher = motivRahmen(leseSvg(neu))!;
    expect(nachher.x).toBeCloseTo(vorher.x, 6);
    expect(nachher.breite).toBeCloseTo(vorher.breite, 6);
  });

  it('liefert null ohne Formen', () => {
    const leer = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"></svg>';
    expect(schalteSpiegelung(leer, leseSvg(leer))).toBeNull();
  });
});
