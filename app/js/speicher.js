// Dauerhafte Ablage auf dem Tablet (localStorage). Jeder Zugriff kann fehlschlagen
// (Privatmodus, voller Speicher) – dann arbeitet die App ohne Gedächtnis weiter.

const PREFIX = 'sf_';

export function lesen(schluessel, standard = null) {
  try {
    const roh = localStorage.getItem(PREFIX + schluessel);
    return roh === null ? standard : JSON.parse(roh);
  } catch (e) {
    return standard;
  }
}

export function schreiben(schluessel, wert) {
  try {
    localStorage.setItem(PREFIX + schluessel, JSON.stringify(wert));
    return true;
  } catch (e) {
    return false;
  }
}

export function loeschen(schluessel) {
  try { localStorage.removeItem(PREFIX + schluessel); } catch (e) { /* egal */ }
}

/** Löscht alles, was diese App gespeichert hat (nur für den Prototyp-Reset). */
export function allesLoeschen() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* egal */ }
}

/** Bittet den Browser, die Daten nicht bei Speicherknappheit zu löschen. */
export function dauerhaftAnfordern() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { /* egal */ }
}

/** Zufällige, dauerhafte Kennung dieses Tablets – steht im Protokoll. */
export function geraeteId() {
  let id = lesen('geraete_id');
  if (!id) {
    id = 'G-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    schreiben('geraete_id', id);
  }
  return id;
}
