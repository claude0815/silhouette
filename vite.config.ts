/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { offline } from './offline-plugin';

// GitHub Pages liefert die Seite unter https://<nutzer>.github.io/silhouette/ aus.
// Deshalb müssen alle Pfade im Build mit /silhouette/ beginnen.
// Das gilt auch für "npm run preview", damit man den Build genau so sieht wie online.
// Nur im Entwicklungsserver (npm run dev) bleibt der Pfad "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/silhouette/',
  plugins: [preact(), offline()],
  build: {
    rollupOptions: {
      // Zwei Einstiegspunkte: die eigentliche App und die Testseite für Stufe 0.
      input: {
        main: 'index.html',
        cutterTest: 'cutter-test.html',
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}));
