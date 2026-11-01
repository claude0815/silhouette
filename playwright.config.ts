/**
 * Browsertests (Playwright) für den gebauten Stand der App.
 * Lokal: npm run test:e2e (baut vorher). In GitHub Actions läuft der Build schon vorher.
 */
import { defineConfig, devices } from '@playwright/test';

const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  // Nacheinander: Ein Test ändert für den Update-Test kurz dist/sw.js
  workers: 1,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/silhouette/',
    viewport: { width: 1366, height: 820 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } } }],
  webServer: {
    command: ci ? 'npm run preview -- --port 4173 --strictPort' : 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/silhouette/',
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
