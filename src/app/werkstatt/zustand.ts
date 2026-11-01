/** Zustand der SVG-Werkstatt. Das Dokument wird einmal gelesen; alle Teile nutzen das Ergebnis. */
import { computed, effect, signal } from '@preact/signals';
import { programme } from '../../i18n/programme.de';
import { pruefe, type PruefId } from '../../checks/cutter-checks';
import { profile, schneidebereichMm } from '../../cutter/profile';
import type { MattenId } from '../../cutter/types';
import { leseSvg, svgKonturen, type SvgDokument } from '../../svg/dokument';
import { dokument } from '../dokument';

export const dok = computed(() => leseSvg(dokument.value.text));
export const konturen = computed(() => svgKonturen(dok.value));

export const pruefProfil = signal(profile[0]!.id);
export const pruefMatte = signal<MattenId>('cameo-12x12');
export const befunde = computed(() => {
  const profil = profile.find((p) => p.id === pruefProfil.value) ?? profile[0]!;
  return pruefe(dok.value, { bereich: schneidebereichMm(profil, pruefMatte.value) }, konturen.value);
});

/** Ausgewählter Pfad (Index in dok.pfade) für Erklärer und Ziehen */
export const auswahl = signal<number | null>(null);

export interface Markierung {
  pfad: number;
  /** Index des Befehls, oder null für das ganze Element */
  befehl: number | null;
  /** Woher kam die Markierung? Bei „grafik“ scrollt der Editor mit. */
  quelle: 'grafik' | 'code' | 'liste';
}
export const markiert = signal<Markierung | null>(null);
export const befundMarkiert = signal<PruefId | null>(null);

export type Reiter = 'erklaerer' | 'checks' | 'beispiele';
export const reiter = signal<Reiter>('erklaerer');
export const cutterAnsicht = signal(false);
export const zoom = signal(1);

/** Sprungziel im Editor; die Zählnummer sorgt dafür, dass auch derselbe Sprung zweimal wirkt. */
export const sprung = signal<{ start: number; ende: number; n: number } | null>(null);
let sprungNummer = 0;
export function springeZu(start: number, ende = start): void {
  sprung.value = { start, ende, n: ++sprungNummer };
}

/** Welches Element und welcher Befehl stehen an dieser Stelle im Text? */
export function anStelle(d: SvgDokument, pos: number): { pfad: number; befehl: number | null } | null {
  for (let i = d.pfade.length - 1; i >= 0; i--) {
    const p = d.pfade[i]!;
    if (pos < p.element.start || pos > p.element.elementEnde) continue;
    if (!p.umgerechnet) {
      const b = p.befehle.findIndex((x) => pos >= x.start && pos <= x.ende);
      if (b !== -1) return { pfad: i, befehl: b };
    }
    return { pfad: i, befehl: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// SVG per Programm

export type Modus = 'svg' | 'programm';
export const modus = signal<Modus>('svg');

const PROGRAMM_SPEICHER = 'vom-pixel-zum-schnitt:programm';
export const programmText = signal<string>(
  (() => {
    try {
      return globalThis.localStorage?.getItem(PROGRAMM_SPEICHER) ?? programme[0]!.code;
    } catch {
      return programme[0]!.code;
    }
  })(),
);
effect(() => {
  try {
    globalThis.localStorage?.setItem(PROGRAMM_SPEICHER, programmText.value);
  } catch {
    // nicht speicherbar: nur für diese Sitzung
  }
});
