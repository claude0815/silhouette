/**
 * Meldet den Service Worker an (nur im gebauten Stand) und meldet, wenn eine neue Version
 * bereitliegt. Erst auf Wunsch wird sie aktiv und die Seite neu geladen.
 */
import { signal } from '@preact/signals';

/** Eine neue Version ist geladen und wartet */
export const neueVersion = signal(false);
/** Die App ist offline nutzbar (Service Worker aktiv) */
export const offlineBereit = signal(false);

let wartend: ServiceWorker | null = null;

export function meldeServiceWorkerAn(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const pruefe = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          wartend = reg.waiting;
          neueVersion.value = true;
        }
      };
      pruefe();
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', pruefe);
      });
    })
    .catch(() => undefined);
  void navigator.serviceWorker.ready.then(() => (offlineBereit.value = true));
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (neuGeladen || !wartend) return;
    neuGeladen = true;
    location.reload();
  });
}

/** Neue Version aktivieren; die Seite lädt danach neu. */
export function aktualisiere(): void {
  wartend?.postMessage('jetzt-aktualisieren');
}
