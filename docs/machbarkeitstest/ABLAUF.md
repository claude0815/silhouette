# Ablauf des Machbarkeitstests vor Ort

Ziel: an einem Termin klären, ob und wie sich die Cutter der Schule direkt aus dem Browser ansteuern lassen, und die Werte sammeln, die Stufe 3 noch braucht. Geplante Dauer: etwa 2 Stunden für das erste Modell, danach etwa 30 Minuten je weiteres Modell.

Testseite: <https://claude0815.github.io/silhouette/cutter-test.html> (die Checkliste dort speichert Häkchen und Notizen im Browser; am Ende als Bericht herunterladen).

## Mitbringen

- [ ] Je ein Cutter jedes Modells (Cameo 4 / 4 Plus / Pro, Cameo 5 / 5 Plus, Portrait 3 / 4), mit Netzteil und USB-Kabel
- [ ] Passende Schneidematten (Cameo 12″ × 12″, ggf. 15″ × 15″; Portrait 8″ × 12″)
- [ ] Stift mit Adapter für den Werkzeughalter (Silhouette Sketch Pen oder Stifthalter)
- [ ] Papier (80 g/m²), Tonkarton (bis 170 g/m²), Reste von Vinylfolie und Aufkleberpapier
- [ ] Lineal oder Messschieber, Stoppuhr (Handy)
- [ ] Mac mit Chrome (und gern Edge)
- [ ] Windows-PC **ohne** Adminrechte mit Bluetooth (ein typischer Schul-PC)
- [ ] Wenn möglich: Windows-PC **mit** Adminrechten für den Treibertausch (siehe [WINDOWS-WINUSB.md](WINDOWS-WINUSB.md))
- [ ] Silhouette Studio auf mindestens einem Rechner (für die Gegenprobe und den DXF-Test)

## Vorher (zu Hause)

1. Testseite einmal öffnen: Erscheint „Sicherer Kontext: vorhanden“?
2. Auf der Testseite unter „DXF-Testdateien“ beide Dateien herunterladen und in Silhouette Studio öffnen (Checklistenpunkt 8, geht ohne Cutter).
3. Die Seite „Schneiden“ der App mit „Ohne Gerät (Simulation)“ einmal durchspielen.

## Vor Ort, je Modell

Reihenfolge so wählen, dass nichts kaputtgeht: erst Stift, dann Papier, zuletzt Messer auf anderem Material.

| Nr. | Schritt | Wo | Was notieren |
| --- | --- | --- | --- |
| 1 | Silhouette Studio schließen, Cutter einschalten, Matte mit Papier einlegen (Oberkante zuerst) | – | Welche Kante zieht das Gerät ein? Liegt der Ursprung oben links? |
| 2 | macOS, Chrome: „Per USB verbinden“, Gerät wählen | Testseite | Gerätename, Firmware, Endpunkte (steht im Protokoll) |
| 3 | „Status abfragen“ mit und ohne eingelegte Matte | Testseite | Antwort jeweils (0, 1, 2 …) |
| 4 | Stift einsetzen, Testquadrat 50 mm zeichnen | Testseite | Gemessene Seitenlängen (Soll: 50,0 mm) |
| 5 | Testquadrat noch einmal, nach ein paar Sekunden „Abbrechen“ | Testseite | Hält das Gerät an? Fährt es zurück? |
| 6 | Testquadrat noch einmal, mittendrin „Zurücksetzen senden (ESC EOT)“ | Testseite | Reaktion des Geräts |
| 7 | Dasselbe per Bluetooth (macOS, dann Windows ohne Adminrechte) | Testseite | Wird das Gerät gefunden? Falls nicht: mit „Alle Bluetooth-Geräte anzeigen“; Meldung notieren |
| 8 | Windows ohne Adminrechte: „Per USB verbinden“ | Testseite | Erscheint das Gerät in der Liste? Genaue Fehlermeldung |
| 9 | Optional, Windows mit Adminrechten: Treibertausch nach [WINDOWS-WINUSB.md](WINDOWS-WINUSB.md), dann USB erneut | Testseite | Klappt es danach? Rückweg geprüft? |
| 10 | Silhouette Studio wieder öffnen und einen kleinen Auftrag senden | Studio | Funktioniert alles wie vorher? |
| 11 | Testquadrat 50 mm bei Geschwindigkeit 5, 10 und 20 stoppen | Testseite | Sekunden je Durchgang |
| 12 | Material-Voreinstellungen an Resten prüfen (siehe unten) | App, Bereich „Schneiden“ | Gute Werte je Material |
| 13 | Welche Klinge ist eingesetzt? Bei AutoBlade: „Klingentiefe senden“ ausprobieren | App, Bereich „Schneiden“ | Klingentyp; ändert sich die Tiefe sichtbar? |
| 14 | Bericht herunterladen | Testseite | Datei aufheben |

### Material-Werte finden (Schritt 12)

1. In der App ein kleines Testmotiv anlegen, z. B. in der SVG-Werkstatt das Beispiel „Rechteck und Millimeter“ (30 × 20 mm).
2. Im Bereich „Schneiden“ die passende Voreinstellung wählen (die Werte sind Schätzwerte).
3. Mit **kleinem Druck** beginnen, schneiden, prüfen: Löst sich das Teil sauber? Ist die Trägerfolie (Vinyl) noch heil?
4. Druck in Schritten von 2–3 erhöhen, bis es sauber schneidet. Den Wert notieren, ebenso die Geschwindigkeit und ggf. die Klingentiefe.
5. Gute Werte direkt als „eigene Voreinstellung“ speichern – dann sind sie auf diesem Rechner sofort nutzbar.

## Danach

- Berichte (eine Markdown-Datei je Modell und Rechner) in diesen Ordner `docs/machbarkeitstest/` legen.
- Ergebnisse eintragen bzw. eintragen lassen:
  - Material-Werte in `src/cutter/voreinstellungen.ts`, dort `geprueft: true` setzen.
  - Gestoppte Zeiten → `zeitannahmen()` in `src/simulation/fahrten.ts`.
  - Reaktion auf Abbruch → Text `abbruchTipp` in `src/i18n/de.ts`.
  - Bluetooth-Ergebnis je Modell und Einzugsrichtung → `docs/protokoll.md`.

## Ergebnisvorlage

| Modell | Produkt-ID | Firmware | USB macOS | USB Windows ohne Admin | Bluetooth macOS | Bluetooth Windows | Quadrat gemessen | Abbruch-Reaktion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cameo 4 | | | | | | | | |
| Cameo 5 | | | | | | | | |
| Portrait 3/4 | | | | | | | | |

| Material | Werkzeug | Druck | Geschwindigkeit | Klingentiefe | Bemerkung |
| --- | --- | --- | --- | --- | --- |
| Druckerpapier 80 g/m² | Messer | | | | |
| Tonkarton 160 g/m² | Messer | | | | |
| Vinylfolie | Messer | | | | |
| Aufkleberpapier | Messer | | | | |
| Stift | Stift | | | – | |
