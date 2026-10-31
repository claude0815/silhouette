/**
 * Protokoll und Bericht als Text, zum Kopieren und Herunterladen.
 * Reine Funktionen, damit sie sich ohne Browser testen lassen.
 */
import type { ProtokollEintrag } from '../cutter/types';
import { t } from '../i18n/de';

export type Betriebssystem = 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'unbekannt';

export function erkenneBetriebssystem(plattform: string): Betriebssystem {
  const p = plattform.toLowerCase();
  if (p.includes('win')) return 'Windows';
  if (p.includes('mac')) return 'macOS';
  if (p.includes('cros') || p.includes('chrome os')) return 'ChromeOS';
  if (p.includes('linux')) return 'Linux';
  return 'unbekannt';
}

const zweistellig = (n: number, stellen = 2) => String(n).padStart(stellen, '0');

/** Uhrzeit mit Millisekunden, z. B. 14:03:07.123 – Wartezeiten zwischen Befehlen werden so sichtbar. */
export function uhrzeit(ms: number): string {
  const d = new Date(ms);
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}:${zweistellig(d.getSeconds())}.${zweistellig(d.getMilliseconds(), 3)}`;
}

const pfeile: Record<ProtokollEintrag['richtung'], string> = {
  gesendet: '→',
  empfangen: '←',
  info: '·',
  fehler: '!',
};

export function protokollZeile(e: ProtokollEintrag): string {
  return `${uhrzeit(e.zeit)} ${pfeile[e.richtung]} ${e.text}`;
}

export function protokollAlsText(eintraege: readonly ProtokollEintrag[]): string {
  return eintraege.map(protokollZeile).join('\n');
}

export interface ChecklistenPunkt {
  erledigt: boolean;
  notiz: string;
}

export interface BerichtDaten {
  datum: Date;
  browser: string;
  betriebssystem: Betriebssystem;
  geraet?: string;
  firmware?: string;
  checkliste: readonly ChecklistenPunkt[];
  protokoll: readonly ProtokollEintrag[];
}

/** Der Bericht als Markdown, passend zum Ablegen in docs/machbarkeitstest/. */
export function berichtAlsMarkdown(d: BerichtDaten): string {
  const zeilen = [
    `# ${t.cutterTest.titel}`,
    '',
    `- Datum: ${d.datum.toLocaleString('de-DE')}`,
    `- Betriebssystem: ${d.betriebssystem}`,
    `- Browser: ${d.browser}`,
    `- Gerät: ${d.geraet ?? '–'}`,
    `- Firmware: ${d.firmware ?? '–'}`,
    '',
    `## ${t.cutterTest.checkliste}`,
    '',
  ];
  t.cutterTest.punkte.forEach((text, i) => {
    const p = d.checkliste[i] ?? { erledigt: false, notiz: '' };
    zeilen.push(`- [${p.erledigt ? 'x' : ' '}] ${text}`);
    for (const z of p.notiz.split('\n').filter((z) => z.trim())) zeilen.push(`  > ${z}`);
  });
  zeilen.push('', `## ${t.cutterTest.protokoll}`, '', '```', protokollAlsText(d.protokoll), '```', '');
  return zeilen.join('\n');
}

/** Dateiname für den Bericht, z. B. machbarkeitstest-2026-10-31-1403.md */
export function berichtDateiname(datum: Date): string {
  const z = zweistellig;
  return `machbarkeitstest-${datum.getFullYear()}-${z(datum.getMonth() + 1)}-${z(datum.getDate())}-${z(datum.getHours())}${z(datum.getMinutes())}.md`;
}
