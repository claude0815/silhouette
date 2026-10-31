/**
 * Alle Texte der Oberfläche an einer Stelle.
 * Eine englische Fassung kann später als en.ts mit derselben Struktur ergänzt werden.
 */
export const de = {
  app: {
    titel: 'Vom Pixel zum Schnitt',
    untertitel: 'Wie aus einem Pixelbild Schnittpfade für einen Schneideplotter werden',
    inArbeit: 'Die App befindet sich im Aufbau.',
    quellcode: 'Quellcode auf GitHub',
    lizenz: 'Lizenz: GPL-2.0-or-later',
  },
  cutterTest: {
    titel: 'Machbarkeitstest Cutter',
    beschreibung:
      'Diese Seite prüft, ob sich ein Silhouette-Cutter direkt aus dem Browser ansteuern lässt (WebUSB und Web Bluetooth).',
    umgebung: 'Umgebung',
    sichererKontext: 'Sicherer Kontext (HTTPS oder localhost)',
    webUsb: 'WebUSB',
    webBluetooth: 'Web Bluetooth',
    vorhanden: 'vorhanden',
    fehlt: 'fehlt',
    hinweisBrowser:
      'WebUSB und Web Bluetooth gibt es nur in Chrome und Edge. In Firefox und Safari funktionieren nur Simulation und Datei-Export.',
    zurApp: 'Zur App',
  },
} as const;

export type Texte = typeof de;
export const t: Texte = de;
