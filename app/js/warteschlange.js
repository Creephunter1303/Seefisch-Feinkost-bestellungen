// Warteschlange für Status-Änderungen (Abgeholt / wieder Offen).
//
// Die Änderung erscheint sofort auf dem Bildschirm und wird im Hintergrund gesendet:
// erst nach Ablauf der Rückgängig-Zeit, der Reihe nach, bei Netzproblemen mit
// automatischer Wiederholung. Einträge überleben Neuladen und App-Neustart – darauf
// baut später das echte Offline-Arbeiten auf.

import { lesen, schreiben } from './speicher.js';
import { Verbindungsfehler, mitZeitlimit } from './daten/fehler.js';

const SCHLUESSEL = 'warteschlange';
const WARTEZEITEN_MS = [5000, 15000, 30000, 60000, 120000];
const ZEITLIMIT_MS = 25000;

export class Warteschlange {
  constructor(datenquelle, { beiErfolg, beiAblehnung, beiAenderung }) {
    this.dq = datenquelle;
    this.beiErfolg = beiErfolg;
    this.beiAblehnung = beiAblehnung;
    this.beiAenderung = beiAenderung;
    this.eintraege = lesen(SCHLUESSEL, []);
    this.naechsteNr = this.eintraege.reduce((max, e) => Math.max(max, e.nr), 0) + 1;
    this.sendet = null; // Nr. des Eintrags, der gerade unterwegs ist
    this.timer = null;
  }

  _sichern() {
    schreiben(SCHLUESSEL, this.eintraege);
    if (this.beiAenderung) this.beiAenderung();
  }

  hinzufuegen(bestellId, status, verzoegerungMs, zusatz = {}) {
    const e = {
      nr: this.naechsteNr++,
      bestellId,
      status,
      zeit: new Date().toISOString(),
      faelligAb: Date.now() + verzoegerungMs,
      versuche: 0,
      ...zusatz,
    };
    this.eintraege.push(e);
    this._sichern();
    this.planen();
    return e.nr;
  }

  /** „Rückgängig": nimmt einen noch nicht gesendeten Eintrag zurück. false = schon unterwegs. */
  zuruecknehmen(nr) {
    if (this.sendet === nr) return false;
    const i = this.eintraege.findIndex((e) => e.nr === nr);
    if (i === -1) return false;
    this.eintraege.splice(i, 1);
    this._sichern();
    this.planen();
    return true;
  }

  anzahl() { return this.eintraege.length; }

  hatFehler() { return this.eintraege.some((e) => e.versuche > 0); }

  /** Letzter wartender Eintrag je Bestellung – den zeigt die Oberfläche statt des Server-Stands. */
  ueberlagerung() {
    const m = new Map();
    for (const e of this.eintraege) m.set(e.bestellId, e);
    return m;
  }

  /** Nach Netz-Rückkehr: Einträge mit Fehlversuchen sofort erneut senden. */
  wiederholen() {
    const jetzt = Date.now();
    for (const e of this.eintraege) if (e.versuche > 0) e.faelligAb = jetzt;
    this._sichern();
    this.planen();
  }

  planen() {
    clearTimeout(this.timer);
    if (!this.eintraege.length || this.sendet !== null) return;
    // Streng der Reihe nach: Abgeholt → Rückgängig muss in dieser Reihenfolge ankommen.
    const warte = Math.max(0, this.eintraege[0].faelligAb - Date.now());
    this.timer = setTimeout(() => this.verarbeiten(), warte);
  }

  async verarbeiten() {
    if (this.sendet !== null || !this.eintraege.length) return;
    const e = this.eintraege[0];
    if (e.faelligAb > Date.now()) { this.planen(); return; }
    this.sendet = e.nr;
    if (this.beiAenderung) this.beiAenderung();
    try {
      const antwort = await mitZeitlimit(this.dq.statusSetzen({
        id: e.bestellId, status: e.status, zeit: e.zeit, tablet: e.tablet, geraet: e.geraet,
      }), ZEITLIMIT_MS);
      this._entfernen(e.nr);
      if (this.beiErfolg) this.beiErfolg(antwort.bestellung);
    } catch (fehler) {
      if (fehler instanceof Verbindungsfehler) {
        e.versuche++;
        e.faelligAb = Date.now() + WARTEZEITEN_MS[Math.min(e.versuche - 1, WARTEZEITEN_MS.length - 1)];
        e.letzterFehler = fehler.message;
        this._sichern();
      } else {
        this._entfernen(e.nr);
        if (this.beiAblehnung) this.beiAblehnung(e, fehler);
      }
    } finally {
      this.sendet = null;
      if (this.beiAenderung) this.beiAenderung();
      this.planen();
    }
  }

  _entfernen(nr) {
    this.eintraege = this.eintraege.filter((x) => x.nr !== nr);
    this._sichern();
  }
}
