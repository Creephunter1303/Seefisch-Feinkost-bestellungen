// Einblendungen von unten: Ansicht wählen, Tag wählen, Admin-PIN, Standard-Ansicht.

import { h, vibrieren, toast } from '../ui.js';
import { icon } from '../icons.js';
import { auswahlKnopf } from '../komponenten.js';
import { heuteIso, plusTage, wochenstart, kalenderwoche, VORLAUF_TAGE, monatKurz, ausIso, TAGE_KURZ } from '../datum.js';
import { ansichtGleich, ansichtName, maerkteAmTag, fuerAnsicht, istErledigt, tageText, mitSonntag, maerkteNachFahrzeug } from '../logik.js';

export function overlayZeichnen(app) {
  const o = app.zustand.overlay;
  const baue = { ansicht: ansichtBlatt, tag: tagBlatt, pin: pinBlatt, standard: standardBlatt }[o.name];
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
      type: 'button', class: 'knopf betont breit blatt-abstand', onclick: () => waehlen(z.standard),
    }, '↩ Zurück zur Standard-Ansicht: ' + ansichtName(z.standard)),
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

// ---------- Tag wählen (Kalender der nächsten 9 Wochen) ----------

function tagBlatt(app) {
  const z = app.zustand;
  const k = z.konfig;
  const heute = heuteIso();
  const max = plusTage(heute, VORLAUF_TAGE);
  const spalten = mitSonntag(k) ? 7 : 6;
  const offenProTag = new Map();
  for (const b of fuerAnsicht(app.bestellungen(), k, z.ansicht)) {
    if (!istErledigt(b)) offenProTag.set(b.datum, (offenProTag.get(b.datum) || 0) + 1);
  }

  const kopfzeile = h('div', { class: 'kalender-zeile kalender-kopf', style: '--spalten:' + spalten },
    h('span', null, 'KW'),
    [1, 2, 3, 4, 5, 6, 0].slice(0, spalten).map((t) => h('span', null, TAGE_KURZ[t])));

  const wochen = [];
  for (let w = wochenstart(heute); w <= max; w = plusTage(w, 7)) {
    const zellen = [];
    for (let i = 0; i < spalten; i++) {
      const t = plusTage(w, i);
      const anzahl = offenProTag.get(t) || 0;
      const moeglich = t >= heute && t <= max && (maerkteAmTag(k, z.ansicht, t).length > 0 || anzahl > 0);
      const d = ausIso(t);
      const gewaehlt = z.zeitraum === 'tag' && z.tag === t;
      zellen.push(h('button', {
        type: 'button',
        class: 'tag-zelle' + (t === heute ? ' heute' : '') + (gewaehlt ? ' gewaehlt' : '') + (anzahl ? ' hat' : ''),
        disabled: !moeglich,
        'aria-label': t + (anzahl ? ', ' + anzahl + ' offen' : ''),
        onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(t); app.overlaySchliessen(); },
      },
        h('span', { class: 'tag-nr' }, String(d.getDate())),
        (d.getDate() === 1 || t === heute) && h('span', { class: 'tag-monat' }, t === heute ? 'heute' : monatKurz(t)),
        anzahl > 0 && h('span', { class: 'tag-anzahl' }, anzahl + ' offen')));
    }
    const wocheStart = w;
    wochen.push(h('div', { class: 'kalender-zeile', style: '--spalten:' + spalten },
      h('button', {
        type: 'button', class: 'kw-knopf', 'aria-label': 'Woche ' + kalenderwoche(w) + ' anzeigen',
        onclick: () => { app.zeitraumSetzen('woche'); app.tagSetzen(wocheStart < heute ? heute : wocheStart); app.overlaySchliessen(); },
      }, String(kalenderwoche(w))),
      zellen));
  }

  return [
    blattKopf(app, 'Tag wählen'),
    h('p', { class: 'hinweis-text' }, 'Antippbar sind die Markttage ' + (z.ansicht.typ === 'alle' ? 'aller Märkte' : 'von ' + ansichtName(z.ansicht)) + '. Tipp auf die Wochennummer zeigt die ganze Woche.'),
    h('div', { class: 'kalender' }, kopfzeile, wochen),
  ];
}

// ---------- Admin-PIN ----------

function pinBlatt(app) {
  const o = app.zustand.overlay;
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
    blattKopf(app, 'Admin-PIN eingeben'),
    h('p', { class: 'hinweis-text' }, 'Nur für die Grundeinstellung des Tablets.'),
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
