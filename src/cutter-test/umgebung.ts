/** Welche Browser-Schnittstellen für die direkte Cutter-Ansteuerung stehen zur Verfügung? */
export interface Umgebung {
  sichererKontext: boolean;
  webUsb: boolean;
  webBluetooth: boolean;
}

/**
 * Prüft die Umgebung. Das Objekt wird als Parameter übergeben,
 * damit sich die Funktion ohne echten Browser testen lässt.
 */
export function pruefeUmgebung(g: {
  isSecureContext?: boolean;
  navigator?: Partial<Pick<Navigator, 'usb' | 'bluetooth'>>;
}): Umgebung {
  return {
    sichererKontext: g.isSecureContext === true,
    webUsb: g.navigator?.usb !== undefined,
    webBluetooth: g.navigator?.bluetooth !== undefined,
  };
}
