import { expect, test } from '@playwright/test';
import { aufLinie, editorText, oeffneWerkstatt, sammleFehler, tippeInEditor } from './hilfen';

test.describe('SVG-Werkstatt', () => {
  test('schnelles Tippen verliert keine Zeichen', async ({ page }) => {
    await page.goto('./');
    await oeffneWerkstatt(page);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="30mm" viewBox="0 0 50 30"><rect x="5" y="5" width="40" height="20" fill="none" stroke="black"/></svg>';
    await tippeInEditor(page, svg);
    await expect.poll(() => editorText(page)).toContain('width="40" height="20" fill="none" stroke="black"/>');
    await expect(page.getByTestId('quelle')).toContainText('Eigene Fassung');
  });

  test('Fehler an der Stelle, Vorschau bleibt', async ({ page }) => {
    await page.goto('./');
    await oeffneWerkstatt(page);
    await tippeInEditor(page, '<svg width="50mm" height="30mm" viewBox="0 0 50 30"><path d="M 5 5 L 40 5 L 40 25 Q"/></svg>');
    await expect(page.getByTestId('hinweisliste')).toContainText('Befehl Q erwartet 4 Zahlen');
    // Die Markierung sitzt auf dem „Q“ (CodeMirror kann sie in mehrere Teile zerlegen)
    await expect(page.locator('.cm-fehler').filter({ hasText: 'Q' })).toHaveCount(1);
    await expect(page.locator('.wf')).toHaveCount(1);
  });

  test('Form auswählen, Punkt ziehen, Code ändert sich mit', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./');
    await oeffneWerkstatt(page);
    const pt = await aufLinie(page, 'wf-2', 0.1);
    await page.mouse.click(pt.x, pt.y);
    await expect(page.getByTestId('erklaerer')).toContainText('<path> · Element 3');
    const g = (await page.getByTestId('griff-1').boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + 60, g.y + 30, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => editorText(page)).not.toContain('L 30 40');
    await expect(page.getByTestId('erklaerer')).toBeVisible(); // Auswahl bleibt
    expect(fehler).toEqual([]);
  });

  test('SVG-Datei mit Gruppe, transform und Formen öffnen; bleibt nach Neuladen', async ({ page }) => {
    await page.goto('./');
    await oeffneWerkstatt(page);
    await page.getByTestId('svg-datei').setInputFiles({
      name: 'test.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2in" height="1in" viewBox="0 0 200 100"><g transform="translate(100 50) rotate(45)"><rect x="-20" y="-20" width="40" height="40" rx="5"/></g><ellipse cx="40" cy="50" rx="30" ry="15" fill="none" stroke="blue"/><polygon points="160,20 190,80 130,80"/><text x="5" y="95">Hallo</text></svg>',
      ),
    });
    await expect(page.locator('.wf')).toHaveCount(3);
    await expect(page.getByTestId('hinweisliste')).toContainText('Text wird nicht geschnitten');
    await page.waitForTimeout(500);
    await page.reload();
    await oeffneWerkstatt(page);
    await expect(page.locator('.wf')).toHaveCount(3);
  });

  test('Cutter-Checks markieren Stellen; Brücken halten die Insel fest', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./');
    await oeffneWerkstatt(page);
    await page.getByRole('button', { name: 'Beispiele' }).click();
    await page.getByTestId('beispiel-schablone').getByRole('button', { name: 'Laden' }).click();
    await page.getByRole('button', { name: 'Cutter-Checks' }).click();
    await expect(page.getByTestId('befund-inseln')).toHaveClass(/info/);
    await page.getByTestId('befund-loecher').hover();
    await expect(page.locator('.befund-stelle')).toHaveCount(1);
    await page.getByTestId('bruecken').getByRole('button', { name: 'Brücken setzen' }).click();
    await expect(page.getByTestId('befund-inseln')).toHaveClass(/ok/);
    await expect(page.getByTestId('bruecken-ergebnis')).toContainText('1 Insel');
  });
  test('Konturen versetzen fügt eine rote Kontur ein und zeigt die Abstandskarte', async ({ page }) => {
    const fehler = sammleFehler(page);
    await page.goto('./');
    await oeffneWerkstatt(page);
    await tippeInEditor(page, '<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="60mm" viewBox="0 0 60 60"><rect x="20" y="20" width="20" height="20"/></svg>');
    await expect.poll(() => editorText(page)).toContain('height="20"/></svg>');
    await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click();
    await page.getByTestId('versatz-abstand').fill('5');
    await page.getByTestId('versatz-abstand').blur();
    await page.getByTestId('versatz-los').click();
    await expect(page.getByTestId('versatz-ergebnis')).toContainText('1 Kontur eingefügt');
    await expect(page.getByTestId('abstandskarte')).toBeVisible();
    await expect.poll(() => editorText(page)).toContain('5 mm nach außen versetzt');
    await expect.poll(() => editorText(page)).toContain('<rect');
    expect(fehler).toEqual([]);
  });
});
