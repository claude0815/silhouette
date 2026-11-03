/**
 * Motiv waagerecht spiegeln, z. B. für Flex- oder Bügelfolie: Sie wird von der Rückseite
 * geschnitten und danach umgedreht aufgebügelt.
 *
 * Gespiegelt wird mit einer Gruppe um den ganzen Inhalt:
 *
 *     <g class="gespiegelt" transform="matrix(-1 0 0 1 c 0)">
 *
 * Die Matrix rechnet x' = −x + c und y' = y. Mit c = 2 · (Mitte des Motivs) bleibt das Motiv an
 * seiner Stelle und wird nur seitenverkehrt. Die Pfade selbst bleiben unverändert; ein zweites
 * Spiegeln entfernt die Gruppe wieder.
 */
import { attribut, type SvgDokument } from './dokument';
import { motivRahmen } from './groesse';

export const SPIEGEL_KLASSE = 'gespiegelt';

/** Gruppe, die das Spiegeln bewirkt (direktes Kind der Wurzel), oder undefined */
function spiegelgruppe(dok: SvgDokument) {
  const wurzel = dok.elemente.findIndex((e) => e.name === 'svg');
  return dok.elemente.find((e) => e.name === 'g' && e.eltern === wurzel && attribut(e, 'class')?.wert.split(/\s+/).includes(SPIEGEL_KLASSE));
}

export function istGespiegelt(dok: SvgDokument): boolean {
  return spiegelgruppe(dok) !== undefined;
}

/** Öffnender Tag der Spiegelgruppe; c in Einheiten der viewBox */
export function spiegelTag(c: number): string {
  return `<g class="${SPIEGEL_KLASSE}" transform="matrix(-1 0 0 1 ${Math.round(c * 1000) / 1000} 0)">`;
}

/** Spiegelt das Motiv oder hebt eine bestehende Spiegelung auf. Null, wenn es nichts zu spiegeln gibt. */
export function schalteSpiegelung(text: string, dok: SvgDokument): string | null {
  const g = spiegelgruppe(dok);
  if (g) {
    // Gruppe auflösen: End-Tag und Start-Tag entfernen (erst hinten, damit die Stellen stimmen)
    // Beim Einfügen kamen ein Zeilenumbruch vor den Start-Tag und einer hinter den End-Tag
    const endTag = text.lastIndexOf('</g', g.elementEnde - 1);
    const nachEnde = text[g.elementEnde] === '\n' ? g.elementEnde + 1 : g.elementEnde;
    const ohneEnde = text.slice(0, endTag) + text.slice(nachEnde);
    const von = g.start > 0 && ohneEnde[g.start - 1] === '\n' ? g.start - 1 : g.start;
    return ohneEnde.slice(0, von) + ohneEnde.slice(g.ende);
  }
  const wurzel = dok.elemente.find((e) => e.name === 'svg');
  const r = motivRahmen(dok);
  const schluss = text.lastIndexOf('</svg>');
  if (!wurzel || !r || schluss < wurzel.ende) return null;
  // Mitte des Motivs von mm zurück in Einheiten der viewBox
  const mitte = (r.x + r.breite / 2) / dok.mmJeEinheit.x + dok.ursprung.x;
  return text.slice(0, wurzel.ende) + '\n' + spiegelTag(2 * mitte) + text.slice(wurzel.ende, schluss) + '</g>\n' + text.slice(schluss);
}
