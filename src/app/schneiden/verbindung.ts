/**
 * Zustand des Bereichs „Schneiden“: Verbindung zum Cutter, Status, Werkzeug und Senden.
 * Alle Gerätezugriffe gehen über die gemeinsame Cutter-Schnittstelle (GpglCutter).
 */
import { computed, effect, signal } from '@preact/signals';
import { BluetoothTransport } from '../../cutter/bluetooth';
import { auftragZuBefehlen, testfahrtBefehle } from '../../cutter/gpgl';
import { AbbruchFehler, GpglCutter } from '../../cutter/gpgl-cutter';
import { profile, type GeraeteProfil } from '../../cutter/profile';
import { SimulatedCutter } from '../../cutter/simulated';
import type { Transport } from '../../cutter/transport';
import type { CutJob, MattenId, ProtokollEintrag, StatusAntwort, Werkzeug } from '../../cutter/types';
import { pruefeVoreinstellung, VOREINSTELLUNGEN, type Voreinstellung } from '../../cutter/voreinstellungen';
import { VerbindungsFehler, WebUsbTransport } from '../../cutter/webusb';
import { ordne, type Reihenfolge } from '../../simulation/reihenfolge';
import { leseSvg, svgZuPolylinien } from '../../svg/dokument';
import { t } from '../../i18n/de';
import { dokument } from '../dokument';

const tx = t.app.schneiden;

// ---------------------------------------------------------------------------
// Protokoll und Meldungen

export const protokoll = signal<ProtokollEintrag[]>([]);
const protokolliere = (e: ProtokollEintrag) => {
  // Nur die letzten 500 Einträge behalten
  protokoll.value = [...protokoll.value.slice(-499), e];
};

export interface Meldung {
  text: string;
  tipp?: string;
  technisch?: string;
  art: 'fehler' | 'info' | 'erfolg';
}
export const meldung = signal<Meldung | null>(null);

function zeigeFehler(e: unknown): void {
  if (e instanceof VerbindungsFehler) meldung.value = { text: e.message, tipp: e.tipp, technisch: e.technisch, art: 'fehler' };
  else if (e instanceof AbbruchFehler) meldung.value = { text: tx.abgebrochen, tipp: tx.abbruchTipp, art: 'info' };
  else if (e instanceof Error) meldung.value = { text: e.message, technisch: `${e.name}: ${e.message}`, art: 'fehler' };
  else meldung.value = { text: String(e), art: 'fehler' };
}

// ---------------------------------------------------------------------------
// Verbindung und Status

export const cutter = signal<GpglCutter | null>(null);
export const status = signal<StatusAntwort | null>(null);
export const verbindet = signal(false);
export const alleBluetooth = signal(false);

function getrennt(grund: string): void {
  cutter.value = null;
  status.value = null;
  meldung.value = { text: grund, tipp: tx.getrenntTipp, art: 'fehler' };
}

async function verbinde(neu: () => Promise<GpglCutter> | GpglCutter): Promise<void> {
  await trenne();
  meldung.value = null;
  verbindet.value = true;
  try {
    const c = await neu();
    await c.connect();
    cutter.value = c;
    passeAnGeraetAn(c.profil);
    status.value = await c.status();
  } catch (e) {
    zeigeFehler(e);
  } finally {
    verbindet.value = false;
  }
}

const mitProtokoll = (transport: Transport) => new GpglCutter(transport, { onProtokoll: protokolliere });

export const verbindeUsb = () =>
  verbinde(async () => mitProtokoll(await WebUsbTransport.waehle(navigator.usb, { onProtokoll: protokolliere, onGetrennt: getrennt })));

export const verbindeBluetooth = () =>
  verbinde(async () =>
    mitProtokoll(await BluetoothTransport.waehle(navigator.bluetooth, alleBluetooth.value, { onProtokoll: protokolliere, onGetrennt: getrennt })),
  );

/** Ein simuliertes Gerät: zum Üben und Vorführen ohne Cutter. */
export const verbindeSimulation = () =>
  verbinde(
    () =>
      new SimulatedCutter(
        { bewegungsAbfragen: 6, verzoegerungMs: 40 },
        { onProtokoll: protokolliere, abfrageIntervallMs: 120, blockgroesse: 128 },
      ),
  );

export async function trenne(): Promise<void> {
  const c = cutter.value;
  cutter.value = null;
  status.value = null;
  if (c) await c.disconnect().catch(() => undefined);
}

export async function frageStatus(): Promise<void> {
  const c = cutter.value;
  if (!c || c.beschaeftigt) return;
  try {
    status.value = await c.status();
  } catch (e) {
    zeigeFehler(e);
  }
}

// Regelmäßig nach dem Status fragen, solange verbunden und nichts anderes läuft
setInterval(() => {
  if (cutter.value && !sendet.value && typeof document !== 'undefined' && !document.hidden) void frageStatus();
}, 3000);

// ---------------------------------------------------------------------------
// Werkzeug, Matte und Reihenfolge

export const matte = signal<MattenId>('cameo-12x12');
export const halter = signal<1 | 2>(1);
export const reihenfolge = signal<Reihenfolge>('innen-vor-aussen');
export const voreinstellungId = signal<string>(VOREINSTELLUNGEN[0]!.id);
export const werkzeug = signal<Omit<Werkzeug, 'halter'>>({ ...VOREINSTELLUNGEN[0]!.werkzeug });
/** Klingentiefe der AutoBlade mitsenden? (Nur wenn eine AutoBlade eingesetzt ist.) */
export const tiefeSenden = signal(false);
export const tiefe = signal(1);

/** Profil des verbundenen Geräts, sonst ein wählbares Profil für Vorschau und Prüfung */
export const vorschauProfilId = signal(profile[0]!.id);
export const profil = computed<GeraeteProfil>(
  () => cutter.value?.profil ?? profile.find((p) => p.id === vorschauProfilId.value) ?? profile[0]!,
);

function passeAnGeraetAn(p: GeraeteProfil | undefined): void {
  if (!p) return;
  if (p.id.startsWith('portrait')) {
    matte.value = 'portrait-8x12';
    halter.value = 1;
  } else if (p.id.includes('plus')) matte.value = 'cameo-plus-15x15';
  else if (p.id.includes('pro')) matte.value = 'cameo-pro-24x24';
  else matte.value = 'cameo-12x12';
}

// Eigene Voreinstellungen im Browser
const SPEICHER = 'vom-pixel-zum-schnitt:voreinstellungen';
function ladeEigene(): Voreinstellung[] {
  try {
    const liste = JSON.parse(globalThis.localStorage?.getItem(SPEICHER) ?? '[]') as Voreinstellung[];
    return liste.filter((v) => pruefeVoreinstellung(v).length === 0);
  } catch {
    return [];
  }
}
export const eigeneVoreinstellungen = signal<Voreinstellung[]>(ladeEigene());
effect(() => {
  try {
    globalThis.localStorage?.setItem(SPEICHER, JSON.stringify(eigeneVoreinstellungen.value));
  } catch {
    // nicht speicherbar: nur für diese Sitzung
  }
});
export const alleVoreinstellungen = computed(() => [...VOREINSTELLUNGEN, ...eigeneVoreinstellungen.value]);

export function waehleVoreinstellung(id: string): void {
  const v = alleVoreinstellungen.value.find((x) => x.id === id);
  if (!v) return;
  voreinstellungId.value = id;
  werkzeug.value = { ...v.werkzeug };
  tiefeSenden.value = v.werkzeug.tiefe !== undefined;
  if (v.werkzeug.tiefe !== undefined) tiefe.value = v.werkzeug.tiefe;
}

export function aendereWerkzeug(teil: Partial<Omit<Werkzeug, 'halter'>>): void {
  werkzeug.value = { ...werkzeug.value, ...teil };
}

export function speichereVoreinstellung(name: string): string[] {
  const v: Voreinstellung = {
    id: `eigen-${Date.now()}`,
    name: name.trim(),
    werkzeug: { ...werkzeug.value, tiefe: tiefeSenden.value ? tiefe.value : undefined },
    quelle: tx.eigeneQuelle,
    geprueft: true,
  };
  const fehler = pruefeVoreinstellung(v);
  if (fehler.length === 0) {
    eigeneVoreinstellungen.value = [...eigeneVoreinstellungen.value, v];
    voreinstellungId.value = v.id;
  }
  return fehler;
}

export function loescheVoreinstellung(id: string): void {
  eigeneVoreinstellungen.value = eigeneVoreinstellungen.value.filter((v) => v.id !== id);
  if (voreinstellungId.value === id) waehleVoreinstellung(VOREINSTELLUNGEN[0]!.id);
}

// ---------------------------------------------------------------------------
// Auftrag

/** Die Pfade aus dem zentralen SVG-Dokument, in der gewählten Reihenfolge, in mm */
export const pfade = computed(() =>
  ordne(svgZuPolylinien(leseSvg(dokument.value.text)), reihenfolge.value).map((g) => g.pfad),
);

export const auftrag = computed<CutJob>(() => ({
  pfade: pfade.value,
  matte: matte.value,
  werkzeug: {
    ...werkzeug.value,
    halter: halter.value,
    tiefe: werkzeug.value.art === 'messer' && tiefeSenden.value ? tiefe.value : undefined,
  },
}));

/** Befehle für den Auftrag oder die Fehlermeldung, warum er nicht gesendet werden kann */
export const befehle = computed<{ befehle: string[] } | { fehler: string }>(() => {
  if (auftrag.value.pfade.length === 0) return { fehler: tx.nichtsZuSchneiden };
  try {
    return { befehle: auftragZuBefehlen(auftrag.value, profil.value) };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) };
  }
});

export const sendet = signal<'auftrag' | 'testfahrt' | null>(null);
export const fortschritt = signal(0);
/** Wurde in dieser Sitzung schon bestätigt, dass mit Messer geschnitten werden soll? */
let messerBestaetigt = false;

async function sendeFolge(art: 'auftrag' | 'testfahrt', folge: string[]): Promise<void> {
  const c = cutter.value;
  if (!c || sendet.value) return;
  meldung.value = null;
  sendet.value = art;
  fortschritt.value = 0;
  try {
    await c.sendeBefehle(folge, { onFortschritt: (g, gesamt) => (fortschritt.value = g / gesamt) });
    meldung.value = { text: art === 'auftrag' ? tx.fertig : tx.testfahrtFertig, art: 'erfolg' };
  } catch (e) {
    zeigeFehler(e);
  } finally {
    sendet.value = null;
    void frageStatus();
  }
}

export function testfahrt(): Promise<void> {
  return sendeFolge('testfahrt', testfahrtBefehle(profil.value, matte.value));
}

export async function schneide(bestaetige: (frage: string) => boolean = (f) => confirm(f)): Promise<void> {
  const b = befehle.value;
  if ('fehler' in b) {
    meldung.value = { text: b.fehler, art: 'fehler' };
    return;
  }
  if (werkzeug.value.art === 'messer' && !messerBestaetigt) {
    if (!bestaetige(tx.messerFrage)) return;
    messerBestaetigt = true;
  }
  await sendeFolge('auftrag', b.befehle);
}

export async function brichAb(): Promise<void> {
  await cutter.value?.cancel();
}

export async function setzeZurueck(): Promise<void> {
  try {
    await cutter.value?.zuruecksetzen();
  } catch (e) {
    zeigeFehler(e);
  }
}
