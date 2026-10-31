import { t } from '../i18n/de';
import { pruefeUmgebung } from './umgebung';

/**
 * Testseite für Stufe 0. Bisher nur der Umgebungs-Check;
 * Verbinden, Statusabfrage und Testquadrat folgen.
 */
export function CutterTest() {
  const u = pruefeUmgebung(globalThis);
  const zeile = (name: string, ok: boolean) => (
    <li>
      {name}: <span class={ok ? 'ok' : 'fehlt'}>{ok ? t.cutterTest.vorhanden : t.cutterTest.fehlt}</span>
    </li>
  );

  return (
    <main>
      <h1>{t.cutterTest.titel}</h1>
      <p>{t.cutterTest.beschreibung}</p>
      <h2>{t.cutterTest.umgebung}</h2>
      <ul>
        {zeile(t.cutterTest.sichererKontext, u.sichererKontext)}
        {zeile(t.cutterTest.webUsb, u.webUsb)}
        {zeile(t.cutterTest.webBluetooth, u.webBluetooth)}
      </ul>
      {(!u.webUsb || !u.webBluetooth) && <p>{t.cutterTest.hinweisBrowser}</p>}
      <p>
        <a href="./">{t.cutterTest.zurApp}</a>
      </p>
    </main>
  );
}
