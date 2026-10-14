// Datenanbindung. Die Oberfläche spricht nur mit diesem Interface – zieht das Backend
// später um (eigener Server statt Apps Script), wird nur die Datenquelle getauscht.
//
//   laden()                                   → { konfig, bestellungen, tablet? }  (Bestellungen ab heute)
//   neu(felder)                               → { bestellung, warnung? }   felder.id = Bestell-ID vom Tablet
//   aendern(felder)                           → { bestellung, warnung? }
//   stornieren({ id, mitarbeiter })           → { bestellung, warnung? }
//   statusSetzen({ id, status, zeit })        → { bestellung, warnung? }   status: 'abgeholt' | 'offen'
//   pinPruefen(pin)                           → true | false
//
// konfig = { fahrzeuge: [...], maerkte: [{ name, tage: [0–6], fahrzeug }], mitarbeiter: [...] }
// Fehler: Verbindungsfehler (nichts gespeichert, erneut versuchen; Unterart Zugangsfehler = Tablet
// gesperrt) oder Serverfehler (abgelehnt). Neu-Anlage ist idempotent (gleiche Bestell-ID).

import { DemoDaten } from './demo.js';
import { AppsScriptDaten } from './appsscript.js';
import { lesen, schreiben, loeschen } from '../speicher.js';

const VERBINDUNG = 'verbindung';

/** Echte Anbindung, sobald das Tablet über einen Einrichtungs-Link eingerichtet ist – sonst Prototyp. */
export function datenquelleErstellen() {
  const v = lesen(VERBINDUNG);
  if (v && v.api && v.schluessel) return new AppsScriptDaten(v);
  return new DemoDaten();
}

/**
 * Einrichtungs-Link auswerten: …/#api=<Web-App-Adresse>&k=<Schlüssel>
 * Der Teil hinter „#" wird nie an GitHub übertragen. Nach dem Speichern verschwindet er
 * aus der Adresszeile, damit der Schlüssel nicht in Lesezeichen oder Verlauf landet.
 */
export function einrichtungAusLink() {
  const hash = location.hash.slice(1);
  if (!hash.includes('api=')) return false;
  const p = new URLSearchParams(hash);
  const api = p.get('api') || '';
  const schluessel = p.get('k') || '';
  history.replaceState(null, '', location.pathname + location.search);
  // Nur echte Google-Apps-Script-Adressen annehmen (kein Umleiten auf fremde Server).
  const google = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(api);
  // Nur beim Testen am Mac: Test-Server auf localhost erlauben.
  const lokal = ['localhost', '127.0.0.1'].includes(location.hostname) && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(api);
  if (!(google || lokal) || schluessel.length < 16) return false;
  // Neues Tablet bzw. neuer Schlüssel: Daten aus dem Prototyp oder vom alten Stand verwerfen.
  ['letzter_stand', 'warteschlange', 'entwurf', 'ansicht_temp', 'demo_daten'].forEach(loeschen);
  schreiben(VERBINDUNG, { api, schluessel, seit: new Date().toISOString() });
  return true;
}

/** Tablet abmelden (zurück zum Prototyp mit Beispieldaten). */
export function verbindungTrennen() {
  ['verbindung', 'letzter_stand', 'warteschlange', 'entwurf', 'ansicht_temp'].forEach(loeschen);
}
