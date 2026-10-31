import { describe, expect, it } from 'vitest';
import { berichtAlsMarkdown, berichtDateiname, erkenneBetriebssystem, protokollZeile } from './bericht';

describe('erkenneBetriebssystem', () => {
  it('erkennt die üblichen Plattformangaben', () => {
    expect(erkenneBetriebssystem('Win32')).toBe('Windows');
    expect(erkenneBetriebssystem('Windows')).toBe('Windows');
    expect(erkenneBetriebssystem('MacIntel')).toBe('macOS');
    expect(erkenneBetriebssystem('macOS')).toBe('macOS');
    expect(erkenneBetriebssystem('Linux x86_64')).toBe('Linux');
    expect(erkenneBetriebssystem('')).toBe('unbekannt');
  });
});

describe('Bericht', () => {
  const datum = new Date(2026, 9, 31, 14, 3, 7, 5);

  it('formatiert Protokollzeilen mit Millisekunden', () => {
    expect(protokollZeile({ zeit: datum.getTime(), richtung: 'gesendet', text: '<ESC><ENQ>' })).toBe(
      '14:03:07.005 → <ESC><ENQ>',
    );
  });

  it('enthält Checkliste mit Notizen und Protokoll', () => {
    const md = berichtAlsMarkdown({
      datum,
      browser: 'Chrome 140',
      betriebssystem: 'macOS',
      geraet: 'Cameo 4 (USB)',
      checkliste: [{ erledigt: true, notiz: 'Status 0\nalles gut' }],
      protokoll: [{ zeit: datum.getTime(), richtung: 'empfangen', text: '0<ETX>' }],
    });
    expect(md).toContain('- [x] macOS mit Chrome');
    expect(md).toContain('  > Status 0\n  > alles gut');
    expect(md).toContain('- [ ] Mit Stift ein Quadrat');
    expect(md).toContain('14:03:07.005 ← 0<ETX>');
    expect(md).toContain('- Firmware: –');
  });

  it('bildet einen sortierbaren Dateinamen', () => {
    expect(berichtDateiname(datum)).toBe('machbarkeitstest-2026-10-31-1403.md');
  });
});
