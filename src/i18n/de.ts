/**
 * Alle Texte der Oberfläche an einer Stelle.
 * Eine englische Fassung kann später als en.ts mit derselben Struktur ergänzt werden.
 * Texte mit Platzhaltern sind Funktionen.
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
    zurApp: 'Zur App',

    umgebung: 'Umgebung',
    sichererKontext: 'Sicherer Kontext (HTTPS oder localhost)',
    webUsb: 'WebUSB',
    webBluetooth: 'Web Bluetooth',
    vorhanden: 'vorhanden',
    fehlt: 'fehlt',
    betriebssystem: 'Betriebssystem',
    hinweisBrowser:
      'WebUSB und Web Bluetooth gibt es nur in Chrome und Edge. In Firefox und Safari funktionieren nur Simulation und Datei-Export.',
    hinweisWindows:
      'Windows: Per USB klappt es meist nicht, weil der Druckertreiber das Gerät belegt. Bluetooth versuchen und das Verhalten von USB trotzdem im Protokoll festhalten.',
    hinweisMac: 'macOS: Silhouette Studio vorher schließen, damit es das Gerät nicht belegt.',
    hinweisSicherheit: 'Erste Versuche immer mit Stift statt Messer.',

    verbindung: 'Verbindung',
    perUsb: 'Per USB verbinden',
    perBluetooth: 'Per Bluetooth verbinden',
    alleBluetooth: 'Alle Bluetooth-Geräte anzeigen (falls der Cutter nicht erscheint)',
    simulation: 'Simulation starten',
    trennen: 'Trennen',
    verbindet: 'Verbinde …',
    nichtVerbunden: 'Nicht verbunden.',
    verbundenMit: (name: string) => `Verbunden mit ${name}`,
    firmware: 'Firmware',
    modell: 'Erkanntes Modell',
    unbekanntesModell: 'nicht erkannt – vorsichtige Standardwerte',
    tipp: 'Tipp',
    technisch: 'Meldung des Browsers',

    status: 'Status',
    statusAbfragen: 'Status abfragen',
    statusTexte: {
      bereit: 'bereit',
      'in-bewegung': 'in Bewegung',
      'keine-matte': 'keine Matte bzw. kein Material eingelegt',
      unbekannt: 'unbekannt',
    } as Record<string, string>,
    rohantwort: 'Rohantwort',

    testauftrag: 'Testauftrag: Quadrat',
    seite: 'Seitenlänge (mm)',
    abstand: 'Abstand vom Mattenrand (mm)',
    werkzeug: 'Werkzeug',
    stift: 'Stift',
    messer: 'Messer',
    warnungMesser: 'Achtung: Messer schneidet in Matte und Material. Erst mit Stift testen!',
    druck: 'Druck (1–33)',
    geschwindigkeit: 'Geschwindigkeit (1–30)',
    halter: 'Werkzeughalter',
    matte: 'Schneidematte',
    befehle: 'Befehle, die gesendet werden',
    zeichnen: 'Quadrat zeichnen',
    abbrechen: 'Abbrechen',
    zuruecksetzen: 'Zurücksetzen senden (ESC EOT)',
    zuruecksetzenErklaerung:
      'Für den Test der Abbruch-Reaktion: Was macht das Gerät, wenn mitten im Auftrag initialisiert wird?',
    fortschritt: (prozent: number) => `Übertragen: ${prozent} %`,
    fertig: 'Auftrag vollständig übertragen. Jetzt nachmessen: Ist das Quadrat genau so groß wie eingestellt?',
    vorschau: 'Lage auf der Matte',

    protokoll: 'Protokoll',
    protokollLeer: 'Noch keine Einträge.',
    kopieren: 'Kopieren',
    kopiert: 'Kopiert',
    leeren: 'Leeren',

    checkliste: 'Checkliste Machbarkeitstest',
    checklisteHinweis: 'Häkchen und Notizen werden nur in diesem Browser gespeichert.',
    notiz: 'Notiz',
    bericht: 'Bericht herunterladen',
    berichtKopieren: 'Bericht kopieren',
    punkte: [
      'macOS mit Chrome: Cutter per WebUSB finden, Interface belegen, Statusabfrage senden.',
      'Mit Stift ein Quadrat von 50 mm zeichnen und die Maße nachmessen.',
      'Dasselbe per Web Bluetooth, auf macOS und auf einem Windows-PC.',
      'Windows ohne Adminrechte: Verhalten von WebUSB dokumentieren, inklusive Fehlermeldung.',
      'Prüfen, ob Silhouette Studio danach normal weiter funktioniert.',
      'Reaktion des Geräts auf einen Abbruch mitten im Auftrag prüfen.',
      'Mit allen Cutter-Modellen der Schule wiederholen.',
      'Exportierte DXF-Datei in Silhouette Studio öffnen: Maße und Pfade stimmen.',
    ],
  },
} as const;

export type Texte = typeof de;
export const t: Texte = de;
