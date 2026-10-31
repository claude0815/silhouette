import { describe, expect, it } from 'vitest';
import {
  AuftragsFehler,
  auftragZuBefehlen,
  befehleZuBytes,
  bytesAlsText,
  ETX,
  inBloeckeTeilen,
  mmZuSchritten,
  pfadBefehle,
  testQuadrat,
  werteStatusAus,
} from './gpgl';
import { profile } from './profile';
import type { CutJob } from './types';

const profilVon = (id: string) => {
  const p = profile.find((p) => p.id === id);
  if (!p) throw new Error(id);
  return p;
};

const stiftJob: CutJob = {
  pfade: testQuadrat(50, 10),
  werkzeug: { art: 'stift', druck: 10, geschwindigkeit: 10, halter: 1 },
  matte: 'cameo-12x12',
};

describe('mmZuSchritten', () => {
  it('rechnet 20 Schritte pro mm', () => {
    expect(mmZuSchritten(1)).toBe(20);
    expect(mmZuSchritten(50)).toBe(1000);
    expect(mmZuSchritten(0.05)).toBe(1);
    expect(mmZuSchritten(0.024)).toBe(0);
  });
});

describe('werteStatusAus', () => {
  const antwort = (text: string) => new TextEncoder().encode(text + '\x03');
  it('erkennt die drei bekannten Zustände', () => {
    expect(werteStatusAus(antwort('0')).status).toBe('bereit');
    expect(werteStatusAus(antwort('1')).status).toBe('in-bewegung');
    expect(werteStatusAus(antwort('2')).status).toBe('keine-matte');
  });
  it('meldet Unbekanntes mit der Rohantwort', () => {
    expect(werteStatusAus(antwort('7'))).toEqual({ status: 'unbekannt', roh: '7' });
  });
});

describe('pfadBefehle', () => {
  it('schreibt erst y, dann x', () => {
    expect(
      pfadBefehle([
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
      ]),
    ).toEqual(['M40,20', 'D80,60']);
  });
  it('überspringt Pfade mit nur einem Punkt', () => {
    expect(pfadBefehle([[{ x: 1, y: 1 }], []])).toEqual([]);
  });
});

describe('auftragZuBefehlen', () => {
  it('Testquadrat mit Stift auf der Cameo 4', () => {
    expect(auftragZuBefehlen(stiftJob, profilVon('cameo4'))).toMatchInlineSnapshot(`
      [
        "TG1",
        "FN0",
        "TB50,0",
        "\\0,0",
        "Z6096,6096",
        "J1",
        "FX10,1",
        "TJ0",
        "!10,1",
        "FC0,1,1",
        "FE0,1",
        "FF0,0,1",
        "FF0,0,1",
        "FX10,1",
        "TJ3",
        "FC0,1,1",
        "M200,200",
        "D200,1200",
        "D1200,1200",
        "D1200,200",
        "D200,200",
        "L0",
        "\\0,0",
        "M0,0",
        "J0",
        "FN0",
        "TB50,0",
      ]
    `);
  });

  it('Testquadrat mit Messer auf dem Portrait 3 (nur ein Halter, also kein J-Befehl)', () => {
    const job: CutJob = {
      ...stiftJob,
      matte: 'portrait-8x12',
      werkzeug: { art: 'messer', druck: 20, geschwindigkeit: 5, halter: 1, klingenVersatzMm: 0.9 },
    };
    expect(auftragZuBefehlen(job, profilVon('portrait3'))).toMatchInlineSnapshot(`
      [
        "TG3",
        "FN0",
        "TB50,0",
        "\\0,0",
        "Z6096,4064",
        "FX20,1",
        "TJ0",
        "!5,1",
        "FC0,1,1",
        "FE0,1",
        "FF1,0,1",
        "FF1,1,1",
        "FX20,1",
        "TJ3",
        "FC18,1,1",
        "M200,200",
        "D200,1200",
        "D1200,1200",
        "D1200,200",
        "D200,200",
        "L0",
        "\\0,0",
        "M0,0",
        "J0",
        "FN0",
        "TB50,0",
      ]
    `);
  });

  it('entspricht dem Mitschnitt von Silhouette Studio 4.4 mit der Cameo 4 Pro', () => {
    // Aus Commands.md (inkscape-silhouette), Messer, Druck 15, Tempo 10, Matte 24″ × 24″.
    // Studio setzt zusätzlich FM1 und einen Rand (\30,30 Z12162,12162);
    // Graphtec.py und diese App nehmen die ganze Matte (\0,0 Z12192,12192).
    const studio = [
      'TG9', 'FN0', 'TB50,0', 'FM1', '\\30,30', 'Z12162,12162',
      'J1', 'FX15,1', 'TJ0', '!10,1', 'FC0,1,1',
      'FE0,1', 'FF1,0,1', 'FF1,1,1', 'FX15,1', 'TJ3',
      'FC18,1,1',
    ];
    const job: CutJob = {
      pfade: [],
      matte: 'cameo-pro-24x24',
      werkzeug: { art: 'messer', druck: 15, geschwindigkeit: 10, halter: 1 },
    };
    const befehle = auftragZuBefehlen(job, profilVon('cameo4pro'));
    const ohneRand = (liste: string[]) =>
      liste.filter((b) => b !== 'FM1' && !b.startsWith('\\') && !b.startsWith('Z'));
    expect(ohneRand(befehle.slice(0, 16))).toEqual(ohneRand(studio));
    expect(befehle.slice(-6)).toEqual(['L0', '\\0,0', 'M0,0', 'J0', 'FN0', 'TB50,0']);
  });

  it('begrenzt Druck und Geschwindigkeit', () => {
    const job: CutJob = { ...stiftJob, werkzeug: { ...stiftJob.werkzeug, druck: 99, geschwindigkeit: 0 } };
    const befehle = auftragZuBefehlen(job, profilVon('cameo4'));
    expect(befehle).toContain('FX33,1');
    expect(befehle).toContain('!1,1');
  });

  it('lehnt Punkte außerhalb des Schneidebereichs ab', () => {
    const job: CutJob = {
      ...stiftJob,
      pfade: [
        [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
        ],
      ],
    };
    expect(() => auftragZuBefehlen(job, profilVon('cameo4'))).toThrow(AuftragsFehler);
  });

  it('begrenzt die Breite auf das Gerät, auch wenn die Matte breiter ist', () => {
    const job: CutJob = {
      ...stiftJob,
      pfade: [
        [
          { x: 0, y: 0 },
          { x: 210, y: 0 },
        ],
      ],
    };
    expect(() => auftragZuBefehlen(job, profilVon('portrait3'))).toThrow(/außerhalb/);
  });

  it('lehnt Halter 2 bei Geräten mit nur einem Halter ab', () => {
    const job: CutJob = { ...stiftJob, werkzeug: { ...stiftJob.werkzeug, halter: 2 } };
    expect(() => auftragZuBefehlen(job, profilVon('portrait4'))).toThrow(/zweiten Werkzeughalter/);
  });
});

describe('befehleZuBytes und inBloeckeTeilen', () => {
  it('hängt an jeden Befehl ETX an', () => {
    expect(bytesAlsText(befehleZuBytes(['FG', 'M0,0']))).toBe('FG<ETX>M0,0<ETX>');
  });

  it('teilt nur direkt nach ETX', () => {
    const bytes = befehleZuBytes(['AAAA', 'BBBB', 'CCCC']); // je 5 Byte
    const bloecke = inBloeckeTeilen(bytes, 12);
    expect(bloecke.map(bytesAlsText)).toEqual(['AAAA<ETX>BBBB<ETX>', 'CCCC<ETX>']);
    for (const b of bloecke) expect(b[b.length - 1]).toBe(ETX);
  });

  it('lässt zu lange Einzelbefehle ganz', () => {
    const bytes = befehleZuBytes(['AAAAAAAAAA', 'B']);
    expect(inBloeckeTeilen(bytes, 4).map(bytesAlsText)).toEqual(['AAAAAAAAAA<ETX>', 'B<ETX>']);
  });

  it('verliert kein Byte', () => {
    const bytes = befehleZuBytes(auftragZuBefehlen(stiftJob, profilVon('cameo4')));
    const bloecke = inBloeckeTeilen(bytes, 16);
    expect(bloecke.reduce((s, b) => s + b.length, 0)).toBe(bytes.length);
    expect(bloecke.every((b) => b.length <= 16)).toBe(true);
  });
});

describe('bytesAlsText', () => {
  it('zeigt Steuerzeichen lesbar an', () => {
    expect(bytesAlsText(Uint8Array.of(0x1b, 0x05))).toBe('<ESC><ENQ>');
    expect(bytesAlsText(Uint8Array.of(0x00, 0x41))).toBe('<00>A');
  });
});
