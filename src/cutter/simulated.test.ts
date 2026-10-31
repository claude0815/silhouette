import { describe, expect, it } from 'vitest';
import { auftragZuBefehlen, befehleZuBytes, bytesAlsText, testQuadrat } from './gpgl';
import { AbbruchFehler, CutterFehler } from './gpgl-cutter';
import { profile } from './profile';
import { SimulatedCutter } from './simulated';
import type { CutJob, ProtokollEintrag } from './types';

const job: CutJob = {
  pfade: testQuadrat(),
  werkzeug: { art: 'stift', druck: 10, geschwindigkeit: 10, halter: 1 },
  matte: 'cameo-12x12',
};

/** Fügt alle gesendeten Bytes zusammen, damit man sie mit der erwarteten Folge vergleichen kann. */
function alles(cutter: SimulatedCutter): string {
  return cutter.simulation.empfangen.map(bytesAlsText).join('');
}

describe('SimulatedCutter', () => {
  it('erkennt beim Verbinden das Modell aus der Firmware-Antwort', async () => {
    const cutter = new SimulatedCutter({ profil: profile.find((p) => p.id === 'cameo5')! });
    await cutter.connect();
    expect(cutter.profil?.id).toBe('cameo5');
    expect(cutter.firmware).toBe('CAMEO 5 V1.00');
    expect(cutter.name).toBe('Cameo 5 (Simulation)');
  });

  it('meldet den Status', async () => {
    const cutter = new SimulatedCutter({ matteGeladen: false });
    expect((await cutter.status()).status).toBe('keine-matte');
    cutter.simulation.matteGeladen = true;
    expect((await cutter.status()).status).toBe('bereit');
  });

  it('sendet genau die Befehle aus auftragZuBefehlen, mit Statusabfragen dazwischen', async () => {
    const cutter = new SimulatedCutter({}, { blockgroesse: 64 });
    await cutter.connect();
    await cutter.send(job);

    const gesendet = alles(cutter);
    const erwartet = bytesAlsText(befehleZuBytes(auftragZuBefehlen(job, cutter.profil!)));
    expect(gesendet.startsWith('<ESC><EOT>FG<ETX>')).toBe(true);
    expect(gesendet.replaceAll('<ESC><ENQ>', '')).toBe('<ESC><EOT>FG<ETX>' + erwartet);
  });

  it('meldet den Fortschritt', async () => {
    const cutter = new SimulatedCutter({}, { blockgroesse: 64 });
    await cutter.connect();
    const schritte: number[] = [];
    await cutter.send(job, { onFortschritt: (g, gesamt) => schritte.push(g / gesamt) });
    expect(schritte.length).toBeGreaterThan(1);
    expect(schritte.at(-1)).toBe(1);
  });

  it('bricht ohne Matte vor dem ersten Befehl ab', async () => {
    const cutter = new SimulatedCutter({ matteGeladen: false });
    await cutter.connect();
    await expect(cutter.send(job)).rejects.toThrow(CutterFehler);
    expect(alles(cutter)).not.toContain('TG1');
  });

  it('sendet nach cancel() keine weiteren Blöcke', async () => {
    const cutter = new SimulatedCutter({}, { blockgroesse: 32 });
    await cutter.connect();
    const senden = cutter.send(job, {
      onFortschritt: (gesendet) => {
        if (gesendet > 0) void cutter.cancel();
      },
    });
    await expect(senden).rejects.toThrow(AbbruchFehler);
    expect(alles(cutter)).not.toContain('TB50,0<ETX>L0');
  });

  it('lehnt fehlerhafte Aufträge ab, bevor etwas gesendet wird', async () => {
    const cutter = new SimulatedCutter();
    await cutter.connect();
    const vorher = cutter.simulation.empfangen.length;
    const zuGross: CutJob = { ...job, pfade: [[{ x: 0, y: 0 }, { x: 999, y: 0 }]] };
    await expect(cutter.send(zuGross)).rejects.toThrow(/außerhalb/);
    expect(cutter.simulation.empfangen.length).toBe(vorher);
  });

  it('protokolliert gesendete und empfangene Nachrichten', async () => {
    const protokoll: ProtokollEintrag[] = [];
    const cutter = new SimulatedCutter({}, { onProtokoll: (e) => protokoll.push(e) });
    await cutter.connect();
    await cutter.status();
    expect(protokoll.map((e) => e.richtung)).toEqual([
      'gesendet', // ESC EOT
      'gesendet', // FG
      'empfangen', // CAMEO 4 V1.00
      'info', // verbunden
      'gesendet', // ESC ENQ
      'empfangen', // 0
    ]);
  });

  it('verweigert das Senden ohne Verbindung', async () => {
    await expect(new SimulatedCutter().send(job)).rejects.toThrow(/nicht verbunden/);
  });
});
