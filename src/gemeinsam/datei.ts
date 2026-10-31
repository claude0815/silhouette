/** Dateien herunterladen, ganz ohne Server: Der Browser speichert einen Blob. */
export function speichereBlob(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function speichereText(inhalt: string, dateiname: string, typ: string): void {
  speichereBlob(new Blob([inhalt], { type: typ }), dateiname);
}
