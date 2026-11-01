/*
 * Service Worker für „Vom Pixel zum Schnitt“: macht die App offline nutzbar.
 *
 * Beim ersten Besuch werden alle Dateien der App in einem Zwischenspeicher (Cache) abgelegt.
 * Danach kommen sie von dort – auch ohne Internet. VERSION und DATEIEN setzt der Build davor
 * (siehe offline-plugin.ts).
 *
 * Eine neue Version wird im Hintergrund geladen, aber erst aktiv, wenn man in der App
 * „Neu laden“ wählt. So verliert eine offene Seite nie Dateien, die sie noch nachladen will.
 */
/* global VERSION, DATEIEN */
const PRAEFIX = 'vom-pixel-zum-schnitt-';
const CACHE = PRAEFIX + VERSION;

self.addEventListener('install', (e) => {
  // cache: 'reload' – am HTTP-Cache des Browsers vorbei, damit wirklich die neue Version gespeichert wird
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith(PRAEFIX) && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'jetzt-aktualisieren') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      // ignoreVary: Skripte werden mit crossorigin geladen; ihre Anfrage trägt dann eine
      // Origin-Kopfzeile, die gespeicherte (beim Installieren geladene) aber nicht.
      const gespeichert = await c.match(anfrage, { ignoreSearch: true, ignoreVary: true });
      if (gespeichert) return gespeichert;
      try {
        return await fetch(anfrage);
      } catch (fehler) {
        // Offline und nicht gespeichert: Seitenaufrufe bekommen wenigstens die Startseite
        if (anfrage.mode === 'navigate') return (await c.match('./index.html')) ?? Response.error();
        throw fehler;
      }
    }),
  );
});
