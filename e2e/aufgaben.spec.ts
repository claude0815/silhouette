import { expect, test } from '@playwright/test';
import { aufLinie, oeffneWerkstatt, tippeInEditor } from './hilfen';

test.describe('Beispiele und Aufgaben', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./');
    await oeffneWerkstatt(page);
    await page.getByRole('button', { name: 'Beispiele' }).click();
  });

  test('Aufgabe durch Tippen lösen', async ({ page }) => {
    await page.getByTestId('beispiel-rechteck').getByRole('button', { name: 'Laden' }).click();
    const aufgabe = page.getByTestId('aufgabe-rechteck-breite40');
    await expect(aufgabe.locator('.haken')).toHaveText('○');
    await tippeInEditor(page, '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60"><rect x="10" y="10" width="40" height="20" fill="none" stroke="black"/></svg>');
    await expect(aufgabe.locator('.haken')).toHaveText('✓');
  });

  test('Aufgabe durch Ziehen der Kontrollpunkte lösen', async ({ page }) => {
    await page.getByTestId('beispiel-bezier').getByRole('button', { name: 'Laden' }).click();
    await page.getByRole('button', { name: 'Pfad-Erklärer' }).click();
    const pt = await aufLinie(page, 'wf-0', 0.5);
    await page.mouse.click(pt.x, pt.y);
    for (const nr of [1, 2]) {
      const g = (await page.getByTestId(`griff-${nr}`).boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + g.width / 2, g.y - 200, { steps: 8 });
      await page.mouse.up();
    }
    await page.getByRole('button', { name: 'Beispiele' }).click();
    await expect(page.getByTestId('aufgabe-bezier-nachOben').locator('.haken')).toHaveText('✓');
  });

  test('Musterlösung laden', async ({ page }) => {
    await page.getByTestId('beispiel-schablone').getByRole('button', { name: 'Laden' }).click();
    await page.getByTestId('aufgabe-schablone-bruecken').getByText('Tipp').click();
    await page.getByRole('button', { name: 'Lösung laden' }).click();
    await expect(page.getByTestId('aufgabe-schablone-bruecken').locator('.haken')).toHaveText('✓');
  });
});
