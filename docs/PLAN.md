# Plan: Stufe 0 und Stufe 1

Stand: 31.10.2026 · Grundlage: `docs/ANFORDERUNGEN.md`

## Stufe 0 – Machbarkeitstest Cutter

Eine eigene, minimale Testseite (`cutter-test.html`), die als zweiter Einstiegspunkt mit gebaut und auf GitHub Pages veröffentlicht wird. So läuft sie über HTTPS, und die Lehrkraft kann sie ohne Installation an den Schulgeräten aufrufen.

**Inhalt der Seite**

1. **Umgebungs-Check:** Sind `navigator.usb` und `navigator.bluetooth` vorhanden, ist der Kontext sicher (`isSecureContext`)? Fehlt etwas, steht dort eine verständliche Erklärung.
2. **WebUSB verbinden:** `requestDevice` mit Filter `vendorId 0x0B4D`, dann `open`, `selectConfiguration`, `claimInterface`, Bulk-Endpunkte (OUT/IN) suchen. Gerätename, Produkt-ID und Endpunkte anzeigen.
3. **Web Bluetooth verbinden:** `requestDevice` mit Namensfilter bzw. Service-UUID aus inkscape-silhouette (`USERGUIDE.md`, Bluetooth-Abschnitt). Die genauen UUIDs und Characteristics werden vor der Umsetzung aus dem Original-Code ermittelt, nicht geraten.
4. **Statusabfrage:** GPGL `ESC 0x05`, Antwort auswerten (bereit / in Bewegung / keine Matte).
5. **Quadrat 50 mm mit Stift:** Befehle aus dem gemeinsamen GPGL-Modul (`src/cutter/gpgl.ts`), Einheit 0,05 mm (also 1000 Schritte). Die gesendeten Befehle stehen als Text auf der Seite.
6. **Abbrechen-Knopf** und ein Protokollfenster (Log mit Zeitstempel, jedes gesendete und empfangene Byte lesbar), das sich als Text kopieren lässt – für die Dokumentation der Checkliste.
7. **Geräteprofile:** kleine Tabelle Produkt-ID → Modell, erweiterbar.

**Was schon in Stufe 0 für Stufe 1 entsteht**

- `src/cutter/types.ts`: Schnittstelle `Cutter` mit `connect()`, `status()`, `send(job)`, `cancel()` und der Typ `CutJob` (Polylinien in mm + Werkzeugeinstellungen).
- `src/cutter/gpgl.ts`: reine Funktion `auftragZuBefehlen(job, profil) → string[]`, mit Snapshot-Tests.
- `src/cutter/webusb.ts`, `src/cutter/bluetooth.ts`: erste Fassungen der Treiber, in Stufe 3 ausgebaut.

**Ergebnis:** ausgefüllte Checkliste aus den Anforderungen, Log-Auszüge je Gerät in `docs/machbarkeitstest/`.

## Stufe 1 – Kern

### Module

```
src/
  i18n/de.ts              alle Texte der Oberfläche
  pipeline/               reine Funktionen, ohne DOM, jeweils mit Tests
    grayscale.ts          Mittelwert, gewichtete Luminanz
    histogram.ts
    threshold.ts          fester Schwellwert, Otsu, Invertieren
    denoise.ts            zusammenhängende Bereiche, Mindestfläche
    contours.ts           Marching Squares, Außen-/Innenkonturen, Schrittprotokoll für die Animation
    simplify.ts           Douglas-Peucker
    smooth.ts             Bézier-Glättung
    toSvg.ts              Konturen → SVG in mm, fill-rule evenodd
  worker/pipeline.worker.ts   führt die Pipeline aus, liefert Zwischenstände
  svg/
    document.ts           das gemeinsame SVG-Dokument (Quelle der Wahrheit)
    parse.ts              SVG-Text → Elemente mit Quellpositionen (für die Code-Markierung)
    flatten.ts            rect/circle/ellipse/polygon/path → Polylinien in mm
  cutter/                 siehe Stufe 0, dazu simulated.ts
  simulation/
    order.ts              Reihenfolge: Original, innen vor außen, nächster Nachbar
    metrics.ts            Schnittlänge, Leerfahrten, Dauer
  export/
    svg.ts                bereinigtes SVG in mm
    dxf.ts                einfaches DXF (R12, LWPOLYLINE bzw. POLYLINE/LINE)
  ui/                     Ansichten je Schritt, SVG-Ansicht, Simulation, Export
```

### Reihenfolge der Umsetzung

1. **Projekt-Setup** (Vite, TypeScript, Vitest, ESLint/Prettier, Pages-Deployment, LICENSE).
2. **Algorithmen als reine Funktionen** mit Tests und deutschen Kommentaren: Graustufen → Histogramm/Otsu → Schwellwert → Entrauschen → Marching Squares → Douglas-Peucker → Bézier → SVG.
3. **Web Worker** und Übertragung der Zwischenstände (Transferable `ArrayBuffer`, kein SharedArrayBuffer).
4. **Oberfläche der Pipeline:** Bild laden (Drag & Drop, Zuschnitt), pro Schritt eine Ansicht mit Reglern und Datenansicht (Pixelwerte, 0/1-Matrix, Punktliste), aufklappbare Erklärung.
5. **SVG-Dokument und verknüpfte Ansicht:** Code (zunächst nur lesbar, editierbar erst in Stufe 2) neben der Grafik, Hover/Klick markiert in beide Richtungen.
6. **Flatten + Simulation:** Messerweg abspielen, Leerfahrten, Kennzahlen, Reihenfolgen vergleichen, GPGL-Befehle zeilensynchron (mit `SimulatedCutter`).
7. **Export:** SVG und DXF, Zwischenstände als PNG/CSV/JSON.
8. **Seite „Über und Lizenzen“** mit Link zum Quellcode.
9. **Leistung prüfen:** Bild 2000 × 2000 px ohne spürbare Wartezeit (Messung im Test bzw. per Benchmark-Skript).

### Testansatz

- Vitest für alle reinen Module, kleine handgebaute Testbilder (z. B. 5 × 5 mit Loch) für Marching Squares.
- Snapshot-Tests für GPGL und DXF.
- Rundlauf-Test: Pipeline-Ergebnis → SVG → Flatten → gleiche Polylinien.

## Entscheidungen (31.10.2026)

- **UI-Framework:** Preact mit `@preact/signals` für den gemeinsamen Zustand.
- **Stufe 0:** im selben Repo als eigene Seite `cutter-test.html`, mit auf GitHub Pages veröffentlicht.
- **Cutter an der Schule:** Cameo 4 / 4 Plus / Pro, Cameo 5 / 5 Plus, Portrait 3 / 4. Für alle drei Familien Geräteprofile anlegen und im Machbarkeitstest prüfen.
- **Potrace:** erst nach Stufe 1, als eigener Schritt mit Vergleichsansicht.
- **Software an der Schule:** Silhouette Studio 5 in einer Edition ohne SVG-Import. Datei-Export für Studio also per DXF.

## Vorarbeiten ohne Gerät

Der Machbarkeitstest vor Ort verschiebt sich. Bis dahin wird alles vorbereitet, was sich ohne Cutter bauen und prüfen lässt, damit vor Ort nur noch geklickt, gemessen und protokolliert werden muss.

1. ✅ **Protokoll recherchieren:** Befehle, Statusantworten, USB-Produkt-IDs und Bluetooth-UUIDs aus inkscape-silhouette zusammentragen (robocut war dafür nicht nötig), mit Quellenangabe in `docs/protokoll.md`.
2. ✅ **Cutter-Schnittstelle und GPGL-Modul:** `Cutter`, `CutJob`, `auftragZuBefehlen()` mit Snapshot-Tests; Geräteprofile für Cameo 4, Cameo 5, Portrait 3/4.
3. ✅ **`SimulatedCutter`:** verhält sich nach außen wie ein echtes Gerät (Status, Senden, Abbruch).
4. ✅ **Testseite fertig bauen:** WebUSB- und Bluetooth-Verbindung, Statusabfrage, Testquadrat, Abbruch, Protokollfenster mit Kopieren, eingebaute Checkliste. Die Transportschichten werden gegen nachgebildete USB- und Bluetooth-Geräte getestet; eine Simulation macht die Seite auch ohne Cutter vorführbar.
5. **DXF-Export vorziehen:** Testquadrat und einige Formen als DXF erzeugen. Das lässt sich ohne Cutter in Silhouette Studio auf jedem PC prüfen (Maße, geschlossene Pfade).
6. **Stufe 1 beginnen:** Die Pipeline-Algorithmen hängen nicht am Gerät.

## Noch offen

- Bluetooth: UUIDs und Ablauf stehen in `docs/protokoll.md`. Geprüft ist der BLE-Weg dort nur mit einem Cameo 5 Alpha. Ob Cameo 4, Cameo 5 und Portrait 3/4 per BLE erreichbar sind, klärt der Machbarkeitstest (Web Bluetooth kann kein klassisches Bluetooth).
- Software an der Schule öffnet kein SVG (31.10.2026 bestätigt), DXF bleibt der Weg über Silhouette Studio.
