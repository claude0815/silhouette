/**
 * Export aus dem SVG-Dokument: Was im SVG-Code steht, wird exportiert –
 * egal ob nachgezeichnet oder von Hand geschrieben.
 */
import { leseSvg, svgZuPolylinien, type Hinweis } from '../svg/dokument';
import { polylinienZuDxf, type DxfVariante } from './dxf';

export function svgZuDxf(svgText: string, variante: DxfVariante = 'polylinie'): { dxf: string; hinweise: Hinweis[] } {
  const dok = leseSvg(svgText);
  const dxf = polylinienZuDxf(svgZuPolylinien(dok), { variante, hoeheMm: dok.hoeheMm });
  return { dxf, hinweise: dok.hinweise };
}
