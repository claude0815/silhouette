import { t } from '../i18n/de';
import { Checkliste, Protokoll, Testauftrag, Umgebung, Verbindung } from './Abschnitte';

/** Testseite für Stufe 0: Lässt sich ein Silhouette-Cutter direkt aus dem Browser ansteuern? */
export function CutterTest() {
  return (
    <main class="cutter-test">
      <h1>{t.cutterTest.titel}</h1>
      <p>{t.cutterTest.beschreibung}</p>
      <Umgebung />
      <Verbindung />
      <Testauftrag />
      <Protokoll />
      <Checkliste />
      <p>
        <a href="./">{t.cutterTest.zurApp}</a>
      </p>
    </main>
  );
}
