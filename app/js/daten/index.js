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

const NEU_VERBUNDEN = 'neu_verbunden';

/**
 * Einrichtungs-Link prüfen: …/#api=<Web-App-Adresse>&k=<Schlüssel>. Nimmt den ganzen Link oder
 * nur den Teil hinter „#" an (Leerzeichen/Zeilenumbrüche vom Kopieren werden entfernt).
 * → { api, schluessel } oder { fehler: 'Text für die Anzeige' }
 */
export function linkPruefen(text) {
  const roh = String(text || '').replace(/\s+/g, '');
  const teil = roh.includes('#') ? roh.slice(roh.indexOf('#') + 1) : roh;
  if (!teil.includes('api=')) {
    return { fehler: 'Das ist kein Einrichtungs-Link. Bitte den ganzen Link aus der Tabelle kopieren (Blatt „Tablets", Spalte D).' };
  }
  const p = new URLSearchParams(teil);
  const api = p.get('api') || '';
  const schluessel = p.get('k') || '';
  // Nur echte Google-Apps-Script-Adressen annehmen (kein Umleiten auf fremde Server).
  const google = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(api);
  // Nur beim Testen am Mac: Test-Server auf localhost erlauben.
  const lokal = ['localhost', '127.0.0.1'].includes(location.hostname) && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(api);
  if (!(google || lokal)) return { fehler: 'Die Adresse im Link ist keine Google-Apps-Script-Adresse. Bitte den Link neu aus der Tabelle kopieren.' };
  if (schluessel.length < 16) return { fehler: 'Der Schlüssel im Link ist unvollständig. Bitte den ganzen Link neu aus der Tabelle kopieren.' };
  return { api, schluessel };
}

function verbindungSpeichern({ api, schluessel }) {
  // Neues Tablet bzw. neuer Schlüssel: Daten aus dem Prototyp oder vom alten Stand verwerfen.
  // Gleicher Schlüssel, nur neue Web-App-Adresse (neue Bereitstellung): Wartendes behalten.
  const bisher = lesen(VERBINDUNG);
  if (!bisher || bisher.schluessel !== schluessel) {
    ['letzter_stand', 'warteschlange', 'entwurf', 'ansicht_temp', 'demo_daten'].forEach(loeschen);
  }
  schreiben(VERBINDUNG, { api, schluessel, seit: new Date().toISOString() });
  schreiben(NEU_VERBUNDEN, true);
}

/**
 * Einrichtungs-Link aus der Adresszeile auswerten. Der Teil hinter „#" wird nie an GitHub
 * übertragen. Danach verschwindet er aus der Adresszeile, damit der Schlüssel nicht in
 * Lesezeichen oder Verlauf landet.
 */
export function einrichtungAusLink() {
  if (!location.hash.includes('api=')) return false;
  const v = linkPruefen(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (v.fehler) return false;
  verbindungSpeichern(v);
  return true;
}

/**
 * Eingefügter Einrichtungs-Link (für die App vom iPhone-Home-Bildschirm: Die hat einen eigenen
 * Speicher und bekommt den Link aus Safari nicht mit). → null bei Erfolg, sonst Fehlertext.
 */
export function einrichtungAusText(text) {
  const v = linkPruefen(text);
  if (v.fehler) return v.fehler;
  verbindungSpeichern(v);
  return null;
}

/** Gerade erst verbunden (Link geöffnet oder eingefügt)? Meldet das nur einmal. */
export function neuVerbunden() {
  const ja = lesen(NEU_VERBUNDEN) === true;
  loeschen(NEU_VERBUNDEN);
  return ja;
}

/** Tablet abmelden (zurück zum Prototyp mit Beispieldaten). */
export function verbindungTrennen() {
  ['verbindung', 'letzter_stand', 'warteschlange', 'entwurf', 'ansicht_temp'].forEach(loeschen);
}
