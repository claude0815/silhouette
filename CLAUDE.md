# Vom Pixel zum Schnitt

Lern-Web-App für Oberstufe und Studierende: Ein Pixelbild wird Schritt für Schritt in Schnittpfade (SVG) umgewandelt und an einen Silhouette-Schneideplotter geschickt. Jeder Verarbeitungsschritt ist sichtbar.

Die vollständigen Anforderungen stehen in `docs/ANFORDERUNGEN.md`. Lies sie vor jeder größeren Aufgabe und halte dich an die Ausbaustufen dort.

## Feste Vorgaben

- Reine statische Browser-App: kein Server, kein Tracking, keine externen Ressourcen zur Laufzeit.
- Deployment auf GitHub Pages per GitHub Actions. Die Seite liegt unter einem Unterpfad (`/<repo-name>/`), also Vites `base` passend setzen.
- Keine Abhängigkeiten, die eigene HTTP-Header brauchen (SharedArrayBuffer, WASM-Threads).
- Lizenz GPL-2.0-or-later. Fremdcode nur mit GPL-2.0-kompatibler Lizenz übernehmen und dabei die Copyright-Hinweise behalten. Lizenzen am Original prüfen, nicht am Wrapper-Paket.
- Ziel-Browser: Chrome und Edge auf macOS und Windows. Fehlende Browser-Schnittstellen (WebUSB, Web Bluetooth) erkennen und verständlich erklären.
- Oberfläche auf Deutsch, alle Texte zentral gesammelt.
- Die didaktischen Algorithmen (Schwellwert, Otsu, Marching Squares, Douglas-Peucker, Bézier-Glättung) selbst implementieren, lesbar und auf Deutsch kommentiert. Der Code ist auch Lernmaterial.
- Das SVG-Dokument ist die gemeinsame Grundlage: Simulation, Export und Cutter lesen nur daraus.
- Cutter-Zugriff nur über die gemeinsame Cutter-Schnittstelle (Simulation, WebUSB, Web Bluetooth). Die Übersetzung in GPGL-Befehle ist eine reine Funktion mit Tests.

## Reihenfolge

1. Stufe 0: Machbarkeitstest Cutter als minimale, eigenständige Testseite.
2. Stufe 1: Kern-Pipeline, verknüpfte SVG-Ansicht, Schnitt-Simulation, Export als SVG und DXF.
3. Danach Stufen 2 bis 4 laut `docs/ANFORDERUNGEN.md`.

## Befehle

- `npm run dev`: Entwicklungsserver (http://localhost:5173, Testseite unter `/cutter-test.html`)
- `npm test`: alle Tests einmal (Vitest), `npm run test:watch` im Beobachtungsmodus
- `npm run typecheck`: nur Typprüfung
- `npm run build`: Typprüfung und Build nach `dist/` (mit `base: '/silhouette/'`)
- `npm run preview`: gebauten Stand lokal ansehen (unter http://localhost:4173/silhouette/)

## Aufbau

- Preact mit `@preact/signals`, TypeScript, Vite, Vitest.
- `index.html` → `src/app/`: die App (Zustand `zustand.ts`, Worker-Anbindung `rechner.ts`, `Bildansicht.tsx`, Schrittansichten in `schritte/`, Lizenzseite `Ueber.tsx` unter `#ueber`). Neue Bibliotheken dort mit Lizenztext eintragen. `cutter-test.html` → `src/cutter-test/`: Testseite Stufe 0 (Zustand in `zustand.ts`, Bericht in `bericht.ts`).
- `src/i18n/de.ts`: alle Texte der Oberfläche.
- `src/cutter/`: Cutter-Schnittstelle (`types.ts`), Geräteprofile (`profile.ts`), reine GPGL-Übersetzung (`gpgl.ts`), Transportschicht (`transport.ts`), gemeinsamer Treiber `GpglCutter`, Übertragungswege `webusb.ts`, `bluetooth.ts` und `SimulatedCutter`. Protokoll und Quellen: `docs/protokoll.md`.
- `src/pipeline/`: Bildverarbeitung als reine Funktionen (Graustufen, Schwellwert/Otsu, Entrauschen, Marching Squares, Douglas-Peucker, Bézier-Glättung, SVG erzeugen). Koordinaten in Pixeln, Ursprung oben links.
- `src/pipeline/ablauf.ts`: führt die Schritte aus und rechnet nur ab dem ersten geänderten Schritt neu. `src/worker/`: Rechendienst im Web Worker.
- `src/svg/`: SVG lesen (`dokument.ts`: Elementbaum, Formen als Pfade, Stile; `pfad.ts`: d-Attribut fehlertolerant mit Textpositionen je Zahl, Bögen; `transform.ts`; `bearbeiten.ts`: Punkte ziehen) und in Linienzüge in mm zerlegen. Grundlage für Export, Simulation und Cutter.
- `src/checks/`: Cutter-Checks als reine Funktionen. `src/werkstatt/beispiele.ts`: Prüfungen der Mini-Aufgaben; Texte und Beispiel-SVGs in `src/i18n/beispiele.de.ts` (jede Aufgabe mit Musterlösung).
- `src/app/dokument.ts`: zentrales SVG-Dokument (folgt dem Nachzeichnen bis zur ersten eigenen Änderung). `src/app/werkstatt/`: SVG-Werkstatt (CodeMirror-Editor, Vorschau, Erklärer, Checks, Beispiele), wird erst bei Bedarf geladen.
- `src/app/schneiden/`: Bereich „Schneiden“ (Verbindung, Status, Voreinstellungen, Mattenvorschau, Senden, Abbrechen). Material-Ausgangswerte in `src/cutter/voreinstellungen.ts` (Schätzwerte bis zum Machbarkeitstest).
- `src/simulation/`: Schnittreihenfolge (`reihenfolge.ts`) und Fahrten aus GPGL-Befehlen mit Kennzahlen und Zeitplan (`fahrten.ts`). Die Simulation liest dieselben Befehle wie der Cutter.
- `src/export/`: DXF-Export (`dxf.ts`, Format R12, mm, y gespiegelt) und Testformen.
- Tests liegen neben dem Code als `*.test.ts`.
- `.github/workflows/deploy.yml`: Tests und Build bei jedem Push, Deployment auf GitHub Pages nur von `main`.
- Plan und Entscheidungen: `docs/PLAN.md`.
