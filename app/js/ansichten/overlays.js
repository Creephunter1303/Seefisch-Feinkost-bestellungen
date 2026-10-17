// Einblendungen von unten: Ansicht wählen, Admin-PIN, Standard-Ansicht.

import { h, vibrieren, toast } from '../ui.js';
import { icon } from '../icons.js';
import { auswahlKnopf } from '../komponenten.js';
import { heuteIso } from '../datum.js';
import { ansichtGleich, ansichtName, maerkteAmTag, tageText, maerkteNachFahrzeug } from '../logik.js';
import { verbindungTrennen } from '../daten/index.js';

export function overlayZeichnen(app) {
  const o = app.zustand.overlay;
  const baue = { ansicht: ansichtBlatt, pin: pinBlatt, standard: standardBlatt }[o.name];
  const blatt = h('div', { class: 'blatt', role: 'dialog', 'aria-modal': 'true' }, baue ? baue(app) : null);
  const hintergrund = h('div', { class: 'overlay-hintergrund' }, blatt);
  hintergrund.addEventListener('click', (e) => { if (e.target === hintergrund) app.overlaySchliessen(); });
  return hintergrund;
}

function blattKopf(app, titel) {
  return h('div', { class: 'blatt-kopf' },
    h('h2', null, titel),
    h('button', { type: 'button', class: 'knopf', onclick: () => app.overlaySchliessen() }, icon('kreuz', { groesse: 20, strich: 2.5 }), 'Schließen'));
}

// ---------- Ansicht wählen ----------

function ansichtBlatt(app) {
  const z = app.zustand;
  const k = z.konfig;
  const heute = heuteIso();
  const waehlen = (a) => { app.ansichtSetzen(a); app.overlaySchliessen(); };
  const heuteText = (f) => {
    const m = maerkteAmTag(k, { typ: 'fahrzeug', wert: f }, heute);
    return m.length ? 'heute: ' + m.map((x) => x.name).join(', ') : 'heute kein Markt';
  };
  const standardMarke = (a) => (ansichtGleich(a, z.standard) ? ' · Standard' : '');

  return [
    blattKopf(app, 'Welche Bestellungen anzeigen?'),
    app.istVoruebergehend() && h('button', {
      type: 'button', class: 'knopf hinweis breit blatt-abstand', onclick: () => waehlen(z.standard),
    }, 'Zurück zur Standard-Ansicht: ' + ansichtName(z.standard)),
    h('h3', { class: 'blatt-titel' }, 'Fahrzeug'),
    h('div', { class: 'auswahl-gitter gross' },
      k.fahrzeuge.map((f) => {
        const a = { typ: 'fahrzeug', wert: f };
        return auswahlKnopf(f, heuteText(f) + standardMarke(a), ansichtGleich(a, z.ansicht), () => waehlen(a), 'lkw');
      }),
      auswahlKnopf('Alle Märkte', 'alle Fahrzeuge' + standardMarke({ typ: 'alle' }), z.ansicht.typ === 'alle', () => waehlen({ typ: 'alle' }), 'karte')),
    // Einzelne Märkte braucht man selten – bewusst kleiner und zurückhaltender.
    h('h3', { class: 'blatt-titel dezent' }, 'Oder einen einzelnen Markt'),
    maerkteNachFahrzeug(k).map(([fahrzeug, maerkte]) => [
      h('div', { class: 'gruppe-titel klein' }, fahrzeug),
      h('div', { class: 'auswahl-gitter dezent' },
        maerkte.map((m) => {
          const a = { typ: 'markt', wert: m.name };
          return auswahlKnopf(m.name, tageText(m), ansichtGleich(a, z.ansicht), () => waehlen(a));
        })),
    ]),
  ];
}

// ---------- Admin-PIN ----------
// o.ziel: 'standard' (Standard-Ansicht ändern, Vorgabe) oder 'abmelden' (Tablet von der Tabelle trennen)

function pinBlatt(app) {
  const o = app.zustand.overlay;
  const abmelden = o.ziel === 'abmelden';
  if (o.pin === undefined) o.pin = '';
  const neu = () => app.overlayNeuZeichnen();
  const tippen = (ziffer) => {
    if (o.prueft || o.pin.length >= 4) return;
    o.pin += ziffer;
    o.fehler = null;
    vibrieren(15);
    if (o.pin.length === 4) {
      o.prueft = true;
      app.pinPruefen(o.pin)
        .then((ok) => {
          o.prueft = false;
          if (ok && abmelden) { verbindungTrennen(); location.reload(); return; }
          if (ok) { app.overlayOeffnen('standard', {}, { ersetzen: true }); return; }
          o.pin = '';
          o.fehler = 'Falsche PIN. Bitte erneut versuchen.';
          vibrieren([80, 60, 80]);
          neu();
        })
        .catch((e) => {
          o.prueft = false;
          o.pin = '';
          o.fehler = 'PIN konnte nicht geprüft werden: ' + e.message;
          neu();
        });
    }
    neu();
  };
  const ziffer = (zf) => h('button', { type: 'button', class: 'pin-taste', onclick: () => tippen(zf) }, zf);
  return [
    blattKopf(app, abmelden ? 'Tablet abmelden' : 'Admin-PIN eingeben'),
    abmelden ? abmeldenHinweis(app) : h('p', { class: 'hinweis-text' }, 'Nur für die Grundeinstellung des Tablets.'),
    h('div', { class: 'pin-punkte', 'aria-label': o.pin.length + ' von 4 Ziffern' },
      [0, 1, 2, 3].map((i) => h('span', { class: 'pin-punkt' + (i < o.pin.length ? ' voll' : '') }))),
    o.prueft && h('p', { class: 'pin-status' }, 'Wird geprüft …'),
    o.fehler && h('div', { class: 'meldung fehler', role: 'alert' }, o.fehler),
    h('div', { class: 'pin-feld' },
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(ziffer),
      h('button', { type: 'button', class: 'pin-taste klein', onclick: () => { o.pin = ''; o.fehler = null; neu(); } }, 'Löschen'),
      ziffer('0'),
      h('button', { type: 'button', class: 'pin-taste klein', onclick: () => { o.pin = o.pin.slice(0, -1); neu(); } }, '⌫')),
  ];
}

function abmeldenHinweis(app) {
  const n = app.warteschlange.anzahl();
  return [
    h('p', { class: 'hinweis-text' },
      'Admin-PIN eingeben, um dieses Tablet von der Google-Tabelle zu trennen. Danach zeigt es nur noch ' +
      'Beispieldaten, bis es mit dem Einrichtungs-Link neu eingerichtet wird.'),
    n > 0 && h('div', { class: 'meldung fehler' },
      '⚠ ' + n + (n === 1 ? ' Änderung ist' : ' Änderungen sind') + ' noch nicht gesendet und ginge' + (n === 1 ? '' : 'n') + ' verloren.'),
  ];
}

// ---------- Standard-Ansicht festlegen (nach richtiger PIN) ----------

function standardBlatt(app) {
  const z = app.zustand;
  const waehlen = (a) => {
    app.standardSetzen(a);
    app.overlaySchliessen();
    toast('Standard-Ansicht dieses Tablets: ' + ansichtName(a));
  };
  return [
    blattKopf(app, 'Standard-Ansicht festlegen'),
    h('p', { class: 'hinweis-text' }, 'Diese Ansicht zeigt das Tablet beim Öffnen und jeden Morgen.'),
    h('div', { class: 'auswahl-gitter gross' },
      z.konfig.fahrzeuge.map((f) => {
        const a = { typ: 'fahrzeug', wert: f };
        return auswahlKnopf(f, null, ansichtGleich(a, z.standard), () => waehlen(a), 'lkw');
      }),
      auswahlKnopf('Firma', 'alle Märkte', z.standard && z.standard.typ === 'alle', () => waehlen({ typ: 'alle' }), 'firma')),
  ];
}
