/**
 * Alle Texte der Oberfläche an einer Stelle.
 * Eine englische Fassung kann später als en.ts mit derselben Struktur ergänzt werden.
 * Texte mit Platzhaltern sind Funktionen.
 */
/** Dauer in Sekunden als „1 min 05 s“ bzw. „12,3 s“. */
export function formatiereDauer(s: number): string {
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(Math.round(s - 60 * m)).padStart(2, '0')} s`;
}

/** Länge in mm, ab 1 m in m. */
export function formatiereLaenge(mm: number): string {
  return mm >= 1000 ? `${(mm / 1000).toFixed(2).replace('.', ',')} m` : `${Math.round(mm)} mm`;
}

export const de = {
  app: {
    titel: 'Vom Pixel zum Schnitt',
    untertitel: 'Wie aus einem Pixelbild Schnittpfade für einen Schneideplotter werden',
    quellcode: 'Quellcode auf GitHub',
    lizenz: 'Lizenz: GPL-2.0-or-later',
    cutterTest: 'Machbarkeitstest Cutter',
    ueber: 'Über und Lizenzen',
    rechnet: 'rechnet …',
    rechenzeit: (ms: number) => `${ms.toFixed(0)} ms`,
    fehler: 'Fehler',
    wieFunktioniert: 'Wie funktioniert das?',
    vorher: 'vorher',
    nachher: 'nachher',
    weiter: 'Weiter',
    zurueck: 'Zurück',
    alsPng: 'Bild speichern (PNG)',
    alsJson: 'Daten speichern (JSON)',
    alsCsv: 'Matrix speichern (CSV)',
    zoomHinweis: 'Mausrad: zoomen · Ziehen: verschieben · Doppelklick: ganzes Bild',
    pixel: (x: number, y: number) => `Pixel (${x} | ${y})`,
    keinPixel: 'Mit der Maus über das Bild fahren, um Werte zu sehen.',
    ausschnitt: 'Ausschnitt um das Pixel',

    schritte: [
      'Bild laden',
      'Graustufen',
      'Schwellwert',
      'Entrauschen',
      'Konturen finden',
      'Vereinfachen',
      'Glätten',
      'SVG erzeugen',
      'Simulation',
    ],

    laden: {
      ziehen: 'Bild hierher ziehen (PNG oder JPG)',
      oder: 'oder',
      waehlen: 'Datei wählen',
      beispiel: 'Beispielbild verwenden',
      verkleinert: (b: number, h: number, ob: number, oh: number) =>
        `Das Bild wurde von ${ob} × ${oh} auf ${b} × ${h} Pixel verkleinert, damit es flüssig bleibt.`,
      groesse: (b: number, h: number) => `${b} × ${h} Pixel = ${(b * h).toLocaleString('de-DE')} Pixel`,
      ungueltig: 'Diese Datei konnte nicht als Bild gelesen werden.',
      bleibtLokal: 'Das Bild bleibt auf diesem Gerät. Es wird nichts hochgeladen.',
      zuschnitt: 'Zuschnitt',
      zuschneiden: 'Zuschneiden …',
      zuschnittHinweis: 'Im Bild ein Rechteck aufziehen oder die Werte eingeben.',
      uebernehmen: 'Übernehmen',
      abbrechen: 'Abbrechen',
      aufheben: 'Zuschnitt aufheben',
      zuschnittInfo: (x: number, y: number, b: number, h: number) => `Ausschnitt ${b} × ${h} Pixel ab (${x} | ${y}) des Originals`,
      links: 'Links (x)',
      oben: 'Oben (y)',
      breite: 'Breite',
      hoehe: 'Höhe',
      erklaerung: [
        'Ein Rasterbild ist eine Tabelle aus Pixeln. Jedes Pixel hat drei Farbwerte: Rot, Grün und Blau, jeweils von 0 bis 255. Dazu kommt bei PNG oft ein vierter Wert für die Deckkraft (Alpha).',
        'Die Auflösung gibt an, wie viele Pixel das Bild hat. Mehr Pixel bedeuten feinere Details, aber auch mehr Rechenarbeit.',
        'Zoome hinein, bis du einzelne Pixel siehst: Die Werte stehen rechts in der Datenansicht.',
      ],
    },
    grau: {
      verfahren: 'Verfahren',
      mittelwert: 'Mittelwert',
      luminanz: 'Gewichtete Luminanz',
      formel: 'Formel',
      rechnung: 'Rechnung für das Pixel',
      erklaerung: [
        'Für die Konturen zählt nur, ob ein Pixel hell oder dunkel ist. Darum wird aus den drei Farbwerten ein einziger Helligkeitswert (Grauwert) von 0 (schwarz) bis 255 (weiß).',
        'Der Mittelwert behandelt alle drei Farben gleich. Unser Auge empfindet aber Grün viel heller als Blau. Die gewichtete Luminanz berücksichtigt das mit den Gewichten 0,299 (Rot), 0,587 (Grün) und 0,114 (Blau).',
        'Durchsichtige Pixel werden so behandelt, als lägen sie auf weißem Papier.',
      ],
    },
    schwelle: {
      automatisch: 'Automatisch (Otsu)',
      schwellwert: 'Schwellwert',
      invertieren: 'Invertieren (helle Bereiche schneiden)',
      histogramm: 'Histogramm: Anzahl der Pixel je Grauwert',
      otsuWert: (t: number) => `Otsu schlägt ${t} vor`,
      vordergrund: (n: number, anteil: number) =>
        `${n.toLocaleString('de-DE')} Pixel Vordergrund (${(anteil * 100).toFixed(1).replace('.', ',')} %)`,
      erklaerung: [
        'Jedes Pixel wird mit dem Schwellwert verglichen: Ist es dunkler, wird es Vordergrund (1) und später ausgeschnitten, sonst Hintergrund (0). So entsteht ein Schwarz-Weiß-Bild.',
        'Das Histogramm zeigt, wie viele Pixel welche Helligkeit haben. Bei einem typischen Logo gibt es zwei „Berge“: einen für die dunklen und einen für die hellen Pixel. Ein guter Schwellwert liegt im Tal dazwischen.',
        'Das Otsu-Verfahren probiert alle 256 Schwellwerte aus und wählt den, bei dem sich die beiden Gruppen am stärksten unterscheiden (größte Varianz zwischen den Klassen).',
      ],
    },
    rauschen: {
      an: 'Entrauschen',
      mindestflaeche: 'Mindestfläche (Pixel)',
      ergebnis: (f: number, l: number) => `${f} Flecken entfernt, ${l} Löcher gefüllt`,
      legendeFleck: 'entfernter Fleck',
      legendeLoch: 'gefülltes Loch',
      erklaerung: [
        'Einzelne dunkle Pixel (Staub, Kompressionsfehler) würden sonst als winzige Formen ausgeschnitten. Darum werden zusammenhängende Bereiche gesucht und alle, die kleiner als die Mindestfläche sind, entfernt. Kleine Löcher werden ebenso gefüllt.',
        'Zusammenhängend heißt: Man kommt von einem Pixel zum anderen, indem man nur zu Nachbarn gleicher Farbe geht. Beim Vordergrund zählen nur die vier direkten Nachbarn. Pixel, die sich nur an einer Ecke berühren, gelten als getrennt – eine Verbindung der Breite null würde beim Schneiden nicht halten.',
        'Gefunden werden die Bereiche durch „Fluten“: Man beginnt bei einem Pixel und färbt nach und nach alle erreichbaren Nachbarn ein, wie Farbe, die ausläuft.',
      ],
    },
    konturen: {
      anzahl: (aussen: number, innen: number, punkte: number) =>
        `${aussen} ${aussen === 1 ? 'Außenkontur' : 'Außenkonturen'}, ` +
        `${innen} ${innen === 1 ? 'Innenkontur' : 'Innenkonturen'} (${innen === 1 ? 'Loch' : 'Löcher'}), ` +
        `${punkte.toLocaleString('de-DE')} Punkte`,
      legendeAussen: 'Außenkontur',
      legendeInnen: 'Innenkontur (Loch)',
      animation: 'Marching Squares Schritt für Schritt',
      animationHinweis: 'Ins Bild klicken, um einen Ausschnitt für die Animation zu wählen.',
      start: 'Abspielen',
      pause: 'Pause',
      schritt: 'Einzelschritt',
      tempo: 'Tempo',
      zelle: (x: number, y: number, fall: number) => `Zelle (${x} | ${y}): Fall ${fall}`,
      neuStart: 'Von vorn',
      fertig: 'Alle Zellen bearbeitet.',
      fortschritt: (i: number, n: number) => `${i} von ${n} Zellen mit Kontur`,
      ausschnittInfo: (x: number, y: number, g: number) => `Ausschnitt ${g} × ${g} Pixel ab (${x} | ${y}); außerhalb zählt als Hintergrund.`,
      erklaerung: [
        'Marching Squares legt ein Gitter über das Bild, dessen Ecken in den Pixelmitten liegen. Jede Zelle hat vier Pixel als Ecken. Welche davon Vordergrund sind, ergibt 16 mögliche Fälle – die Fallnummer entsteht, wenn man die Ecken als Binärzahl liest (oben links 8, oben rechts 4, unten rechts 2, unten links 1).',
        'Für jeden Fall steht in einer Tabelle, welche Kantenmitten der Zelle verbunden werden. Setzt man alle Teilstücke aneinander, entstehen geschlossene Konturen.',
        'Jedes Teilstück zeigt so, dass der Vordergrund rechts liegt. Außenkonturen laufen dadurch im Uhrzeigersinn, Löcher gegen den Uhrzeigersinn – am Vorzeichen der Fläche erkennt man, was ein Loch ist.',
      ],
    },
    vereinfachen: {
      toleranz: 'Toleranz (Pixel)',
      original: 'Ursprüngliche Kontur zeigen',
      auswahl: 'In eine Form klicken, um ihre Punkte zu sehen.',
      formInfo: (n: number, punkte: number, loecher: number) => `Form ${n}: ${punkte} Punkte außen, ${loecher} Löcher`,
      weitere: (n: number) => `… und ${n} weitere`,
      punkte: (vorher: number, nachher: number) =>
        `${vorher.toLocaleString('de-DE')} → ${nachher.toLocaleString('de-DE')} Punkte (${vorher ? Math.round((100 * nachher) / vorher) : 0} %)`,
      erklaerung: [
        'Marching Squares liefert alle halben Pixel einen Punkt – viel mehr als nötig. Das Douglas-Peucker-Verfahren entfernt Punkte, die fast auf einer Geraden liegen.',
        'So geht es: Verbinde Anfang und Ende mit einer Strecke. Suche den Punkt, der am weitesten davon entfernt ist. Ist er näher als die Toleranz, fallen alle Punkte dazwischen weg. Sonst bleibt er erhalten, und man macht mit beiden Hälften genauso weiter.',
        'Die Toleranz regelt den Tausch „Genauigkeit gegen Datenmenge“: größere Toleranz, weniger Punkte, gröbere Form.',
      ],
    },
    glaetten: {
      an: 'Glätten',
      staerke: 'Glättungsstärke',
      ecken: 'Ecken ab Knickwinkel (Grad)',
      kontrollpunkte: 'Kontrollpunkte aller Formen zeigen',
      zuViele: 'Kontrollpunkte werden für die ausgewählte Form gezeigt. In eine Form klicken.',
      segmente: (n: number) => `${n} Segmente`,
      gerade: 'gerade',
      erklaerung: [
        'Statt gerader Strecken verbinden kubische Bézier-Kurven die Punkte. Jede Kurve hat zwei Kontrollpunkte, die sie wie Magnete in ihre Richtung ziehen; durch die Kontrollpunkte selbst geht sie meist nicht.',
        'Die Kontrollpunkte liegen auf der Richtung vom vorigen zum nächsten Punkt. So läuft die Kurve an jedem Punkt ohne Knick weiter.',
        'Echte Ecken sollen spitz bleiben, sonst wird ein „L“ rund. Knickt die Kontur stärker als der eingestellte Winkel, bleibt die Ecke spitz.',
      ],
    },
    simulation: {
      reihenfolge: 'Schnittreihenfolge',
      reihenfolgen: {
        original: 'Original (wie im SVG)',
        'innen-vor-aussen': 'Innen vor außen',
        'naechster-nachbar': 'Nächster Nachbar',
      } as Record<string, string>,
      vergleich: 'Vergleich',
      spalteSchnitt: 'Schnitt',
      spalteLeer: 'Leerfahrt',
      spalteDauer: 'Dauer',
      geraet: 'Gerät',
      matte: 'Schneidematte',
      werkzeug: 'Werkzeug',
      stift: 'Stift',
      messer: 'Messer',
      geschwindigkeit: 'Geschwindigkeit (1–30)',
      druck: 'Druck (1–33)',
      abspielen: 'Abspielen',
      pause: 'Pause',
      vonVorn: 'Von vorn',
      zeitraffer: 'Zeitraffer',
      zeitleiste: 'Zeitleiste der Simulation',
      zeit: (t: number, gesamt: number) => `${formatiereDauer(t)} von ${formatiereDauer(gesamt)}`,
      kennzahlen: 'Kennzahlen',
      schnittlaenge: 'Schnittlänge',
      leerfahrt: 'Leerfahrten',
      dauer: 'Geschätzte Dauer',
      pfade: 'Pfade',
      annahme: 'Dauer geschätzt mit Stufe n ≈ n cm/s und 0,15 s je Absenken; echte Werte misst der Machbarkeitstest.',
      warnungAussen: (n: number) =>
        `${n} ${n === 1 ? 'Außenkontur wird' : 'Außenkonturen werden'} vor den Löchern darin geschnitten. Das Teil kann sich lösen, bevor ein Loch fertig ist.`,
      befehle: 'Plotterbefehle',
      befehlInfo: (i: number, n: number) => `Befehl ${i} von ${n}`,
      keinSvg: 'Noch kein SVG: zuerst ein Bild laden.',
      legendeSchnitt: 'Schnitt',
      legendeLeer: 'Leerfahrt',
      legendeStart: 'Startpunkt und Richtung',
      erklaerung: [
        'Die Simulation liest dieselben Plotterbefehle, die auch an den Cutter gingen: M fährt mit angehobenem Messer (Leerfahrt), D mit abgesenktem Messer (Schnitt). Die Koordinaten stehen in Schritten von 0,05 mm, zuerst y, dann x.',
        'Ein Cutter schneidet nur Konturen, Füllungen sind ihm egal. Jeder Pfad hat einen Startpunkt und eine Richtung.',
        '„Innen vor außen“: Löcher werden vor der Form geschnitten, die sie umgibt. Sonst kann sich das Teil lösen, bevor das Loch fertig ist.',
        '„Nächster Nachbar“ fährt immer zum nächstgelegenen Pfad, der schon dran ist, und beginnt dort an der nächsten Ecke. Das spart meist Leerfahrten. Das Verfahren ist aber „gierig“: Es denkt nie voraus, etwa an den Rückweg zum Ursprung. Darum ist es nicht immer das kürzeste.',
      ],
    },
    svg: {
      breite: 'Breite (mm)',
      hoehe: (mm: number) => `Höhe: ${mm.toFixed(1).replace('.', ',')} mm`,
      positionX: 'Abstand links (mm)',
      positionY: 'Abstand oben (mm)',
      code: 'SVG-Code',
      herunterladenSvg: 'SVG herunterladen',
      herunterladenDxf: 'DXF herunterladen (für Silhouette Studio)',
      kopieren: 'Code kopieren',
      kopiert: 'Kopiert',
      massstab: (mmJePx: number) => `1 Pixel = ${mmJePx.toFixed(3).replace('.', ',')} mm`,
      formen: (n: number) => (n === 1 ? '1 Form' : `${n} Formen`),
      befehlHinweis: 'Über eine Form oder einen Befehl im Code fahren.',
      befehl: {
        M: (p: string) => `M – Stift anheben und bei ${p} aufsetzen: Beginn eines Teilpfads.`,
        L: (von: string, p: string) => `L – gerade Strecke von ${von} nach ${p}.`,
        C: (von: string, c1: string, c2: string, p: string) =>
          `C – kubische Bézier-Kurve von ${von} nach ${p}, gezogen von den Kontrollpunkten ${c1} und ${c2}.`,
        Z: (von: string, p: string) => `Z – Teilpfad schließen: gerade zurück von ${von} zum Anfang ${p}.`,
        A: (von: string, p: string, stuecke: number) =>
          `A – Ellipsenbogen von ${von} nach ${p}. Für den Schnitt in ${stuecke} ${stuecke === 1 ? 'Bézier-Kurve' : 'Bézier-Kurven'} umgerechnet.`,
        sonst: (name: string) =>
          name === 'Z' ? 'Z – Teilpfad schließen. Der letzte Punkt liegt schon am Anfang, es kommt keine Linie dazu.' : name,
      },
      form: (n: number) => `Form ${n}`,
      erklaerung: [
        'Das SVG-Dokument beschreibt die Formen als Text. width und height mit „mm“ legen die echte Größe fest, die viewBox das Koordinatensystem. Hier ist 1 Einheit = 1 mm, der Ursprung liegt oben links, y zeigt nach unten.',
        'Jede Form ist ein <path>. Im d-Attribut stehen Befehle: M setzt den Stift an, L zieht eine Strecke, C eine Bézier-Kurve, Z schließt den Teilpfad.',
        'Eine Form mit Loch besteht aus mehreren Teilpfaden. fill-rule="evenodd" sorgt dafür, dass das Loch leer bleibt: Ein Punkt gilt als innen, wenn ein Strahl von ihm aus eine ungerade Zahl von Konturen kreuzt.',
        'Fahre über eine Form oder über eine Zeile im Code: Das Gegenstück wird markiert.',
      ],
    },
  },
  ueber: {
    titel: 'Über und Lizenzen',
    zurueck: 'Zurück zur App',
    absaetze: [
      '„Vom Pixel zum Schnitt“ zeigt Schritt für Schritt, wie aus einem Pixelbild Schnittpfade für einen Schneideplotter werden. Jeder Schritt ist sichtbar und einstellbar, der Quellcode ist selbst als Lernmaterial gedacht.',
      'Die App läuft vollständig im Browser. Bilder und Daten verlassen das Gerät nicht; es gibt kein Tracking und keine Anmeldung.',
    ],
    lizenzTitel: 'Lizenz dieser App',
    lizenzText:
      'Die App steht unter der GNU General Public License, Version 2 oder (nach Wahl) jeder späteren Version (GPL-2.0-or-later). Alle dürfen sie nutzen, verändern und weitergeben, auch kommerziell. Weiterentwicklungen müssen wieder unter der GPL offen sein.',
    quellcode: 'Quellcode',
    gplVolltext: 'Volltext der GPL-2.0',
    fremdTitel: 'Verwendete Bibliotheken',
    fremdHinweis: 'Diese Bibliotheken sind im ausgelieferten JavaScript enthalten. Die Lizenzen wurden am jeweiligen Original-Repository geprüft.',
    lizenztext: 'Lizenztext',
    uebernommenTitel: 'Übernommenes Wissen und übernommener Code',
    uebernommenText:
      'Befehlsfolgen, Geräte-IDs, Bluetooth-Kennungen und Abläufe für die Silhouette-Cutter stammen aus inkscape-silhouette (Dateien silhouette/Graphtec.py, Transport.py und BLETransport.py, Commit f376a08), nach TypeScript übertragen. Die Herkunft ist in den betroffenen Dateien vermerkt.',
    uebernommenCopyright:
      '(c) 2013, 2014 jw@suse.de · (c) 2016 juewei@fabmail.org · (c) 2016 Alexander Wenger · (c) 2017 Johann Gail · (c) 2026 inkscape-silhouette contributors – „Distribute under GPLv2 or ask“.',
    algorithmenTitel: 'Algorithmen',
    algorithmenText:
      'Schwellwert, Otsu-Verfahren (N. Otsu, 1979), Marching Squares, Douglas-Peucker (D. Douglas, T. Peucker, 1973) und die Bézier-Glättung sind für diese App selbst geschrieben und auf Deutsch kommentiert.',
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

    dxf: 'DXF-Testdateien für Silhouette Studio',
    dxfErklaerung:
      'Diese Dateien lassen sich schon ohne Cutter prüfen: in Silhouette Studio öffnen und nachmessen. ' +
      'Es gibt zwei Varianten, weil noch offen ist, welche Studio besser liest.',
    dxfPolylinie: 'DXF mit Polylinien herunterladen',
    dxfLinien: 'DXF mit Einzellinien herunterladen',
    dxfPruefen: 'Darauf achten',
    dxfVariantePolylinie: 'Polylinien: jeder Pfad ein zusammenhängendes Objekt (empfohlen).',
    dxfVarianteLinien: 'Einzellinien: jedes Teilstück ein eigenes Objekt (Rückfallebene).',

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
