# Vom Pixel zum Schnitt

Lern-Web-App für Oberstufe und Studierende: Ein Pixelbild wird Schritt für Schritt in Schnittpfade (SVG) umgewandelt und an einen Silhouette-Schneideplotter geschickt. Jeder Verarbeitungsschritt ist sichtbar.

- App: https://claude0815.github.io/silhouette/
- Machbarkeitstest Cutter: https://claude0815.github.io/silhouette/cutter-test.html
- Anforderungen: [docs/ANFORDERUNGEN.md](docs/ANFORDERUNGEN.md), Plan: [docs/PLAN.md](docs/PLAN.md)

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm test         # Tests mit Vitest
npm run build    # Typprüfung und Build nach dist/
```

## Lizenz

GPL-2.0-or-later, siehe [LICENSE](LICENSE).
