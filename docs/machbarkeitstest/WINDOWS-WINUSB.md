# Windows: WebUSB nach einem Treibertausch auf WinUSB

**Nur für den Machbarkeitstest bzw. für die IT-Administration. Für den Unterricht ist dieser Weg nicht gedacht.**

## Warum?

Unter Windows bindet der Treiber von Silhouette Studio (bzw. der Drucker-Treiber) den Cutter an sich. Chrome und Edge können über WebUSB nur Geräte ansprechen, die den Windows-Treiber **WinUSB** verwenden. Ohne Treibertausch erscheint der Cutter deshalb meist gar nicht in der Geräteauswahl. Der Tausch braucht **Adminrechte**.

Auf Windows-PCs ohne Adminrechte sind die vorgesehenen Wege: **Web Bluetooth** (falls Cutter und PC Bluetooth haben) oder **DXF-Export** und Silhouette Studio.

## Vorgehen mit Zadig

[Zadig](https://zadig.akeo.ie/) ist ein freies Werkzeug zum Wechseln von USB-Treibern.

1. Silhouette Studio schließen. Cutter per USB anschließen und einschalten.
2. Zadig als Administrator starten.
3. Menü *Options → List All Devices* einschalten.
4. In der Liste den Cutter wählen. Zur Kontrolle: Die angezeigte USB-ID beginnt mit `0B4D` (Graphtec/Silhouette), z. B. `0B4D 1137` für die Cameo 4. **Unbedingt das richtige Gerät wählen** – ein falsch getauschter Treiber (z. B. von Tastatur oder Maus) kann den Rechner unbedienbar machen.
5. Den bisherigen Treiber notieren (linkes Feld), als Ziel **WinUSB** wählen (rechtes Feld) und *Replace Driver* bzw. *Install Driver* klicken.
6. Chrome neu starten, die Testseite öffnen und „Per USB verbinden“ versuchen.

## Was danach zu prüfen ist

- Funktioniert Silhouette Studio noch per USB? **Vermutlich nicht**, solange WinUSB aktiv ist – das im Test ausprobieren und notieren.
- Bleibt der Tausch nach einem Neustart bzw. nach einem Windows-Update erhalten?

## Rückweg zum ursprünglichen Treiber

1. Geräte-Manager öffnen (Rechtsklick auf Start → *Geräte-Manager*).
2. Den Cutter suchen (meist unter *Universal Serial Bus devices* bzw. *USB-Geräte*).
3. Rechtsklick → *Gerät deinstallieren*, dabei die Option zum Entfernen bzw. Löschen des Treibers ankreuzen (Wortlaut je nach Windows-Version unterschiedlich).
4. Cutter ab- und wieder anstecken. Windows sollte den vorherigen Treiber wieder einrichten. Klappt das nicht, Silhouette Studio bzw. dessen Treiber neu installieren.

Den Rückweg im Test einmal vollständig ausprobieren und das Ergebnis notieren, bevor der Weg für weitere Rechner empfohlen wird.
