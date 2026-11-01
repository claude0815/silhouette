/**
 * Vite-Plugin für die Offline-Fähigkeit: Schreibt beim Bauen sw.js mit der Liste aller
 * erzeugten Dateien und einer Versionskennung (Prüfsumme über die Dateinamen).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

function dateienIn(ordner: string, praefix = ''): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateienIn(join(ordner, e.name), `${praefix}${e.name}/`) : [`${praefix}${e.name}`],
  );
}

export function offline(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'vom-pixel-zum-schnitt:offline',
    apply: 'build',
    // Zuletzt laufen: Erst dann hat Vite auch die HTML-Seiten in den Build aufgenommen
    enforce: 'post',
    configResolved(c) {
      config = c;
    },
    generateBundle(_optionen, bundle) {
      const oeffentlich = config.publicDir ? dateienIn(config.publicDir) : [];
      const dateien = [...new Set(['./', ...Object.keys(bundle), ...oeffentlich].map((f) => (f === './' ? f : `./${f}`)))]
        .filter((f) => !f.endsWith('.map'))
        .sort();
      // Versionskennung aus Namen und Inhalten: Ändert sich irgendeine Datei, gibt es eine neue Version
      const pruefsumme = createHash('sha256').update(dateien.join('\n'));
      for (const teil of Object.values(bundle)) pruefsumme.update(teil.type === 'chunk' ? teil.code : teil.source);
      for (const f of oeffentlich) pruefsumme.update(readFileSync(join(config.publicDir, f)));
      const version = pruefsumme.digest('hex').slice(0, 12);
      const vorlage = readFileSync(join(config.root, 'src/offline/service-worker.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const VERSION = '${version}';\nconst DATEIEN = ${JSON.stringify(dateien, null, 1)};\n${vorlage}`,
      });
    },
  };
}
