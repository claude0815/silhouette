# Protokoll der Silhouette-Cutter (GPGL)

Zusammenfassung für die eigene Umsetzung. Stand: 31.10.2026.

**Quelle:** [fablabnbg/inkscape-silhouette](https://github.com/fablabnbg/inkscape-silhouette), Commit `f376a08` (Branch `main`), Dateien `silhouette/Graphtec.py`, `silhouette/Transport.py`, `silhouette/BLETransport.py`, `Commands.md`, `USERGUIDE.md`. Lizenz der Dateien: „Distribute under GPLv2 or ask“, Copyright (c) 2013–2017 jw@suse.de, juewei@fabmail.org, Alexander Wenger, Johann Gail sowie (c) 2026 inkscape-silhouette contributors. Die BLE-Details dort wurden laut Quelle mit [bob-takuya/cameo-cut](https://github.com/bob-takuya/cameo-cut) (MIT) abgeglichen.

Nichts davon ist offiziell dokumentiert. Alles stammt aus mitgeschnittenem USB-Verkehr von Silhouette Studio. **Alle Punkte mit ⚠ müssen im Machbarkeitstest bestätigt werden.**

## Grundlagen

- Die Sprache heißt GPGL (Graphtec Plotter Graphics Language), reiner ASCII-Text.
- Jeder Befehl endet mit ETX (`0x03`). Escape-Befehle bestehen aus ESC (`0x1B`) und einem Steuerzeichen, ohne ETX.
- **Einheit:** 1 Schritt = 0,05 mm, also 20 Schritte pro mm. Koordinaten werden als ganze Zahlen gesendet.
- **Achsen:** Ursprung oben links. Die Befehle `M` und `D` erwarten **zuerst y (Vorschubrichtung), dann x (Wagenrichtung)**. inkscape-silhouette vertauscht deshalb x und y beim Senden, statt den Querformat-Modus zu nutzen.
- Antworten des Geräts enden ebenfalls mit ETX.

## Escape-Befehle

| Bytes | Bedeutung | Antwort |
| --- | --- | --- |
| `1B 04` | Initialisieren | keine |
| `1B 05` | Status abfragen (geht auch vor dem Initialisieren) | `0` bereit, `1` in Bewegung, `2` keine Matte/kein Material geladen, jeweils mit ETX |
| `1B 15` | Werkzeugbelegung abfragen (Cameo 4 und neuer) | z. B. `1,7` (Halter 1, Halter 2); 0 leer, 1 Ratchet-Klinge, 2 AutoBlade, 3 Deep-Cut, 4 Kraft-Klinge, 5 Rotationsklinge, 7 Stift, 255 Fehler |
| `1B 0B` | Firmware abfragen (von Studio bei Cameo 4 Pro gesehen) | unklar |

## Abfragen mit Antwort

| Befehl | Bedeutung | Beispielantwort |
| --- | --- | --- |
| `FG` | Firmware-Version und Modellname | `CAMEO 4 V1.10    `, `Silhouette V1.10    ` |
| `TB71` | Kalibrierung des Passermarken-Sensors | `    0,    0` |
| `FA` | Kalibrierung von Wagen und Walze | `    0,    0` |

## Befehle für einen Auftrag

Gilt für die Produktlinie „Cameo 4“ in `Graphtec.py`. Dazu zählen **alle Modelle der Schule**: Cameo 4 / 4 Plus / 4 Pro, Cameo 5 / 5 Plus, Portrait 3 und Portrait 4. In der Tabelle steht `h` für den Werkzeughalter (1 oder 2).

| Befehl | Bedeutung |
| --- | --- |
| `TGn` | Schneidematte: 0 keine, 1 Cameo 12″×12″, 2 Cameo 12″×24″, 3 Portrait 8″×12″, 8 Cameo Plus 15″×15″, 9 Cameo Pro 24″×24″, 11 Portrait 8,5″×12″ |
| `FN0`, `TB50,0` | Hochformat (beides sendet auch Studio) |
| `\y,x` und `Zy,x` | Schneidebereich oben links und unten rechts, in Schritten |
| `Jh` | Werkzeughalter wählen (nur Geräte mit zwei Haltern, also nicht Portrait) |
| `FXp,h` | Druck, 1 bis 33 |
| `!s,h` | Geschwindigkeit, 1 bis 30 bei Cameo 4 und neuer |
| `TJa` | Beschleunigung; inkscape-silhouette sendet erst `TJ0`, später `TJ3` |
| `FCx,y,h` | Werkzeugversatz in Schritten; Stift `FC0,1,h`, Klinge 0,9 mm `FC18,1,h` |
| `FE0,h` | Werkzeug zwischen Pfaden nicht extra anheben |
| `FFs,e,h` | Ecken schärfen, Werte in 0,1 mm; Stift `FF0,0,h` |
| `My,x` | Fahren mit angehobenem Werkzeug |
| `Dy,x` | Fahren mit abgesenktem Werkzeug (zeichnen bzw. schneiden) |
| `L0` | Linientyp durchgezogen |
| `SO0` | aktuelle Position wird neuer Ursprung |

### Ablauf wie in `Graphtec.py` (Stift, Halter 1, Matte 12″×12″)

```
ESC 04                  Initialisieren
FG                      Version abfragen → Modell erkennen
TB71, FA                Abfragen, nur protokolliert
ESC 15                  Werkzeugbelegung abfragen
TG1                     Matte
FN0  TB50,0             Hochformat
\0,0  Z6096,6096        Schneidebereich (12″ = 6096 Schritte)
J1                      Halter 1 (nicht bei Portrait)
FX10,1  TJ0  !10,1      Druck, Beschleunigung, Geschwindigkeit
FC0,1,1  FE0,1          Versatz, nicht anheben
FF0,0,1  FF0,0,1        Ecken schärfen aus (Stift)
FX10,1  TJ3             Druck erneut, Beschleunigung 3
FC0,1,1                 Versatz für den Stift
M…  D…  D…  …           Pfade
L0  \0,0  M0,0  J0  FN0  TB50,0   zurück zum Start
```

Silhouette Studio 4.4 sendet bei der Cameo 4 Pro fast dieselbe Folge (Mitschnitt in `Commands.md`).

### Senden in Blöcken

- `Graphtec.py` teilt lange Aufträge in Blöcke von höchstens 1024 Byte und schneidet dabei nur nach einem ETX ab. Nach jedem Block wird der Status abgefragt, bis das Gerät wieder „bereit“ meldet.
- Vor dem Auftrag wird der Status geprüft. Bei „keine Matte“ bricht inkscape-silhouette ab.
- **Abbrechen:** Einen Abbruch-Befehl gibt es nicht. Man hört auf, weitere Blöcke zu senden; der laufende Block wird noch ausgeführt. ⚠ Wie das Gerät auf `ESC 04` mitten im Auftrag reagiert, ist offen.

## Übertragung per USB

- Hersteller-ID `0x0B4D` (Graphtec). Der Cameo 5 Alpha meldet sich mit `0x3844`.
- Bulk-Endpunkte: OUT `0x01` (Endpunkt 1), IN `0x82` (Endpunkt 2), Interface 0.
- Lesen in Paketen zu 64 Byte.

| Modell | Produkt-ID | Breite in mm (laut Treiber) | Werkzeughalter |
| --- | --- | --- | --- |
| Cameo 4 | `0x1137` | 304,8 | 2 |
| Cameo 4 Plus | `0x1138` | 372 (geschätzt) | 2 |
| Cameo 4 Pro | `0x1139` | 600 | 2 |
| Cameo 5 | `0x1140` | 330,2 | 2 |
| Cameo 5 Plus | `0x1141` | 372 | 2 |
| Portrait 3 | `0x113A` | 203 | 1 |
| Portrait 4 | `0x113F` | 216 | 1 |

⚠ Unter Windows belegt der Druckertreiber das Gerät; WebUSB kann es dann nicht öffnen.

## Übertragung per Bluetooth Low Energy

Web Bluetooth kann **nur BLE**, kein klassisches Bluetooth (RFCOMM).

| Rolle | UUID |
| --- | --- |
| Dienst | `e2088282-4fde-42f9-bb22-6ec3c7ed8f91` |
| Schreiben (Befehle) | `6d92661d-f429-4d67-929b-28e7a9780912` |
| Lesen (Antworten, Benachrichtigungen) | `8dcf199a-30e7-4bd4-beb6-beb57dca866c` |
| Steuerung (Statusereignisse wie `1` und `0`) | `61490654-b5b4-458c-a867-9e15bc1471e0` |

Ablauf beim Verbinden:

1. Benachrichtigungen für Steuerung und Lesen einschalten.
2. `ESC 04` an alle drei Characteristics schreiben, jeweils mit Bestätigung.
3. Eine Sekunde warten, danach den Empfangspuffer leeren.
4. Daten in Stücken zu **20 Byte** mit Bestätigung schreiben. Bei „Puffer voll“ (ATT-Fehler `0x0E`) bis zu dreimal mit wachsender Pause wiederholen.
5. Antworten auf Abfragen kommen über „Lesen“. Die Statusereignisse der Steuerung werden nicht mit den Antworten vermischt.

Das Modell wird am Namen in der Werbung bzw. an der `FG`-Antwort erkannt, z. B. `CAMEO 5`, `CAMEO 4 PLUS`, `PORTRAIT3`.

⚠ **Wichtigster offener Punkt:** inkscape-silhouette hat den BLE-Weg nur mit einem **Cameo 5 Alpha** vollständig geprüft. Ob Cameo 4, Cameo 5 und Portrait 3/4 per BLE (und nicht nur per klassischem Bluetooth) erreichbar sind und denselben Dienst anbieten, klärt erst der Machbarkeitstest.

## Abweichungen in der eigenen Umsetzung

- Punkte außerhalb des Schneidebereichs werden nicht still abgeschnitten (wie in `Graphtec.py`), sondern der Auftrag wird mit einer Fehlermeldung abgelehnt.
- Gerundet wird mit `Math.round`. Python rundet bei genau x,5 auf die gerade Zahl; der Unterschied beträgt höchstens einen Schritt (0,05 mm).
- Die Abfragen `TB71` und `FA` werden zunächst nicht gesendet; sie dienen in `Graphtec.py` nur dem Protokoll. ⚠ Prüfen, ob das Gerät sie vor einem Auftrag erwartet.
