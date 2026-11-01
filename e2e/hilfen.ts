/** Gemeinsame Hilfen für die Browsertests. */
import { expect, type Page } from '@playwright/test';

/** Wartet, bis der Rechen-Worker fertig ist. */
export async function fertig(page: Page): Promise<void> {
  await expect(page.locator('.rechnet')).toHaveCount(0, { timeout: 30_000 });
}

/** Bildschirmpunkt auf der gezeichneten Linie einer Form der Werkstatt-Vorschau (anteil 0…1 entlang des Pfads). */
export function aufLinie(page: Page, testid: string, anteil: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([id, f]) => {
      const pfad = document.querySelector(`[data-testid="${id}"] path.wf`) as SVGPathElement;
      const pt = pfad.getPointAtLength(pfad.getTotalLength() * (f as number));
      const s = new DOMPoint(pt.x, pt.y).matrixTransform(pfad.getScreenCTM()!);
      return { x: s.x, y: s.y };
    },
    [testid, anteil] as const,
  );
}

/** Öffnet die Werkstatt und wartet auf den Editor. */
export async function oeffneWerkstatt(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'SVG-Werkstatt' }).click();
  await expect(page.getByTestId('editor').locator('.cm-content')).toBeVisible();
}

/** Inhalt des Code-Editors */
export function editorText(page: Page): Promise<string> {
  return page.getByTestId('editor').locator('.cm-content').innerText();
}

/** Ersetzt den ganzen Editorinhalt durch Tippen (wie ein Mensch, aber schnell). */
export async function tippeInEditor(page: Page, text: string): Promise<void> {
  await page.getByTestId('editor').locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
}

/** Sammelt Seitenfehler und Konsolenfehler; am Ende des Tests mit expect(fehler).toEqual([]) prüfen. */
export function sammleFehler(page: Page): string[] {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Bewusst ausgelöste Ladefehler (Offline-Test) nicht mitzählen
    if (m.type() === 'error' && !m.text().includes('ERR_INTERNET_DISCONNECTED')) fehler.push(`console: ${m.text()}`);
  });
  return fehler;
}
