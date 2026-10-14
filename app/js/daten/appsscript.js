// Datenquelle für den echten Betrieb: das Apps-Script-Backend an der Google-Tabelle
// (backend/Code.gs). Server-Adresse und Schlüssel kommen über den Einrichtungs-Link.
//
// Anfragen gehen als POST mit Content-Type text/plain raus – so verlangt der Browser keine
// Vorab-Anfrage (CORS), die Apps Script nicht beantworten kann.

import { Verbindungsfehler, Zugangsfehler, Serverfehler } from './fehler.js';
import { geraeteId } from '../speicher.js';
import { APP_VERSION } from '../version.js';

const kopie = (x) => JSON.parse(JSON.stringify(x));

export class AppsScriptDaten {
  constructor({ api, schluessel }) {
    this.istDemo = false;
    this.api = api;
    this.schluessel = schluessel;
    this.letzte = null; // letzter vollständiger Stand – für „unverändert"-Antworten
    this.tablet = null;
  }

  async _senden(aktion, daten = {}) {
    let antwort;
    try {
      antwort = await fetch(this.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ aktion, schluessel: this.schluessel, geraet: geraeteId(), version: APP_VERSION, ...daten }),
        redirect: 'follow',
        cache: 'no-store',
      });
    } catch (e) {
      throw new Verbindungsfehler('Keine Verbindung zum Server.');
    }
    if (!antwort.ok) throw new Verbindungsfehler('Der Server antwortet nicht richtig (Fehler ' + antwort.status + ').');
    let json;
    try {
      json = await antwort.json();
    } catch (e) {
      throw new Verbindungsfehler('Unerwartete Antwort vom Server.');
    }
    if (!json.ok) {
      if (json.code === 'schluessel') throw new Zugangsfehler(json.fehler);
      throw new Serverfehler(json.fehler);
    }
    if (json.tablet) this.tablet = json.tablet;
    return json;
  }

  async laden() {
    const r = await this._senden('laden', { stand: this.letzte ? this.letzte.stand : '' });
    if (!(r.unveraendert && this.letzte)) {
      this.letzte = { konfig: r.konfig, bestellungen: r.bestellungen, stand: r.stand };
    }
    return { konfig: kopie(this.letzte.konfig), bestellungen: kopie(this.letzte.bestellungen), tablet: this.tablet };
  }

  async neu(felder) {
    const r = await this._senden('neu', felder);
    return { bestellung: r.bestellung, warnung: r.warnung };
  }

  async aendern(felder) {
    const r = await this._senden('aendern', felder);
    return { bestellung: r.bestellung, warnung: r.warnung };
  }

  async stornieren({ id, mitarbeiter }) {
    const r = await this._senden('stornieren', { id, mitarbeiter });
    return { bestellung: r.bestellung, warnung: r.warnung };
  }

  async statusSetzen({ id, status, zeit }) {
    const r = await this._senden('status', { id, status, zeit });
    return { bestellung: r.bestellung, warnung: r.warnung };
  }

  async pinPruefen(pin) {
    const r = await this._senden('pin', { pin });
    if (!r.richtig && r.hinweis) throw new Serverfehler(r.hinweis);
    return !!r.richtig;
  }
}
