// Datenanbindung. Die Oberfläche spricht nur mit diesem Interface – zieht das Backend
// später um (eigener Server statt Apps Script), wird nur die Datenquelle getauscht.
//
//   laden()                                   → { konfig, bestellungen }  (Bestellungen ab heute)
//   neu(felder)                               → { bestellung }   felder.id = Bestell-ID vom Tablet
//   aendern(felder)                           → { bestellung }
//   stornieren({ id, mitarbeiter, … })        → { bestellung }
//   statusSetzen({ id, status, zeit, … })     → { bestellung }   status: 'abgeholt' | 'offen'
//   pinPruefen(pin)                           → true | false
//
// konfig = { fahrzeuge: [...], maerkte: [{ name, tage: [0–6], fahrzeug }], mitarbeiter: [...] }
// Fehler: Verbindungsfehler (nichts gespeichert, erneut versuchen) oder Serverfehler (abgelehnt).
// Neu-Anlage ist idempotent: Kommt dieselbe Bestell-ID zweimal an, wird nichts doppelt angelegt.

import { DemoDaten } from './demo.js';

export function datenquelleErstellen() {
  // Schritt 1 (Prototyp): Beispieldaten. Schritt 2 ergänzt die Apps-Script-Anbindung.
  return new DemoDaten();
}
