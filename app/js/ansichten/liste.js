// Startseite: Kopfleiste mit Fahrzeug-Auswahl, feste Wochenleiste Di–Sa (Wischen = Woche wechseln)
// + Wochen-Kachel, ggf. gelbes Hinweisband (fremde Ansicht / andere Woche), darunter die Zettel
// nach Markt gruppiert. Gestaltung: Designvorlage F6 v3 „Schlicht" + v3.1 „Feste Wochenleiste".

import { h } from '../ui.js';
import { icon } from '../icons.js';
import { demoStreifen, syncAnzeige, marktKopf, zettel, zettelSchlicht } from '../komponenten.js';
import {
  heuteIso, plusTage, datumLang, datumKurz, tagMonat, relativerTag, wochenstart, kalenderwoche, wochenText,
  wochentag, ausIso, TAGE_KURZ, TAGE_LANG, VORLAUF_TAGE,
} from '../datum.js';
import {
  ansichtName, ansichtFuer, fuerAnsicht, sortieren, istErledigt, suchen, maerkteAmTag, mitSonntag,
} from '../logik.js';

export function listeZeichnen(app) {
  const z = app.zustand;
  tagAnpassen(app);
  return h('div', { class: 'bs bs-liste' },
    app.istDemo && demoStreifen(),
    h('header', { class: 'kopf' },
      kopfZeile(app),
      z.sucheOffen ? suchLeiste(app) : wochenleiste(app),
      (app.istVoruebergehend() || andereWoche(app)) && hinweisband(app)),
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

// ---------- Wochen-Logik ----------

/** Montag der Woche, die die Leiste für diesen Tag zeigt – sonntags schon die nächste Woche. */
function anzeigeWoche(t) {
  return wochentag(t) === 0 ? plusTage(t, 1) : wochenstart(t);
}

/** Die fünf festen Tage Di–Sa einer Woche (Montag übergeben). */
function festeTage(montag) {
  return [1, 2, 3, 4, 5].map((i) => plusTage(montag, i));
}

/** Erste und letzte Woche, durch die man wischen kann (aktuelle Woche … Woche, in der der Vorlauf endet). */
function wochenGrenzen() {
  const heute = heuteIso();
  return { erste: anzeigeWoche(heute), letzte: wochenstart(plusTage(heute, VORLAUF_TAGE)) };
}

function andereWoche(app) {
  return anzeigeWoche(app.zustand.tag) !== wochenGrenzen().erste;
}

function tageMitBestellung(app) {
  const z = app.zustand;
  return new Set(fuerAnsicht(app.bestellungen(), z.konfig, z.ansicht).map((b) => b.datum));
}

/** Antippbar: nicht vorbei und in der Ansicht ein Markt (oder schon Bestellungen) an dem Tag. */
function waehlbar(app, t, mitBestellung) {
  return t >= heuteIso() && (mitBestellung.has(t) || maerkteAmTag(app.zustand.konfig, app.zustand.ansicht, t).length > 0);
}

/**
 * Gewählter Tag hat in der Ansicht nichts (Montag, Sonntag, Tag ohne Markt, Ansicht gewechselt) →
 * der erste kommende Tag der angezeigten Woche mit Markt. Hat die Woche keinen: so lassen (Leer-Hinweis).
 */
function tagAnpassen(app) {
  const z = app.zustand;
  if (!z.konfig || z.zeitraum !== 'tag') return;
  const mitBestellung = tageMitBestellung(app);
  if (waehlbar(app, z.tag, mitBestellung)) return;
  const ziel = festeTage(anzeigeWoche(z.tag)).find((t) => waehlbar(app, t, mitBestellung));
  if (ziel) z.tag = ziel;
}

/** Woche wechseln: derselbe Wochentag, wenn dort ein Markt ist, sonst der erste Tag mit Markt. */
function wocheWechseln(app, richtung) {
  const z = app.zustand;
  const g = wochenGrenzen();
  const neu = plusTage(anzeigeWoche(z.tag), 7 * richtung);
  if (neu < g.erste || neu > g.letzte) return false;
  const mitBestellung = tageMitBestellung(app);
  const tage = festeTage(neu);
  const gleicherTag = plusTage(neu, (wochentag(z.tag) + 6) % 7);
  let ziel = waehlbar(app, gleicherTag, mitBestellung) ? gleicherTag : tage.find((t) => waehlbar(app, t, mitBestellung));
  if (!ziel) ziel = tage.find((t) => t >= heuteIso()) || neu;
  app.tagSetzen(ziel);
  const klasse = richtung > 0 ? 'von-rechts' : 'von-links';
  document.querySelectorAll('.wochenleiste .tage-fest, #listen-inhalt').forEach((el) => el.classList.add(klasse));
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

/**
 * Gelbes Hinweisband im klebenden Kopf – wenn die Ansicht von der Standard-Ansicht abweicht und/oder
 * eine andere als die aktuelle Woche angezeigt wird. Der Knopf setzt beides zurück (Ansicht, Woche, Tag).
 */
function hinweisband(app) {
  const z = app.zustand;
  const heute = heuteIso();
  const fremd = app.istVoruebergehend();
  const woche = anzeigeWoche(z.tag);
  const erste = wochenGrenzen().erste;
  const wocheText = woche === erste ? '' : woche === plusTage(erste, 7) ? 'nächste Woche' : 'KW ' + kalenderwoche(woche);
  let wann = '';
  if (z.zeitraum === 'woche') wann = wocheText ? '' : 'KW ' + kalenderwoche(woche);
  else if (wocheText) wann = TAGE_LANG[wochentag(z.tag)] + ', ' + tagMonat(z.tag);
  else if (z.tag !== heute) wann = TAGE_LANG[wochentag(z.tag)];
  const standard = z.standard.typ === 'alle' ? 'Alle' : z.standard.wert;
  const teile = [];
  if (fremd) teile.push(h('b', null, z.ansicht.typ === 'alle' ? 'alle Fahrzeuge' : z.ansicht.wert));
  if (wocheText) teile.push(h('b', null, wocheText));
  if (wann) teile.push(wann);
  return h('div', { class: 'hinweisband' },
    h('span', { class: 'hinweis-text-band' }, 'Du siehst gerade ', teile.flatMap((t, i) => (i ? [' · ', t] : [t]))),
    h('div', { class: 'platzhalter' }),
    h('button', {
      type: 'button',
      onclick: () => {
        if (fremd) app.ansichtSetzen(z.standard);
        z.zeitraum = 'tag';
        z.tag = heuteIso();   // tagAnpassen() nimmt sonst den nächsten Markttag
        z.nachOben = true;
        app.render();
      },
    }, fremd ? 'Zurück zu ' + standard + ' · Heute' : 'Zurück zu Heute'));
}

// ---------- Feste Wochenleiste Di–Sa + Wochen-Kachel ----------

function offenProTag(app) {
  const z = app.zustand;
  const m = new Map();
  for (const b of fuerAnsicht(app.bestellungen(), z.konfig, z.ansicht)) {
    if (b.status === 'offen') m.set(b.datum, (m.get(b.datum) || 0) + 1);
  }
  return m;
}

function wochenleiste(app) {
  const z = app.zustand;
  const woche = anzeigeWoche(z.tag);
  const g = wochenGrenzen();
  const offen = offenProTag(app);
  const mitBestellung = tageMitBestellung(app);
  const zurueck = woche > g.erste;
  const vor = woche < g.letzte;
  const pfeil = (name, geht) => h('span', { class: 'wisch-pfeil' + (geht ? '' : ' aus'), 'aria-hidden': 'true' },
    icon(name, { groesse: 20, strich: 2.6 }));
  const leiste = h('nav', { class: 'wochenleiste', 'aria-label': 'Woche – zum Wechseln wischen' },
    pfeil('pfeilLinks', zurueck),
    h('div', { class: 'tage-fest' },
      festeTage(woche).map((t) => tagKachel(app, t, offen.get(t) || 0, mitBestellung))),
    pfeil('pfeilRechts', vor),
    wochenKachel(app, woche));
  wischenEinrichten(leiste, app, { zurueck, vor });
  return leiste;
}

function tagKachel(app, t, anzahl, mitBestellung) {
  const z = app.zustand;
  const heute = heuteIso();
  const wt = TAGE_KURZ[wochentag(t)].toUpperCase();
  const zustandText = t < heute ? 'vorbei' : !waehlbar(app, t, mitBestellung) ? 'kein Markt' : null;
  if (zustandText) {
    return h('button', {
      type: 'button', class: 'tag ' + (t < heute ? 'vorbei' : 'kein-markt'), disabled: true, 'aria-disabled': 'true',
      'aria-label': datumLang(t) + ', ' + zustandText,
    },
      h('span', { class: 'nr' }, String(ausIso(t).getDate())),
      h('span', { class: 'text' }, h('span', { class: 'wt' }, wt), h('span', { class: 'anz' }, zustandText)));
  }
  const aktiv = z.zeitraum === 'tag' && z.tag === t;
  const istHeute = t === heute;
  const offenText = aktiv || istHeute;
  return h('button', {
    type: 'button',
    class: 'tag' + (aktiv ? ' aktiv' : '') + (istHeute ? ' ist-heute' : ''),
    'aria-pressed': aktiv ? 'true' : 'false',
    'aria-label': (istHeute ? 'Heute, ' : '') + datumLang(t) + ', ' + anzahl + ' offen',
    onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(t); },
  },
    h('span', { class: 'nr' }, String(ausIso(t).getDate())),
    h('span', { class: 'text' },
      h('span', { class: 'wt' }, wt),
      h('span', { class: 'anz nur-hoch' }, offenText ? anzahl + ' offen' : anzahl ? String(anzahl) : '–'),
      h('span', { class: 'anz nur-quer' }, offenText ? anzahl + ' offen' : anzahl ? anzahl + ' Best.' : 'keine')));
}

function wochenKachel(app, woche) {
  const z = app.zustand;
  const aktiv = z.zeitraum === 'woche';
  const kw = String(kalenderwoche(woche));
  return h('button', {
    type: 'button',
    class: 'tag woche-kachel' + (aktiv ? ' aktiv' : ''),
    'aria-pressed': aktiv ? 'true' : 'false',
    'aria-label': 'Ganze Woche anzeigen, KW ' + kw,
    onclick: () => app.zeitraumSetzen('woche'),
  },
    h('span', { class: 'nr' }, h('span', { class: 'nur-hoch' }, 'KW ' + kw), h('span', { class: 'nur-quer' }, kw)),
    h('span', { class: 'text' },
      h('span', { class: 'wt' }, 'WOCHE'),
      h('span', { class: 'anz nur-hoch' }, 'alle'),
      h('span', { class: 'anz nur-quer' }, 'KW · alle')));
}

/**
 * Wischen nur auf der Wochenleiste (die Liste scrollt ungestört): nach links = nächste Woche,
 * nach rechts = vorige. Die Kacheln folgen dem Finger; an der Grenze federn sie nur zurück.
 */
function wischenEinrichten(leiste, app, geht) {
  let s = null;
  let gewischt = false;
  const band = () => leiste.querySelector('.tage-fest');
  const zurueckfedern = () => {
    const b = band();
    b.style.transition = 'transform .2s ease-out';
    b.style.transform = '';
  };
  leiste.addEventListener('touchstart', (e) => {
    gewischt = false;
    if (e.touches.length !== 1) { s = null; return; }
    const t = e.touches[0];
    s = { x: t.clientX, y: t.clientY, dx: 0, waagerecht: null };
    band().style.transition = 'none';
  }, { passive: true });
  leiste.addEventListener('touchmove', (e) => {
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.waagerecht === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.waagerecht = Math.abs(dx) > Math.abs(dy);
    if (!s.waagerecht) return;
    gewischt = true;
    s.dx = (dx < 0 ? geht.vor : geht.zurueck) ? dx : dx * 0.25;
    band().style.transform = 'translateX(' + s.dx + 'px)';
  }, { passive: true });
  leiste.addEventListener('touchend', () => {
    if (!s) return;
    const { dx, waagerecht } = s;
    s = null;
    if (waagerecht && Math.abs(dx) > 50 && wocheWechseln(app, dx < 0 ? 1 : -1)) return;
    zurueckfedern();
  }, { passive: true });
  leiste.addEventListener('touchcancel', () => { s = null; zurueckfedern(); }, { passive: true });
  // Nach einer Wischbewegung keinen Tag „antippen".
  leiste.addEventListener('click', (e) => {
    if (gewischt) { e.stopPropagation(); e.preventDefault(); gewischt = false; }
  }, true);
}

// ---------- Suche (ersetzt die Wochenleiste) ----------

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

// ---------- Erledigtes einklappen (Einstellung, pro Tablet) ----------

// Aufgeklappte Märkte (Tag|Markt) – gelten bis zum Neuladen oder Tageswechsel.
const aufgeklappt = { heute: '', schluessel: new Set() };

function istAufgeklappt(k) {
  if (aufgeklappt.heute !== heuteIso()) {
    aufgeklappt.heute = heuteIso();
    aufgeklappt.schluessel.clear();
  }
  return aufgeklappt.schluessel.has(k);
}

function erledigtZeile(app, erledigt, auf, k) {
  const abgeholt = erledigt.filter((b) => b.status === 'abgeholt').length;
  const storniert = erledigt.length - abgeholt;
  return h('button', {
    type: 'button', class: 'eingeklappt', 'aria-expanded': auf ? 'true' : 'false',
    onclick: () => {
      if (auf) aufgeklappt.schluessel.delete(k); else aufgeklappt.schluessel.add(k);
      listenInhaltErneuern(app);
    },
  },
    abgeholt > 0 && [h('span', { class: 'punkt gruen' }), abgeholt + ' abgeholt'],
    storniert > 0 && [h('span', { class: 'punkt rot' }), storniert + ' storniert'],
    h('span', { class: 'platzhalter' }),
    h('span', { class: 'mehr' }, auf ? 'ausblenden' : 'anzeigen'),
    icon(auf ? 'pfeilHoch' : 'pfeilRunter', { groesse: 20, strich: 2.5 }));
}

/** Zettel eines Markts: offene (schlicht), dann Erledigtes – eingeklappt als eine Zeile oder als Zettel. */
function raster(app, liste, klappSchluessel) {
  const offen = liste.filter((b) => b.status === 'offen');
  const erledigt = liste.filter((b) => b.status !== 'offen');
  const teile = offen.map((b) => zettelSchlicht(app, b));
  if (erledigt.length && klappSchluessel) {
    const auf = istAufgeklappt(klappSchluessel);
    teile.push(erledigtZeile(app, erledigt, auf, klappSchluessel));
    if (auf) teile.push(...erledigt.map((b) => zettel(app, b)));
  } else {
    teile.push(...erledigt.map((b) => zettel(app, b)));
  }
  return h('div', { class: 'raster' }, teile);
}

/** Bestellungen eines Tages, nach Markt gruppiert (Reihenfolge wie in der Tabelle). */
function marktGruppen(app, amTag, maerkte, { klein = false, einklappen = app.erledigteEinklappen() } = {}) {
  const namen = maerkte.map((m) => m.name);
  for (const b of sortieren(amTag, app.zustand.konfig)) if (!namen.includes(b.markt)) namen.push(b.markt);
  return namen.flatMap((name) => {
    const vomMarkt = zettelSortieren(amTag.filter((b) => b.markt === name));
    return [
      marktKopf(app, name, { klein }),
      // Markt ohne Bestellungen: nur der Kopf – darunter steht dann einfach nichts.
      vomMarkt.length > 0 && raster(app, vomMarkt, einklappen ? vomMarkt[0].datum + '|' + name : null),
    ].filter(Boolean);
  });
}

function tagBauen(app, liste) {
  const z = app.zustand;
  const tag = z.tag;
  const amTag = liste.filter((b) => b.datum === tag);
  const maerkte = maerkteAmTag(z.konfig, z.ansicht, tag);
  if (!amTag.length) {
    return [...maerkte.map((m) => marktKopf(app, m.name)), leerTag(app, liste, tag, maerkte, wocheOhneMarkt(app, tag))];
  }
  return marktGruppen(app, amTag, maerkte);
}

/** Die angezeigte Woche hat in der Ansicht gar keinen Markttag mehr → Titel für den Leer-Hinweis, sonst null. */
function wocheOhneMarkt(app, tag) {
  const mitBestellung = tageMitBestellung(app);
  const woche = anzeigeWoche(tag);
  if (festeTage(woche).some((t) => waehlbar(app, t, mitBestellung))) return null;
  return ansichtName(app.zustand.ansicht) + (woche === wochenGrenzen().erste
    ? ': diese Woche keine Markttage mehr'
    : ': in KW ' + kalenderwoche(woche) + ' keine Markttage');
}

function leerTag(app, liste, tag, maerkte, wochenTitel) {
  const z = app.zustand;
  const rel = relativerTag(tag);
  const wann = rel ? rel.toLowerCase() : 'am ' + datumKurz(tag);
  let titel;
  if (wochenTitel) titel = wochenTitel;
  else if (maerkte.length) titel = (rel || 'Am ' + datumKurz(tag)) + ' keine Bestellungen ' + ansichtFuer(z.ansicht);
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
  const start = anzeigeWoche(z.tag);
  const tage = [];
  for (let i = 0; i < (mitSonntag(z.konfig) ? 7 : 6); i++) {
    const t = plusTage(start, i);
    if (t >= heute && t <= max) tage.push(t);
  }
  const g = wochenGrenzen();

  const teile = [h('div', { class: 'wochen-kopf' },
    h('button', {
      type: 'button', class: 'icon-knopf', 'aria-label': 'Vorherige Woche', disabled: start <= g.erste,
      onclick: () => wocheWechseln(app, -1),
    }, icon('pfeilLinks', { groesse: 26, strich: 2.5 })),
    h('h2', null, 'KW ' + kalenderwoche(start) + ' · ' + wochenText(start)),
    h('button', {
      type: 'button', class: 'icon-knopf', 'aria-label': 'Nächste Woche', disabled: start >= g.letzte,
      onclick: () => wocheWechseln(app, 1),
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
      ansichtName(z.ansicht) + (start === g.erste ? ': diese Woche keine Markttage mehr' : ': in dieser Woche keine Markttage'))));
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
    teile.push(...marktGruppen(app, treffer.filter((b) => b.datum === t), [], { klein: true, einklappen: false }));
  }
  return teile;
}
