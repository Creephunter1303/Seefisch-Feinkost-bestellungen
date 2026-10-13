// Prüfung einer Bestellung – dieselben Regeln wie in v3. Wird im Formular (sofort beim
// Ausfüllen) und von der Datenquelle benutzt; das Backend prüft zusätzlich noch einmal selbst.

import { plusTage, wochentag, datumKurz, VORLAUF_TAGE } from './datum.js';

export const MAX_LAENGE = { kunde: 100, bestellung: 1000, kontakt: 100, kommentar: 500 };

/** Liefert { feld: 'Fehlertext' } – leeres Objekt heißt: alles in Ordnung. */
export function bestellungPruefen(f, konfig, { heute, bearbeiten = false }) {
  const fehler = {};
  const markt = konfig.maerkte.find((m) => m.name === f.markt);

  if (!markt) fehler.markt = 'Bitte einen Markt antippen.';

  if (!f.datum) {
    fehler.datum = markt ? 'Bitte einen Abholtag antippen.' : 'Erst den Markt wählen, dann den Abholtag.';
  } else if (markt && !markt.tage.includes(wochentag(f.datum))) {
    fehler.datum = datumKurz(f.datum) + ' ist kein Markttag von ' + markt.name + '.';
  } else if (f.datum < heute) {
    fehler.datum = 'Der Abholtag liegt in der Vergangenheit.';
  } else if (f.datum > plusTage(heute, VORLAUF_TAGE + 8)) {
    fehler.datum = 'Höchstens 2 Monate im Voraus.';
  }

  if (!String(f.kunde || '').trim()) fehler.kunde = 'Bitte den Namen des Kunden eintragen.';
  if (!String(f.bestellung || '').trim()) fehler.bestellung = 'Bitte eintragen, was bestellt wurde.';

  for (const [feld, max] of Object.entries(MAX_LAENGE)) {
    if (String(f[feld] || '').length > max) fehler[feld] = 'Höchstens ' + max + ' Zeichen.';
  }

  if (!f.mitarbeiter || !konfig.mitarbeiter.includes(f.mitarbeiter)) {
    fehler.mitarbeiter = bearbeiten ? 'Bitte antippen, wer die Änderung macht.' : 'Bitte antippen, wer die Bestellung aufnimmt.';
  }
  return fehler;
}
