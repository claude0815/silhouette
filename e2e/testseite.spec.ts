import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { sammleFehler } from './hilfen';

test.describe('Testseite Machbarkeitstest', () => {
  test('Simulation, Abbruch, Checkliste, Bericht und DXF', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./cutter-test.html');
    await page.getByRole('button', { name: 'Simulation starten' }).click();
    await expect(page.getByTestId('geraet')).toContainText('Cameo 4 (Simulation)');

    await page.getByRole('button', { name: 'Quadrat zeichnen' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('alert')).toContainText('abgebrochen');

    await page.getByLabel('Notiz 2').fill('50,0 mm gemessen');
    await page.locator('.checkliste input[type=checkbox]').nth(1).check();
    const [bericht] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bericht herunterladen' }).click()]);
    const text = readFileSync((await bericht.path())!, 'utf8');
    expect(text).toContain('- [x] Mit Stift ein Quadrat');
    expect(text).toContain('> 50,0 mm gemessen');

    const [dxf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'DXF mit Polylinien herunterladen' }).click()]);
    expect(readFileSync((await dxf.path())!, 'utf8').startsWith('0\r\nSECTION\r\n2\r\nHEADER')).toBe(true);

    await page.reload();
    await expect(page.locator('.checkliste input[type=checkbox]').nth(1)).toBeChecked();
    expect(fehler).toEqual([]);
  });
});
