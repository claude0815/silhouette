import { expect, test } from '@playwright/test';
import { oeffneWerkstatt, sammleFehler } from './hilfen';

test.describe('Schneiden (mit simuliertem Gerät)', () => {
  test('verbinden, Testfahrt, Messer mit Rückfrage, Abbrechen, vollständiger Auftrag', async ({ page }) => {
    const fehler = sammleFehler(page);
    const dialoge: string[] = [];
    page.on('dialog', async (d) => {
      dialoge.push(d.type());
      if (d.type() === 'prompt') await d.accept('Mein Karton');
      else await d.accept();
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Schneiden', exact: true }).click();
    await expect(page.getByTestId('schneiden-knopf')).toBeDisabled();

    await page.getByRole('button', { name: 'Per USB' }).click();
    await expect(page.getByTestId('schneiden-meldung')).toContainText('Es wurde kein Gerät ausgewählt');

    await page.getByRole('button', { name: 'Ohne Gerät (Simulation)' }).click();
    await expect(page.getByTestId('kopf-status')).toContainText('Cameo 4 (Simulation) · bereit');

    await page.getByRole('button', { name: 'Testfahrt' }).click();
    await expect(page.getByText('Testfahrt beendet.')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('voreinstellung').selectOption('karton');
    await expect(page.getByText(/Schätzwert/)).toBeVisible();
    await page.getByTestId('schneiden-knopf').click();
    await expect(page.getByTestId('kopf-status')).toContainText('arbeitet');
    await page.getByTestId('abbrechen-knopf').click();
    await expect(page.getByTestId('schneiden-meldung')).toContainText('Abgebrochen');

    await page.getByTestId('schneiden-knopf').click();
    await expect(page.getByText('Auftrag vollständig übertragen.')).toBeVisible({ timeout: 60_000 });
    expect(dialoge).toEqual(['confirm']); // nur beim ersten Messerschnitt

    await page.getByRole('button', { name: 'Als eigene Voreinstellung speichern …' }).click();
    await expect(page.getByTestId('voreinstellung').locator('option:checked')).toHaveText('Mein Karton');
    expect(fehler).toEqual([]);
  });

  test('Motiv außerhalb der Matte wird gesperrt', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./');
    await oeffneWerkstatt(page);
    await page.getByRole('button', { name: 'Beispiele' }).click();
    await page.getByTestId('beispiel-matte').getByRole('button', { name: 'Laden' }).click();
    await page.getByRole('button', { name: 'Schneiden', exact: true }).click();
    await expect(page.getByTestId('auftrag-fehler')).toContainText('außerhalb des Schneidebereichs');
    await expect(page.locator('.matte-pfad.draussen')).toHaveCount(1);
  });
});
