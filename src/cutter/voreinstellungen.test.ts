import { describe, expect, it } from 'vitest';
import { pruefeVoreinstellung, VOREINSTELLUNGEN } from './voreinstellungen';

describe('Voreinstellungen', () => {
  it('alle mitgelieferten Werte liegen im erlaubten Bereich und haben eine Quelle', () => {
    for (const v of VOREINSTELLUNGEN) {
      expect(pruefeVoreinstellung(v), v.id).toEqual([]);
      expect(v.quelle.length, v.id).toBeGreaterThan(5);
    }
  });

  it('die erste Voreinstellung ist der Stift (erste Versuche mit Stift)', () => {
    expect(VOREINSTELLUNGEN[0]!.werkzeug.art).toBe('stift');
  });

  it('solange nicht am Gerät geprüft, sind alle als Schätzwert gekennzeichnet', () => {
    expect(VOREINSTELLUNGEN.every((v) => v.geprueft === false)).toBe(true);
  });

  it('meldet ungültige eigene Werte', () => {
    const fehler = pruefeVoreinstellung({ id: 'x', name: '', werkzeug: { art: 'messer', druck: 50, geschwindigkeit: 0 }, quelle: 'eigen', geprueft: false });
    expect(fehler).toHaveLength(3);
  });
});
