/**
 * Zustand und Aktionen der Testseite, mit Signalen von @preact/signals.
 * Ein Signal ist ein Wert, bei dessen Änderung sich die Anzeige selbst aktualisiert.
 */
import { computed, effect, signal } from '@preact/signals';
import { BluetoothTransport } from '../cutter/bluetooth';
import { auftragZuBefehlen, testQuadrat } from '../cutter/gpgl';
import { AbbruchFehler, GpglCutter } from '../cutter/gpgl-cutter';
import { profile } from '../cutter/profile';
import { SimulatedCutter } from '../cutter/simulated';
import type { Transport } from '../cutter/transport';
import type { CutJob, MattenId, ProtokollEintrag, StatusAntwort, WerkzeugArt } from '../cutter/types';
import { VerbindungsFehler, WebUsbTransport } from '../cutter/webusb';
import type { ChecklistenPunkt } from './bericht';
import { t } from '../i18n/de';

// ---------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------

export const protokoll = signal<ProtokollEintrag[]>([]);

export function protokolliere(e: ProtokollEintrag): void {
  protokoll.value = [...protokoll.value, e];
}

// ---------------------------------------------------------------------------
// Verbindung
// ---------------------------------------------------------------------------

export interface Meldung {
  text: string;
  tipp?: string;
  technisch?: string;
}

export const cutter = signal<GpglCutter | null>(null);
export const verbindet = signal(false);
export const fehler = signal<Meldung | null>(null);
export const status = signal<StatusAntwort | null>(null);
export const alleBluetooth = signal(false);

function zeigeFehler(e: unknown): void {
  if (e instanceof VerbindungsFehler) {
    fehler.value = { text: e.message, tipp: e.tipp, technisch: e.technisch };
  } else if (e instanceof Error) {
    fehler.value = { text: e.message, technisch: `${e.name}: ${e.message}` };
  } else {
    fehler.value = { text: String(e) };
  }
  protokolliere({ zeit: Date.now(), richtung: 'fehler', text: fehler.value.text });
}

function beiTrennung(grund: string): void {
  cutter.value = null;
  status.value = null;
  fehler.value = { text: grund };
}

/** Baut eine Verbindung auf. `neuerCutter` wählt das Gerät aus und erzeugt den Cutter. */
async function verbinde(neuerCutter: () => Promise<GpglCutter> | GpglCutter): Promise<void> {
  await trenne();
  fehler.value = null;
  verbindet.value = true;
  try {
    const c = await neuerCutter();
    await c.connect();
    cutter.value = c;
    waehleMatteFuerModell();
    status.value = await c.status();
  } catch (e) {
    zeigeFehler(e);
  } finally {
    verbindet.value = false;
  }
}

const mitProtokoll = (transport: Transport) => new GpglCutter(transport, { onProtokoll: protokolliere });

export function verbindeUsb(): Promise<void> {
  return verbinde(async () =>
    mitProtokoll(await WebUsbTransport.waehle(navigator.usb, { onProtokoll: protokolliere, onGetrennt: beiTrennung })),
  );
}

export function verbindeBluetooth(): Promise<void> {
  return verbinde(async () =>
    mitProtokoll(
      await BluetoothTransport.waehle(navigator.bluetooth, alleBluetooth.value, {
        onProtokoll: protokolliere,
        onGetrennt: beiTrennung,
      }),
    ),
  );
}

/** Ein simuliertes Gerät, das nach jedem Block kurz „in Bewegung“ meldet. */
export function verbindeSimulation(): Promise<void> {
  return verbinde(
    () =>
      new SimulatedCutter(
        { bewegungsAbfragen: 4, verzoegerungMs: 30 },
        { onProtokoll: protokolliere, abfrageIntervallMs: 100, blockgroesse: 64 },
      ),
  );
}

export async function trenne(): Promise<void> {
  const c = cutter.value;
  cutter.value = null;
  status.value = null;
  if (c) await c.disconnect().catch(() => undefined);
}

export async function frageStatus(): Promise<void> {
  const c = cutter.value;
  if (!c) return;
  try {
    status.value = await c.status();
  } catch (e) {
    zeigeFehler(e);
  }
}

// ---------------------------------------------------------------------------
// Testauftrag
// ---------------------------------------------------------------------------

export const seiteMm = signal(50);
export const abstandMm = signal(10);
export const werkzeugArt = signal<WerkzeugArt>('stift');
export const druck = signal(10);
export const geschwindigkeit = signal(10);
export const halter = signal<1 | 2>(1);
export const matte = signal<MattenId>('cameo-12x12');

export const laeuft = signal(false);
export const fortschritt = signal<number | null>(null);
export const fertig = signal(false);

/** Passende Matte zum erkannten Modell vorschlagen. */
function waehleMatteFuerModell(): void {
  const p = cutter.value?.profil;
  if (!p) return;
  if (p.id.startsWith('portrait')) {
    matte.value = 'portrait-8x12';
    halter.value = 1;
  } else if (p.id.includes('plus')) matte.value = 'cameo-plus-15x15';
  else if (p.id.includes('pro')) matte.value = 'cameo-pro-24x24';
  else matte.value = 'cameo-12x12';
}

export const job = computed<CutJob>(() => ({
  pfade: testQuadrat(seiteMm.value, abstandMm.value),
  matte: matte.value,
  werkzeug: {
    art: werkzeugArt.value,
    druck: druck.value,
    geschwindigkeit: geschwindigkeit.value,
    halter: halter.value,
    klingenVersatzMm: 0.9,
  },
}));

/** Die Befehle für die Vorschau. Ohne Verbindung mit dem Profil der Cameo 4. */
export const vorschau = computed<{ befehle: string[] } | { fehler: string }>(() => {
  const profil = cutter.value?.profil ?? profile[0]!;
  try {
    return { befehle: auftragZuBefehlen(job.value, profil) };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) };
  }
});

export async function zeichne(): Promise<void> {
  const c = cutter.value;
  if (!c || laeuft.value) return;
  fehler.value = null;
  fertig.value = false;
  laeuft.value = true;
  fortschritt.value = 0;
  try {
    await c.send(job.value, { onFortschritt: (g, gesamt) => (fortschritt.value = g / gesamt) });
    fertig.value = true;
  } catch (e) {
    if (e instanceof AbbruchFehler) fehler.value = { text: e.message };
    else zeigeFehler(e);
  } finally {
    laeuft.value = false;
    await frageStatus();
  }
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

// ---------------------------------------------------------------------------
// Checkliste (im localStorage, bleibt nur in diesem Browser)
// ---------------------------------------------------------------------------

const SPEICHER = 'vom-pixel-zum-schnitt:checkliste';

function ladeCheckliste(): ChecklistenPunkt[] {
  const leer = t.cutterTest.punkte.map(() => ({ erledigt: false, notiz: '' }));
  try {
    const gespeichert = JSON.parse(globalThis.localStorage?.getItem(SPEICHER) ?? '[]') as ChecklistenPunkt[];
    return leer.map((p, i) => ({ ...p, ...gespeichert[i] }));
  } catch {
    return leer;
  }
}

export const checkliste = signal<ChecklistenPunkt[]>(ladeCheckliste());

effect(() => {
  try {
    globalThis.localStorage?.setItem(SPEICHER, JSON.stringify(checkliste.value));
  } catch {
    // Speichern nicht möglich (z. B. privater Modus): dann eben nur für diese Sitzung.
  }
});

export function aendereCheckliste(i: number, aenderung: Partial<ChecklistenPunkt>): void {
  checkliste.value = checkliste.value.map((p, j) => (j === i ? { ...p, ...aenderung } : p));
}
