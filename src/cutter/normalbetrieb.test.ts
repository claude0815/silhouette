import { describe, expect, it } from 'vitest';
import { auftragZuBefehlen, AuftragsFehler, bytesAlsText, testfahrtBefehle, testQuadrat } from './gpgl';
import { AbbruchFehler } from './gpgl-cutter';
import { profile } from './profile';
import { SimulatedCutter } from './simulated';
import type { CutJob } from './types';

const cameo4 = profile.find((p) => p.id === 'cameo4')!;
const job: CutJob = {
  pfade: testQuadrat(),
  matte: 'cameo-12x12',
  werkzeug: { art: 'messer', druck: 10, geschwindigkeit: 5, halter: 1 },
};

describe('Testfahrt', () => {
  it('fährt nur mit angehobenem Werkzeug (keine D-Befehle, kein Druck)', () => {
    const b = testfahrtBefehle(cameo4, 'cameo-12x12');
    expect(b.some((x) => x.startsWith('D'))).toBe(false);
    expect(b.some((x) => x.startsWith('FX'))).toBe(false);
    expect(b.filter((x) => x.startsWith('M'))).toEqual(['M200,200', 'M200,600', 'M600,600', 'M600,200', 'M200,200', 'M0,0']);
  });
});

describe('Klingentiefe (AutoBlade)', () => {
  it('wird nur beim Messer gesendet, als TFn,1', () => {
    expect(auftragZuBefehlen({ ...job, werkzeug: { ...job.werkzeug, tiefe: 3 } }, cameo4)).toContain('TF3,1');
    expect(auftragZuBefehlen(job, cameo4).some((b) => b.startsWith('TF'))).toBe(false);
    const stift: CutJob = { ...job, werkzeug: { ...job.werkzeug, art: 'stift', tiefe: 3 } };
    expect(auftragZuBefehlen(stift, cameo4).some((b) => b.startsWith('TF'))).toBe(false);
  });

  it('nur in Halter 1', () => {
    const j: CutJob = { ...job, werkzeug: { ...job.werkzeug, halter: 2, tiefe: 3 } };
    expect(() => auftragZuBefehlen(j, cameo4)).toThrow(AuftragsFehler);
  });
});

describe('Zugriffe nacheinander', () => {
  it('eine gleichzeitige Statusabfrage läuft erst nach dem Auftrag', async () => {
    const cutter = new SimulatedCutter({ bewegungsAbfragen: 3 }, { blockgroesse: 32 });
    await cutter.connect();
    const reihenfolge: string[] = [];
    const senden = cutter.send(job).then(() => reihenfolge.push('auftrag fertig'));
    expect(cutter.beschaeftigt).toBe(true);
    const status = cutter.status().then((s) => reihenfolge.push(`status ${s.status}`));
    await Promise.all([senden, status]);
    expect(reihenfolge).toEqual(['auftrag fertig', 'status bereit']);
    expect(cutter.beschaeftigt).toBe(false);
  });

  it('cancel() bricht auch einen Auftrag ab, der noch wartet', async () => {
    const cutter = new SimulatedCutter({ bewegungsAbfragen: 3 });
    await cutter.connect();
    const erster = cutter.status();
    const auftrag = cutter.sendeBefehle(testfahrtBefehle(cameo4, 'cameo-12x12'));
    await cutter.cancel();
    await erster;
    await expect(auftrag).rejects.toThrow(AbbruchFehler);
    const gesendet = cutter.simulation.empfangen.map(bytesAlsText).join('');
    expect(gesendet).not.toContain('M200,200');
  });

  it('die Testfahrt lässt sich über sendeBefehle schicken', async () => {
    const cutter = new SimulatedCutter();
    await cutter.connect();
    await cutter.sendeBefehle(testfahrtBefehle(cameo4, 'cameo-12x12'));
    expect(cutter.simulation.empfangen.map(bytesAlsText).join('')).toContain('M600,600');
  });

  it('ein Fehler im Auftrag blockiert die Warteschlange nicht', async () => {
    const cutter = new SimulatedCutter();
    await cutter.connect();
    await expect(cutter.send({ ...job, pfade: [[{ x: 0, y: 0 }, { x: 999, y: 0 }]] })).rejects.toThrow();
    expect((await cutter.status()).status).toBe('bereit');
  });
});
