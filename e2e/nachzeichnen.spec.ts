import { expect, test } from '@playwright/test';
import { fertig, sammleFehler } from './hilfen';

test.describe('Nachzeichnen', () => {
  test('Beispielbild durch alle acht Schritte', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'Beispielbild verwenden' }).click();
    await fertig(page);
    await expect(page.locator('.schritt-knopf .zeit')).toHaveCount(7);

    await page.locator('.schritt-knopf').nth(2).click();
    await expect(page.getByTestId('histogramm')).toBeVisible();

    await page.locator('.schritt-knopf').nth(4).click();
    await expect(page.getByTestId('konturen')).toHaveText(/^6 Außenkonturen, 1 Innenkontur \(Loch\)/);

    // Marching Squares: Ausschnitt wählen und einen Schritt weiter
    const c = (await page.locator('.bildansicht canvas').boundingBox())!;
    await page.mouse.click(c.x + (c.width * 510) / 640, c.y + (c.height * 30) / 400);
    await page.getByRole('button', { name: 'Einzelschritt' }).click();
    await expect(page.getByTestId('ms-zelle')).toContainText('Fall');

    // Vereinfachen: größere Toleranz → weniger Punkte
    await page.locator('.schritt-knopf').nth(5).click();
    const vorher = await page.getByTestId('punktzahl').innerText();
    await page.getByRole('spinbutton', { name: 'Toleranz (Pixel)' }).fill('3');
    await page.getByRole('spinbutton', { name: 'Toleranz (Pixel)' }).press('Enter');
    await fertig(page);
    await expect(page.getByTestId('punktzahl')).not.toHaveText(vorher);

    // SVG: Codezeile ↔ Form verknüpft
    await page.locator('.schritt-knopf').nth(7).click();
    await page.locator('.code-befehl').nth(5).hover();
    await expect(page.locator('.befehl-linie')).toHaveCount(1);
    await expect(page.getByTestId('befehl-info')).toContainText('Bézier-Kurve');
    expect(fehler).toEqual([]);
  });

  test('Foto hochladen und zuschneiden', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./');
    await page.getByTestId('datei').setInputFiles('e2e/daten/foto.jpg');
    await expect(page.getByText('foto.jpg')).toBeVisible();
    await fertig(page);
    await page.getByRole('button', { name: 'Zuschneiden …' }).click();
    const felder = page.getByTestId('zuschnitt').locator('input');
    await felder.nth(2).fill('150');
    await felder.nth(2).press('Enter');
    await page.getByRole('button', { name: 'Übernehmen' }).click();
    await fertig(page);
    await expect(page.locator('.seite .kasten').first()).toContainText('150 × 200 Pixel');
    await page.getByRole('button', { name: 'Zuschnitt aufheben' }).click();
    await expect(page.locator('.seite .kasten').first()).toContainText('300 × 200 Pixel');
    expect(fehler).toEqual([]);
  });
});
