import { t } from '../i18n/de';

export function App() {
  return (
    <main>
      <h1>{t.app.titel}</h1>
      <p>{t.app.untertitel}</p>
      <p>{t.app.inArbeit}</p>
      <p>
        <a href="./cutter-test.html">{t.cutterTest.titel}</a>
      </p>
      <footer>
        <a href="https://github.com/claude0815/silhouette">{t.app.quellcode}</a> · {t.app.lizenz}
      </footer>
    </main>
  );
}
