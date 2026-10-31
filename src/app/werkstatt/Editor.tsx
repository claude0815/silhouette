/**
 * Code-Editor (CodeMirror 6) für das SVG-Dokument.
 * Fehler werden an ihrer Stelle unterstrichen, der in der Grafik gezeigte Befehl wird markiert.
 */
import { xml } from '@codemirror/lang-xml';
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

export interface Marke {
  start: number;
  ende: number;
  klasse: string;
  titel?: string;
}

const setzeMarken = StateEffect.define<Marke[]>();

/** Speichert die Markierungen und verschiebt sie bei Textänderungen mit. */
const markenFeld = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marken, tr) {
    let neu = marken.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setzeMarken)) continue;
      const laenge = tr.state.doc.length;
      const bereiche = e.value
        .map((m) => {
          const start = Math.max(0, Math.min(laenge, m.start));
          const ende = Math.max(start, Math.min(laenge, m.ende));
          // Leere Bereiche (z. B. „Fehler am Ende“) wenigstens ein Zeichen breit zeigen
          const [von, bis] = ende > start ? [start, ende] : start < laenge ? [start, start + 1] : [Math.max(0, start - 1), start];
          return bis > von
            ? Decoration.mark({ class: m.klasse, attributes: m.titel ? { title: m.titel } : undefined }).range(von, bis)
            : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => a.from - b.from);
      neu = Decoration.set(bereiche, true);
    }
    return neu;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface EditorProps {
  text: string;
  onChange: (text: string) => void;
  marken: Marke[];
  /** Diese Stelle in den sichtbaren Bereich holen und auswählen */
  sprung: { start: number; ende: number; n: number } | null;
  /** Diese Stelle nur in den sichtbaren Bereich holen (z. B. beim Zeigen in der Grafik) */
  blick?: number | null;
  onCursor?: (pos: number) => void;
  onZeigen?: (pos: number | null) => void;
}

export function Editor(props: EditorProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const sicht = useRef<EditorView | null>(null);
  // Aktuelle Rückrufe, damit die einmal angelegten Listener nie veraltete Funktionen aufrufen
  const rueck = useRef(props);
  rueck.current = props;
  const extern = useRef(false);
  /**
   * Was der Editor zuletzt selbst gemeldet hat. Kommt genau dieser Text als „Text von außen“
   * zurück, ist es nur das Echo der eigenen Eingabe – oft schon überholt, weil inzwischen
   * weitergetippt wurde. Würde man es übernehmen, gingen Zeichen verloren.
   */
  const zuletztGemeldet = useRef(props.text);

  useEffect(() => {
    const erweiterungen: Extension[] = [
      basicSetup,
      xml(),
      EditorView.lineWrapping,
      markenFeld,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !extern.current) {
          const text = u.state.doc.toString();
          zuletztGemeldet.current = text;
          rueck.current.onChange(text);
        }
        if (u.selectionSet && !extern.current) rueck.current.onCursor?.(u.state.selection.main.head);
      }),
      EditorView.domEventHandlers({
        mousemove: (e, v) => {
          rueck.current.onZeigen?.(v.posAtCoords({ x: e.clientX, y: e.clientY }));
        },
        mouseleave: () => {
          rueck.current.onZeigen?.(null);
        },
      }),
    ];
    const v = new EditorView({ doc: props.text, extensions: erweiterungen, parent: huelle.current! });
    sicht.current = v;
    return () => v.destroy();
  }, []);

  // Text von außen (Ziehen, Beispiel, Datei): nur den geänderten Teil ersetzen, damit der Cursor bleibt.
  // useLayoutEffect statt useEffect: Er läuft im selben Schritt wie das Zeichnen, also bevor eine
  // weitere Taste ankommt. Ein späterer Abgleich mit veraltetem Text würde frisch getippte Zeichen löschen.
  useLayoutEffect(() => {
    const v = sicht.current;
    if (!v) return;
    const alt = v.state.doc.toString();
    if (alt === props.text || props.text === zuletztGemeldet.current) return;
    zuletztGemeldet.current = props.text;
    let anfang = 0;
    while (anfang < alt.length && anfang < props.text.length && alt[anfang] === props.text[anfang]) anfang++;
    let ende = 0;
    while (
      ende < alt.length - anfang &&
      ende < props.text.length - anfang &&
      alt[alt.length - 1 - ende] === props.text[props.text.length - 1 - ende]
    )
      ende++;
    extern.current = true;
    v.dispatch({ changes: { from: anfang, to: alt.length - ende, insert: props.text.slice(anfang, props.text.length - ende) } });
    extern.current = false;
  }, [props.text]);

  useEffect(() => {
    sicht.current?.dispatch({ effects: setzeMarken.of(props.marken) });
  }, [props.marken, props.text]);

  useEffect(() => {
    const v = sicht.current;
    const s = props.sprung;
    if (!v || !s) return;
    const laenge = v.state.doc.length;
    const von = Math.min(s.start, laenge);
    const bis = Math.min(Math.max(s.ende, von), laenge);
    extern.current = true;
    v.dispatch({ selection: { anchor: von, head: bis }, effects: EditorView.scrollIntoView(von, { y: 'center' }) });
    extern.current = false;
    v.focus();
  }, [props.sprung?.n]);

  useEffect(() => {
    const v = sicht.current;
    if (!v || props.blick == null) return;
    v.dispatch({ effects: EditorView.scrollIntoView(Math.min(props.blick, v.state.doc.length), { y: 'nearest' }) });
  }, [props.blick]);

  return <div ref={huelle} class="editor" data-testid="editor" />;
}
