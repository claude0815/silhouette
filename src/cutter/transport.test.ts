import { describe, expect, it } from 'vitest';
import { bytesAlsText } from './gpgl';
import { Empfangspuffer } from './transport';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('Empfangspuffer', () => {
  it('setzt zerstückelte Pakete zu einer Antwort zusammen', async () => {
    const p = new Empfangspuffer();
    p.hinzufuegen(bytes('CAM'));
    p.hinzufuegen(bytes('EO 4\x030\x03'));
    expect(bytesAlsText((await p.lese(10))!)).toBe('CAMEO 4<ETX>');
    expect(bytesAlsText((await p.lese(10))!)).toBe('0<ETX>');
  });

  it('wartet auf Daten, die später kommen', async () => {
    const p = new Empfangspuffer();
    setTimeout(() => p.hinzufuegen(bytes('1\x03')), 5);
    expect(bytesAlsText((await p.lese(1000))!)).toBe('1<ETX>');
  });

  it('liefert null nach Ablauf der Zeit', async () => {
    const p = new Empfangspuffer();
    p.hinzufuegen(bytes('ohne Ende'));
    expect(await p.lese(10)).toBeNull();
  });

  it('weckt Wartende beim Schließen', async () => {
    const p = new Empfangspuffer();
    const lesen = p.lese(10_000);
    p.schliessen();
    expect(await lesen).toBeNull();
  });
});
