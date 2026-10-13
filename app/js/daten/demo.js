// Datenquelle für den Prototyp: tut so, als wäre ein Server da. Alles bleibt auf diesem
// Tablet (localStorage). Antworten kommen mit kleiner Verzögerung wie im echten Netz,
// und „Verbindung unterbrechen" lässt sich zum Testen einschalten.

import { Verbindungsfehler, Serverfehler } from './fehler.js';
import { DEMO_KONFIG, beispielBestellungen } from './beispieldaten.js';
import { lesen, schreiben, loeschen } from '../speicher.js';
import { heuteIso } from '../datum.js';
import { bestellungPruefen } from '../pruefung.js';

const DATEN = 'demo_daten';
const DATEN_VERSION = 3; // erhöhen, wenn sich Märkte/Fahrzeuge der Beispieldaten ändern
const EINSTELLUNGEN = 'demo_einstellungen';
const DEMO_PIN = '1234';

export function demoEinstellungen() {
  return { offline: false, weihnachten: false, tag: null, ...lesen(EINSTELLUNGEN, {}) };
}

export function demoEinstellungenSpeichern(e) { schreiben(EINSTELLUNGEN, e); }

export function demoDatenZuruecksetzen() { loeschen(DATEN); }

const kopie = (x) => JSON.parse(JSON.stringify(x));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export class DemoDaten {
  constructor() {
    this.istDemo = true;
  }

  /** Beispieldaten passend zu „heute"; selbst angelegte Bestellungen bleiben erhalten. */
  _daten() {
    const e = demoEinstellungen();
    const heute = heuteIso();
    let d = lesen(DATEN, null);
    if (!d || d.version !== DATEN_VERSION || d.erzeugtFuer !== heute || d.weihnachten !== e.weihnachten) {
      const eigene = d && d.version === DATEN_VERSION ? d.bestellungen.filter((b) => b.eigene && b.datum >= heute) : [];
      d = {
        version: DATEN_VERSION,
        erzeugtFuer: heute,
        weihnachten: e.weihnachten,
        bestellungen: beispielBestellungen(DEMO_KONFIG, heute, e.weihnachten).concat(eigene),
      };
      schreiben(DATEN, d);
    }
    return d;
  }

  async _netz() {
    await pause(250 + Math.random() * 450);
    if (demoEinstellungen().offline) throw new Verbindungsfehler('Keine Verbindung zum Server.');
  }

  _finden(d, id) {
    const b = d.bestellungen.find((x) => x.id === id);
    if (!b) throw new Serverfehler('Diese Bestellung wurde nicht gefunden. Bitte die Übersicht aktualisieren.');
    return b;
  }

  async laden() {
    await this._netz();
    const heute = heuteIso();
    const d = this._daten();
    return { konfig: kopie(DEMO_KONFIG), bestellungen: kopie(d.bestellungen.filter((b) => b.datum >= heute)) };
  }

  async neu(f) {
    await this._netz();
    const d = this._daten();
    const vorhanden = d.bestellungen.find((b) => b.id === f.id);
    if (vorhanden) return { bestellung: kopie(vorhanden) }; // schon angekommen (erneutes Senden)
    const fehler = bestellungPruefen(f, DEMO_KONFIG, { heute: heuteIso() });
    if (Object.keys(fehler).length) throw new Serverfehler(Object.values(fehler)[0]);
    const b = {
      id: f.id,
      datum: f.datum,
      markt: f.markt,
      kunde: f.kunde.trim(),
      bestellung: f.bestellung.trim(),
      kontakt: (f.kontakt || '').trim(),
      kommentar: (f.kommentar || '').trim(),
      status: 'offen',
      erfasstVon: f.mitarbeiter,
      erfasstAm: new Date().toISOString(),
      erfasstUeber: f.tablet || '',
      geaendertVon: '', geaendertAm: '',
      abgeholtAm: '',
      storniertVon: '', storniertAm: '',
      eigene: true,
    };
    d.bestellungen.push(b);
    schreiben(DATEN, d);
    return { bestellung: kopie(b) };
  }

  async aendern(f) {
    await this._netz();
    const d = this._daten();
    const b = this._finden(d, f.id);
    if (b.status === 'storniert') throw new Serverfehler('Diese Bestellung ist storniert und kann nicht mehr geändert werden.');
    const fehler = bestellungPruefen(f, DEMO_KONFIG, { heute: heuteIso(), bearbeiten: true });
    if (Object.keys(fehler).length) throw new Serverfehler(Object.values(fehler)[0]);
    Object.assign(b, {
      markt: f.markt,
      datum: f.datum,
      kunde: f.kunde.trim(),
      bestellung: f.bestellung.trim(),
      kontakt: (f.kontakt || '').trim(),
      kommentar: (f.kommentar || '').trim(),
      geaendertVon: f.mitarbeiter,
      geaendertAm: new Date().toISOString(),
    });
    schreiben(DATEN, d);
    return { bestellung: kopie(b) };
  }

  async stornieren({ id, mitarbeiter }) {
    await this._netz();
    const d = this._daten();
    const b = this._finden(d, id);
    if (!DEMO_KONFIG.mitarbeiter.includes(mitarbeiter)) throw new Serverfehler('Bitte antippen, wer storniert.');
    if (b.status !== 'storniert') {
      b.status = 'storniert';
      b.storniertVon = mitarbeiter;
      b.storniertAm = new Date().toISOString();
      schreiben(DATEN, d);
    }
    return { bestellung: kopie(b) };
  }

  async statusSetzen({ id, status, zeit }) {
    await this._netz();
    if (status !== 'abgeholt' && status !== 'offen') throw new Serverfehler('Unbekannter Status: ' + status);
    const d = this._daten();
    const b = this._finden(d, id);
    if (b.status === 'storniert' && status === 'abgeholt') {
      throw new Serverfehler('Die Bestellung von ' + b.kunde + ' wurde inzwischen storniert.');
    }
    if (b.status === 'storniert') { b.storniertVon = ''; b.storniertAm = ''; } // Storno aufheben
    b.status = status;
    b.abgeholtAm = status === 'abgeholt' ? (zeit || new Date().toISOString()) : '';
    schreiben(DATEN, d);
    return { bestellung: kopie(b) };
  }

  async pinPruefen(pin) {
    await this._netz();
    return pin === DEMO_PIN;
  }
}
