// Startseite: Kopfleiste mit Fahrzeug-Auswahl, Tagesleiste (Heute + nächste Markttage + Woche),
// darunter die Zettel nach Markt gruppiert. Gestaltung: Designvorlage F6.

import { h } from '../ui.js';
import { icon } from '../icons.js';
import { demoStreifen, syncAnzeige, marktKopf, zettel } from '../komponenten.js';
import {
  heuteIso, plusTage, datumLang, datumKurz, relativerTag, wochenstart, kalenderwoche, wochenText,
  wochentag, ausIso, TAGE_KURZ, VORLAUF_TAGE,
} from '../datum.js';
import {
  ansichtName, ansichtFuer, fuerAnsicht, sortieren, istErledigt, suchen, maerkteAmTag, mitSonntag,
} from '../logik.js';

export function listeZeichnen(app) {
  const z = app.zustand;
  return h('div', { class: 'bs bs-liste' },
    app.istDemo && demoStreifen(),
    h('header', { class: 'kopf' },
      kopfZeile(app),
      z.sucheOffen ? suchLeiste(app) : tagesleiste(app)),
    app.istVoruebergehend() && tempLeiste(app),
    h('main', { class: 'liste', id: 'listen-inhalt' }, inhaltBauen(app)),
    h('footer', { class: 'fuss-leiste' },
      h('button', { type: 'button', class: 'primaer', onclick: () => app.neueBestellung() },
        icon('plus', { groesse: 26, strich: 3 }), 'Neue Bestellung')));
}

/** Nur den Listenbereich neu aufbauen (z. B. beim Tippen in der Suche – Tastatur bleibt offen). */
export function listenInhaltErneuern(app) {
  const ziel = document.getElementById('listen-inhalt');
  if (!ziel) return false;
  ziel.replaceChildren(...inhaltBauen(app));
  return true;
}

// ---------- Kopfleiste ----------

function kopfZeile(app) {
  const z = app.zustand;
  const symbol = z.ansicht.typ === 'alle' ? 'karte' : z.ansicht.typ === 'markt' ? 'ort' : 'lkw';
  return h('div', { class: 'kopf-zeile' },
    h('button', {
      type: 'button', class: 'fahrzeug',
      'aria-label': 'Ansicht wählen: ' + ansichtName(z.ansicht),
      onclick: () => app.overlayOeffnen('ansicht'),
    },
      icon(symbol),
      h('span', { class: 'fahrzeug-name' }, ansichtName(z.ansicht)),
      icon('pfeilRunter', { groesse: 20, strich: 2.5 })),
    h('div', { class: 'platzhalter' }),
    syncAnzeige(app),
    h('button', { type: 'button', class: 'icon-knopf', 'aria-label': 'Suchen', onclick: () => app.sucheOeffnen() },
      icon('suche', { groesse: 26, strich: 2.4 })),
    h('button', { type: 'button', class: 'icon-knopf', 'aria-label': 'Einstellungen', onclick: () => app.navigieren('einstellungen') },
      icon('zahnrad', { groesse: 26 })));
}

function tempLeiste(app) {
  const z = app.zustand;
  return h('div', { class: 'temp-leiste' },
    h('span', { class: 'temp-text' }, 'Vorübergehend: ', h('strong', null, ansichtName(z.ansicht))),
    h('button', {
      type: 'button', class: 'knopf',
      onclick: () => { app.ansichtSetzen(z.standard); app.render(); },
    }, icon('pfeilLinks', { groesse: 20, strich: 2.5 }), 'Zurück zu ' + ansichtName(z.standard)));
}

// ---------- Tagesleiste: Heute + nächste 4 Markttage + ganze Woche ----------

function offenProTag(app) {
  const z = app.zustand;
  const m = new Map();
  for (const b of fuerAnsicht(app.bestellungen(), z.konfig, z.ansicht)) {
    if (b.status === 'offen') m.set(b.datum, (m.get(b.datum) || 0) + 1);
  }
  return m;
}

function tagesleiste(app) {
  const z = app.zustand;
  const heute = heuteIso();
  const max = plusTage(heute, VORLAUF_TAGE);
  const offen = offenProTag(app);
  const tage = [];
  for (let t = plusTage(heute, 1); t <= max && tage.length < 4; t = plusTage(t, 1)) {
    if (maerkteAmTag(z.konfig, z.ansicht, t).length) tage.push(t);
  }
  // Ein weiter entfernter Tag (aus dem Kalender gewählt) ersetzt die letzte Kachel.
  if (z.zeitraum === 'tag' && z.tag !== heute && !tage.includes(z.tag)) {
    if (tage.length === 4) tage.pop();
    tage.push(z.tag);
    tage.sort();
  }
  return h('nav', { class: 'tage', 'aria-label': 'Tage' },
    tagKachel(app, heute, true, offen.get(heute) || 0),
    tage.map((t) => tagKachel(app, t, false, offen.get(t) || 0)),
    wochenKachel(app));
}

function tagKachel(app, t, istHeute, anzahl) {
  const z = app.zustand;
  const aktiv = z.zeitraum === 'tag' && z.tag === t;
  return h('button', {
    type: 'button',
    class: 'tag' + (aktiv ? ' aktiv' : ''),
    'aria-pressed': aktiv ? 'true' : 'false',
    'aria-label': (istHeute ? 'Heute, ' : '') + datumLang(t) + ', ' + anzahl + ' offen',
    onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(t); },
  },
    h('span', { class: 'nr' }, String(ausIso(t).getDate())),
    h('span', { class: 'text' },
      h('span', { class: 'wt' }, istHeute ? 'HEUTE' : TAGE_KURZ[wochentag(t)].toUpperCase()),
      h('span', { class: 'anz nur-hoch' }, istHeute ? anzahl + ' offen' : anzahl ? String(anzahl) : '–'),
      h('span', { class: 'anz nur-quer' }, istHeute ? anzahl + ' offen' : anzahl ? anzahl + ' Best.' : 'keine')));
}

/** Welche Woche „Ganze KW" zeigt: am Samstag/Sonntag ist die laufende Woche praktisch vorbei → nächste Woche. */
function wocheAb() {
  const heute = heuteIso();
  const wt = wochentag(heute);
  if (wt === 6) return plusTage(heute, 2);
  if (wt === 0) return plusTage(heute, 1);
  return heute;
}

function wochenKachel(app) {
  const z = app.zustand;
  const aktiv = z.zeitraum === 'woche';
  return h('button', {
    type: 'button',
    class: 'tag' + (aktiv ? ' aktiv' : ''),
    'aria-pressed': aktiv ? 'true' : 'false',
    'aria-label': 'Ganze Kalenderwoche anzeigen',
    onclick: () => { if (!aktiv) app.tagSetzen(wocheAb()); app.zeitraumSetzen('woche'); },
  },
    h('span', { class: 'nr' }, 'KW'),
    h('span', { class: 'text' },
      h('span', { class: 'wt nur-hoch' }, 'GANZE'),
      h('span', { class: 'wt nur-quer' }, 'WOCHE'),
      h('span', { class: 'anz nur-hoch' }, 'Woche'),
      h('span', { class: 'anz nur-quer' }, 'alle')));
}

// ---------- Suche (ersetzt die Tagesleiste) ----------

function suchLeiste(app) {
  const z = app.zustand;
  const feld = h('input', {
    id: 'suchfeld', class: 'eingabe', type: 'search', value: z.suche, autocomplete: 'off',
    placeholder: 'Kunde oder Ware suchen …', enterkeyhint: 'search', 'aria-label': 'Suche',
  });
  feld.addEventListener('input', () => {
    z.suche = feld.value;
    listenInhaltErneuern(app);
  });
  return h('div', { class: 'such-leiste' },
    feld,
    h('button', { type: 'button', class: 'knopf', onclick: () => app.sucheSchliessen() },
      icon('kreuz', { groesse: 20, strich: 2.5 }), 'Schließen'));
}

// ---------- Inhalt ----------

function inhaltBauen(app) {
  const z = app.zustand;
  if (!z.konfig) return [h('div', { class: 'leer' }, 'Bestellungen werden geladen …')];
  const alle = app.bestellungen();
  const inAnsicht = fuerAnsicht(alle, z.konfig, z.ansicht);
  if (z.sucheOffen) return sucheBauen(app, alle, inAnsicht);
  return z.zeitraum === 'woche' ? wocheBauen(app, inAnsicht) : tagBauen(app, inAnsicht);
}

/** Offene oben, dann abgeholte, dann stornierte; jeweils nach Kunde. */
function zettelSortieren(liste) {
  const rang = { offen: 0, abgeholt: 1, storniert: 2 };
  return [...liste].sort((a, b) => (rang[a.status] - rang[b.status]) || a.kunde.localeCompare(b.kunde, 'de'));
}

function raster(app, liste) {
  return h('div', { class: 'raster' }, liste.map((b) => zettel(app, b)));
}

/** Bestellungen eines Tages, nach Markt gruppiert (Reihenfolge wie in der Tabelle). */
function marktGruppen(app, amTag, maerkte, { klein = false } = {}) {
  const namen = maerkte.map((m) => m.name);
  for (const b of sortieren(amTag, app.zustand.konfig)) if (!namen.includes(b.markt)) namen.push(b.markt);
  return namen.flatMap((name) => {
    const vomMarkt = zettelSortieren(amTag.filter((b) => b.markt === name));
    return [
      marktKopf(app, name, vomMarkt, { klein }),
      vomMarkt.length ? raster(app, vomMarkt) : h('div', { class: 'leer-zeile' }, 'Keine Bestellungen für diesen Markt'),
    ];
  });
}

function tagBauen(app, liste) {
  const z = app.zustand;
  const tag = z.tag;
  const amTag = liste.filter((b) => b.datum === tag);
  const maerkte = maerkteAmTag(z.konfig, z.ansicht, tag);
  if (!amTag.length) {
    return [...maerkte.map((m) => marktKopf(app, m.name, [], { zaehler: false })), leerTag(app, liste, tag, maerkte)];
  }
  return marktGruppen(app, amTag, maerkte);
}

function leerTag(app, liste, tag, maerkte) {
  const z = app.zustand;
  const rel = relativerTag(tag);
  const wann = rel ? rel.toLowerCase() : 'am ' + datumKurz(tag);
  let titel;
  if (maerkte.length) titel = (rel || 'Am ' + datumKurz(tag)) + ' keine Bestellungen ' + ansichtFuer(z.ansicht);
  else if (z.ansicht.typ === 'alle') titel = (rel || 'Am ' + datumKurz(tag)) + ' ist kein Markttag';
  else if (z.ansicht.typ === 'markt') titel = z.ansicht.wert + ' findet ' + wann + ' nicht statt';
  else titel = z.ansicht.wert + ' hat ' + wann + ' keinen Markt';

  const kommende = sortieren(liste.filter((b) => b.datum > tag && !istErledigt(b)), z.konfig);
  let weiter;
  if (kommende.length) {
    const naechster = kommende[0].datum;
    const anzahl = kommende.filter((b) => b.datum === naechster).length;
    weiter = [
      h('p', { class: 'leer-text' }, 'Nächste Bestellungen: ', h('strong', null, datumLang(naechster)), ' (' + anzahl + ')'),
      h('button', { type: 'button', class: 'knopf', onclick: () => app.tagSetzen(naechster) },
        'Ansehen', icon('pfeilRechts', { groesse: 20, strich: 2.5 })),
    ];
  } else {
    weiter = h('p', { class: 'leer-text' }, 'In den nächsten zwei Monaten gibt es keine weiteren offenen Bestellungen ' + ansichtFuer(z.ansicht) + '.');
  }
  return h('div', { class: 'leer' }, h('div', { class: 'leer-titel' }, titel), weiter);
}

function wocheBauen(app, liste) {
  const z = app.zustand;
  const heute = heuteIso();
  const max = plusTage(heute, VORLAUF_TAGE);
  const start = wochenstart(z.tag);
  const tage = [];
  for (let i = 0; i < (mitSonntag(z.konfig) ? 7 : 6); i++) {
    const t = plusTage(start, i);
    if (t >= heute && t <= max) tage.push(t);
  }
  const vorher = start > wochenstart(heute) ? plusTage(start, -7) : null;
  const nachher = plusTage(start, 7) <= max ? plusTage(start, 7) : null;

  const teile = [h('div', { class: 'wochen-kopf' },
    h('button', {
      type: 'button', class: 'icon-knopf', 'aria-label': 'Vorherige Woche', disabled: !vorher,
      onclick: () => vorher && app.tagSetzen(vorher < heute ? heute : vorher),
    }, icon('pfeilLinks', { groesse: 26, strich: 2.5 })),
    h('h2', null, 'KW ' + kalenderwoche(start) + ' · ' + wochenText(start)),
    h('button', {
      type: 'button', class: 'icon-knopf', 'aria-label': 'Nächste Woche', disabled: !nachher,
      onclick: () => nachher && app.tagSetzen(nachher),
    }, icon('pfeilRechts', { groesse: 26, strich: 2.5 })),
    h('button', { type: 'button', class: 'knopf', onclick: () => app.overlayOeffnen('tag') },
      icon('kalender', { groesse: 22 }), 'Tag wählen'))];

  let gezeigt = 0;
  for (const t of tage) {
    const maerkte = maerkteAmTag(z.konfig, z.ansicht, t);
    const amTag = liste.filter((b) => b.datum === t);
    if (!maerkte.length && !amTag.length) continue;
    gezeigt++;
    const rel = relativerTag(t);
    teile.push(h('h2', { class: 'tag-titel' },
      rel && h('span', { class: 'heute-marke' }, rel),
      h('button', { type: 'button', class: 'tag-link', onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(t); } }, datumLang(t))));
    if (amTag.length) teile.push(...marktGruppen(app, amTag, maerkte, { klein: true }));
    else teile.push(h('div', { class: 'leer-zeile' }, 'Keine Bestellungen · ' + maerkte.map((m) => m.name).join(', ')));
  }
  if (!gezeigt) {
    teile.push(h('div', { class: 'leer' }, h('div', { class: 'leer-titel' },
      ansichtName(z.ansicht) + (start === wochenstart(heute) ? ': diese Woche keine Markttage mehr' : ': in dieser Woche keine Markttage'))));
  }
  return teile;
}

function sucheBauen(app, alle, inAnsicht) {
  const z = app.zustand;
  if (!z.suche.trim()) {
    return [h('p', { class: 'hinweis-text' }, 'Name des Kunden oder einen Teil der Bestellung eintippen. Gesucht wird in allen kommenden Tagen ' + ansichtFuer(z.ansicht) + '.')];
  }
  const treffer = suchen(inAnsicht, z.suche);
  if (!treffer.length) {
    const ids = new Set(inAnsicht.map((b) => b.id));
    const anderswo = suchen(alle, z.suche).filter((b) => !ids.has(b.id));
    return [h('div', { class: 'leer' },
      h('div', { class: 'leer-titel' }, 'Keine Treffer ' + ansichtFuer(z.ansicht)),
      anderswo.length > 0 && h('button', {
        type: 'button', class: 'knopf',
        onclick: () => { app.ansichtSetzen({ typ: 'alle' }); app.render(); },
      }, 'In allen Märkten suchen (' + anderswo.length + ' Treffer)'))];
  }
  const teile = [h('p', { class: 'hinweis-text' }, treffer.length + ' Treffer')];
  for (const t of [...new Set(sortieren(treffer, z.konfig).map((b) => b.datum))]) {
    const rel = relativerTag(t);
    teile.push(h('h2', { class: 'tag-titel' }, rel && h('span', { class: 'heute-marke' }, rel), h('span', null, datumLang(t))));
    teile.push(...marktGruppen(app, treffer.filter((b) => b.datum === t), [], { klein: true }));
  }
  return teile;
}
