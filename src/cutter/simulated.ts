/**
 * Simulierter Cutter: verhält sich nach außen wie ein echtes Gerät,
 * damit sich alles ohne Hardware entwickeln, testen und im Unterricht zeigen lässt.
 *
 * Der Trick: Es ist derselbe GpglCutter wie bei USB und Bluetooth, nur mit einem
 * simulierten Transport. Der Treiber-Code wird also bei jeder Simulation mitgeprüft.
 */
import { ESC, ETX } from './gpgl';
import { GpglCutter, type GpglCutterOptionen } from './gpgl-cutter';
import { profile, type GeraeteProfil } from './profile';
import { Empfangspuffer, type Transport } from './transport';

export interface SimulationsOptionen {
  /** Ist Material bzw. eine Matte eingelegt? Sonst meldet das Gerät Status "2". */
  matteGeladen?: boolean;
  /** So viele Statusabfragen lang meldet das Gerät nach jedem Block "in Bewegung". */
  bewegungsAbfragen?: number;
  /** Antwortverzögerung in ms. */
  verzoegerungMs?: number;
  /** Modell, das die Simulation vorgibt; bestimmt die FG-Antwort. */
  profil?: GeraeteProfil;
}

/**
 * Antwortet wie ein Silhouette-Gerät: auf ESC ENQ mit dem Status,
 * auf FG mit Modell und Firmware. Alle empfangenen Bytes werden aufbewahrt.
 */
export class SimulierterTransport implements Transport {
  readonly art = 'Simulation';
  readonly geraetename: string;
  matteGeladen: boolean;
  /** Alles, was der Treiber gesendet hat, in Reihenfolge. */
  readonly empfangen: Uint8Array[] = [];
  private readonly puffer = new Empfangspuffer();
  private bewegungRest = 0;
  private readonly bewegungsAbfragen: number;
  private readonly verzoegerungMs: number;
  private readonly profil: GeraeteProfil;

  constructor(optionen: SimulationsOptionen = {}) {
    this.matteGeladen = optionen.matteGeladen ?? true;
    this.bewegungsAbfragen = optionen.bewegungsAbfragen ?? 1;
    this.verzoegerungMs = optionen.verzoegerungMs ?? 0;
    this.profil = optionen.profil ?? profile[0]!;
    this.geraetename = `${this.profil.name} (simuliert)`;
  }

  async schreibe(bytes: Uint8Array): Promise<void> {
    this.empfangen.push(bytes.slice());
    if (bytes[0] === ESC && bytes.length === 2) {
      if (bytes[1] === 0x05) this.antworte(this.statusZeichen());
      return; // ESC EOT (Initialisieren) und andere: keine Antwort
    }
    const text = new TextDecoder().decode(bytes);
    if (text === `FG${String.fromCharCode(ETX)}`) {
      this.antworte(`${this.profil.namen[0]} V1.00    `);
      return;
    }
    // Ein Block mit Bewegungsbefehlen: Das Gerät ist eine Weile beschäftigt.
    this.bewegungRest = this.bewegungsAbfragen;
  }

  lese(timeoutMs: number): Promise<Uint8Array | null> {
    return this.puffer.lese(timeoutMs);
  }

  leereEingang(): void {
    this.puffer.leeren();
  }

  async schliesse(): Promise<void> {
    this.puffer.schliessen();
  }

  private statusZeichen(): string {
    if (!this.matteGeladen) return '2';
    if (this.bewegungRest > 0) {
      this.bewegungRest--;
      return '1';
    }
    return '0';
  }

  private antworte(text: string): void {
    const bytes = new TextEncoder().encode(text + String.fromCharCode(ETX));
    if (this.verzoegerungMs > 0) setTimeout(() => this.puffer.hinzufuegen(bytes), this.verzoegerungMs);
    else this.puffer.hinzufuegen(bytes);
  }
}

/** Ein Cutter ohne Hardware. Die gesendeten Bytes stehen in `simulation.empfangen`. */
export class SimulatedCutter extends GpglCutter {
  readonly simulation: SimulierterTransport;

  constructor(simulation: SimulationsOptionen = {}, optionen: GpglCutterOptionen = {}) {
    const transport = new SimulierterTransport(simulation);
    super(transport, { abfrageIntervallMs: 0, ...optionen });
    this.simulation = transport;
  }
}
