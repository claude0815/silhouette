import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fertig, oeffneWerkstatt } from './hilfen';

async function warteAufServiceWorker(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
}

test.describe('Offline (PWA)', () => {
  test('nach dem ersten Besuch funktioniert alles ohne Netz', async ({ page, context }) => {
    await page.goto('./');
    await warteAufServiceWorker(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Vom Pixel zum Schnitt');
    await page.getByRole('button', { name: 'Beispielbild verwenden' }).click();
    await fertig(page);
    await expect(page.locator('.schritt-knopf .zeit')).toHaveCount(7); // Rechen-Worker
    await oeffneWerkstatt(page); // nachgeladener Teil
    await page.getByRole('tab', { name: 'Programm' }).click();
    await expect(page.getByTestId('programmstatus')).toContainText('Formen erzeugt'); // Programm-Worker
    await page.goto('./cutter-test.html');
    await expect(page.locator('h1')).toHaveText('Machbarkeitstest Cutter');
  });

  test('neue Version: Hinweis, dann neu laden', async ({ page }) => {
    await page.goto('./');
    await warteAufServiceWorker(page);
    const datei = 'dist/sw.js';
    const alt = readFileSync(datei, 'utf8');
    try {
      writeFileSync(datei, alt.replace(/const VERSION = '[^']+'/, "const VERSION = 'test-neu'"));
      await page.reload();
      await expect(page.getByTestId('update-hinweis')).toBeVisible({ timeout: 15_000 });
      await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Jetzt neu laden' }).click()]);
      await expect(page.getByTestId('update-hinweis')).toHaveCount(0);
      expect(await page.evaluate(async () => (await caches.keys()).join())).toBe('vom-pixel-zum-schnitt-test-neu');
    } finally {
      writeFileSync(datei, alt);
    }
  });
});
