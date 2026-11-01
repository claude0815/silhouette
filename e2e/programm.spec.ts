import { expect, test } from '@playwright/test';
import { oeffneWerkstatt, sammleFehler, tippeInEditor } from './hilfen';

test.describe('SVG per Programm', () => {
  test('Vorlage, Fehler mit Zeile, Endlosschleife, Ausgabe als Dokument', async ({ page }) => {
    const fehler = sammleFehler(page);
    page.on('dialog', (d) => d.accept());
    await page.goto('./');
    await oeffneWerkstatt(page);
    await page.getByRole('tab', { name: 'Programm' }).click();
    await expect(page.getByTestId('programmstatus')).toContainText('4 Formen erzeugt');
    await expect(page.locator('.wf')).toHaveCount(4);

    await tippeInEditor(page, 'papier(50, 50);\nkreis(25, 25, 10);\nkreiss(1, 2, 3);');
    await expect(page.getByTestId('programmfehler')).toContainText('Zeile 3');
    await expect(page.getByTestId('programmfehler')).toContainText('kreiss is not defined');

    await tippeInEditor(page, 'papier(50, 50);\nwhile (true) {}');
    await expect(page.getByText(/vielleicht eine Endlosschleife/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cutter-Checks' }).click();
    await expect(page.getByTestId('checks')).toBeVisible(); // Seite reagiert weiter

    await page.getByTestId('programmvorlage').selectOption('stern');
    await expect(page.getByTestId('programmstatus')).toContainText('2 Formen erzeugt');
    await page.getByRole('button', { name: 'Simulation', exact: true }).click();
    await expect(page.getByTestId('sim-kennzahlen')).toContainText('Pfade2');
    expect(fehler).toEqual([]);
  });
});
