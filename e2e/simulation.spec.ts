import { expect, test } from '@playwright/test';
import { fertig, sammleFehler } from './hilfen';

test.describe('Simulation', () => {
  test('abspielen, Reihenfolgen vergleichen, Warnung und Fehler', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'Beispielbild verwenden' }).click();
    await fertig(page);
    await page.getByRole('button', { name: 'Simulation', exact: true }).click();
    await expect(page.getByTestId('sim-vergleich')).toContainText('Nächster Nachbar');

    await page.locator('select').filter({ hasText: '50×' }).selectOption('50');
    await page.getByRole('button', { name: 'Abspielen' }).click();
    await expect(page.getByTestId('sim-zeit')).toHaveText(/^(.+) von \1$/, { timeout: 10_000 }); // am Ende angekommen
    await expect(page.locator('.befehl.aktuell')).toHaveText(/M0,0/);

    await page.getByLabel('Original (wie im SVG)').check();
    await expect(page.getByTestId('sim-warnung')).toContainText('Außenkontur');
    await page.getByLabel('Nächster Nachbar').check();
    await expect(page.getByTestId('sim-warnung')).toHaveCount(0);

    await page.locator('select').filter({ hasText: 'Portrait 3' }).selectOption('portrait3');
    await page.getByRole('button', { name: 'Nachzeichnen', exact: true }).click();
    await page.locator('.schritt-knopf').nth(7).click();
    await page.getByRole('spinbutton', { name: 'Breite (mm)' }).fill('250');
    await page.getByRole('spinbutton', { name: 'Breite (mm)' }).press('Enter');
    await fertig(page);
    await page.getByRole('button', { name: 'Simulation', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('außerhalb des Schneidebereichs');
    expect(fehler).toEqual([]);
  });
});
