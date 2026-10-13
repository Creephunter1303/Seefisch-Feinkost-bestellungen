// Startbildschirm: Bestellungen für Heute (Standard), einen anderen Tag oder die Woche.

import { h } from '../ui.js';
import { demoStreifen, marktEtikett, statusAnzeige, abholenKnopf } from '../komponenten.js';
import {
  heuteIso, plusTage, datumLang, datumKurz, relativerTag, wochenstart, kalenderwoche, wochenText, VORLAUF_TAGE,
} from '../datum.js';
import {
  ansichtName, ansichtFuer, ansichtSymbol, fuerAnsicht, sortieren, istErledigt, suchen, maerkteAmTag,
  marktFinden, naechsterMarkttag, vorherigerMarkttag, mitSonntag,
} from '../logik.js';

export function listeZeichnen(app) {
  const z = app.zustand;
  return h('div', { class: 'bs bs-liste' },
    app.istDemo && demoStreifen(),
    kopf(app),
    app.istVoruebergehend() && tempLeiste(app),
    h('main', { class: 'inhalt', id: 'listen-inhalt' }, inhaltBauen(app)),
    fuss(app));
}

/** Nur den Listenbereich neu aufbauen (z. B. beim Tippen in der Suche – Tastatur bleibt offen). */
export function listenInhaltErneuern(app) {
  const ziel = document.getElementById('listen-inhalt');
  if (!ziel) return false;
  ziel.replaceChildren(...inhaltBauen(app));
  return true;
}

// ---------- Kopf ----------

function kopf(app) {
  const z = app.zustand;
  return h('header', { class: 'kopf' },
    h('button', {
      type: 'button',
      class: 'ansicht-knopf',
      'aria-label': 'Ansicht wählen: ' + ansichtName(z.ansicht),
      onclick: () => app.overlayOeffnen('ansicht'),
    },
      h('span', { 'aria-hidden': 'true' }, ansichtSymbol(z.ansicht)),
      h('span', { class: 'ansicht-name' }, ansichtName(z.ansicht)),
      h('span', { class: 'pfeil', 'aria-hidden': 'true' }, '▾')),
    h('div', { class: 'kopf-rechts' },
      h('button', { type: 'button', class: 'status-pill', onclick: () => app.aktualisieren() }),
      h('button', {
        type: 'button', class: 'kopf-knopf', title: 'Einstellungen', 'aria-label': 'Einstellungen',
        onclick: () => app.navigieren('einstellungen'),
      }, '⚙', h('span', { class: 'kopf-knopf-text' }, 'Einstellungen'))));
}

function tempLeiste(app) {
  const z = app.zustand;
  return h('div', { class: 'temp-leiste' },
    h('span', { class: 'temp-text' }, '⇄ Vorübergehend: ', h('strong', null, ansichtName(z.ansicht))),
    h('button', {
      type: 'button', class: 'knopf primaer',
      onclick: () => { app.ansichtSetzen(z.standard); app.render(); },
    }, '↩ Zurück zu ' + ansichtName(z.standard)));
}

// ---------- Fuß: Zeitraum und „Neue Bestellung" (Daumenzone, immer an derselben Stelle) ----------

function fuss(app) {
  const z = app.zustand;
  const heute = heuteIso();
  const tagModus = z.zeitraum === 'tag';
  const istHeute = tagModus && z.tag === heute;
  const { zurueck, vor } = blaetterZiele(app);
  return h('nav', { class: 'fuss' },
    h('button', {
      type: 'button', class: 'knopf nav-pfeil', disabled: !zurueck,
      'aria-label': tagModus ? 'Vorheriger Markttag' : 'Vorherige Woche',
      onclick: () => zurueck && app.tagSetzen(zurueck),
    }, '‹'),
    h('button', {
      type: 'button', class: 'knopf nav-zeit' + (istHeute ? ' aktiv' : tagModus || z.zeitraum === 'woche' ? ' zurueck-hinweis' : ''),
      'aria-pressed': istHeute ? 'true' : 'false',
      onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(heute); },
    }, 'Heute'),
    h('button', {
      type: 'button', class: 'knopf nav-zeit' + (z.zeitraum === 'woche' ? ' aktiv' : ''),
      'aria-pressed': z.zeitraum === 'woche' ? 'true' : 'false',
      onclick: () => app.zeitraumSetzen('woche'),
    }, 'Woche'),
    h('button', {
      type: 'button', class: 'knopf nav-pfeil', disabled: !vor,
      'aria-label': tagModus ? 'Nächster Markttag' : 'Nächste Woche',
      onclick: () => vor && app.tagSetzen(vor),
    }, '›'),
    h('button', { type: 'button', class: 'knopf primaer neu-knopf', onclick: () => app.neueBestellung() },
      h('span', { class: 'plus', 'aria-hidden': 'true' }, '＋'), ' Neue Bestellung'));
}

/** Wohin ‹ und › blättern: im Tagesmodus von Markttag zu Markttag, sonst wochenweise. */
function blaetterZiele(app) {
  const z = app.zustand;
  const heute = heuteIso();
  const max = plusTage(heute, VORLAUF_TAGE);
  if (z.zeitraum === 'woche') {
    const start = wochenstart(z.tag);
    const zurueck = start > wochenstart(heute) ? plusTage(start, -7) : null;
    const vorStart = plusTage(start, 7);
    return { zurueck: zurueck && (zurueck < heute ? heute : zurueck), vor: vorStart <= max ? vorStart : null };
  }
  const vor = naechsterMarkttag(z.konfig, z.ansicht, plusTage(z.tag, 1), max);
  let zurueck = null;
  if (z.tag > heute) zurueck = vorherigerMarkttag(z.konfig, z.ansicht, z.tag, heute) || heute;
  return { zurueck, vor };
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

function titelZeile(app, text, zahlen) {
  return h('div', { class: 'titel-zeile' },
    h('button', { type: 'button', class: 'titel-knopf', onclick: () => app.overlayOeffnen('tag') },
      h('span', { class: 'titel-text' }, text, h('span', { class: 'pfeil', 'aria-hidden': 'true' }, ' ▾')),
      h('span', { class: 'titel-zahlen' }, zahlen)),
    h('button', { type: 'button', class: 'knopf such-knopf', onclick: () => app.sucheOeffnen() }, '🔍 Suchen'));
}

function zahlenText(offen, erledigt) {
  return offen + ' offen' + (erledigt ? ' · ' + erledigt + ' erledigt' : '');
}

function tagBauen(app, liste) {
  const z = app.zustand;
  const tag = z.tag;
  const rel = relativerTag(tag);
  const amTag = sortieren(liste.filter((b) => b.datum === tag), z.konfig);
  const offen = amTag.filter((b) => !istErledigt(b));
  const erledigt = amTag.filter(istErledigt);
  const maerkte = maerkteAmTag(z.konfig, z.ansicht, tag);

  const teile = [titelZeile(app, rel ? rel + ' · ' + datumLang(tag) : datumLang(tag), zahlenText(offen.length, erledigt.length))];
  if (maerkte.length && z.ansicht.typ !== 'markt') {
    teile.push(h('div', { class: 'tag-maerkte' }, (maerkte.length > 1 ? 'Märkte: ' : 'Markt: ') + maerkte.map((m) => m.name).join(' · ')));
  }
  if (!amTag.length) {
    teile.push(leerTag(app, liste, tag, maerkte));
    return teile;
  }
  if (!offen.length) {
    teile.push(h('div', { class: 'alles-erledigt' }, '✓ Alle Bestellungen ' + (rel === 'Heute' ? 'für heute' : 'für diesen Tag') + ' sind erledigt.'));
  } else {
    teile.push(...nachMarktGruppiert(app, offen));
  }
  if (erledigt.length) teile.push(erledigtBereich(app, erledigt));
  return teile;
}

function nachMarktGruppiert(app, offen) {
  const maerkte = [...new Set(offen.map((b) => b.markt))];
  if (maerkte.length < 2) return [kachelGitter(app, offen)];
  return maerkte.flatMap((m) => {
    const vomMarkt = offen.filter((b) => b.markt === m);
    return [h('h3', { class: 'markt-kopf' }, m + ' · ' + vomMarkt.length + ' offen'), kachelGitter(app, vomMarkt)];
  });
}

function leerTag(app, liste, tag, maerkte) {
  const z = app.zustand;
  const rel = relativerTag(tag);
  const wann = rel ? rel.toLowerCase() : 'am ' + datumKurz(tag);
  let titel;
  if (maerkte.length) {
    titel = (rel || 'Am ' + datumKurz(tag)) + ' keine Bestellungen ' + ansichtFuer(z.ansicht);
  } else if (z.ansicht.typ === 'alle') {
    titel = (rel || 'Am ' + datumKurz(tag)) + ' ist kein Markttag';
  } else if (z.ansicht.typ === 'markt') {
    titel = z.ansicht.wert + ' findet ' + wann + ' nicht statt';
  } else {
    titel = z.ansicht.wert + ' hat ' + wann + ' keinen Markt';
  }

  const kommende = sortieren(liste.filter((b) => b.datum > tag && !istErledigt(b)), z.konfig);
  let weiter;
  if (kommende.length) {
    const naechster = kommende[0].datum;
    const anzahl = kommende.filter((b) => b.datum === naechster).length;
    weiter = [
      h('p', { class: 'leer-text' }, 'Nächste Bestellungen: ', h('strong', null, datumLang(naechster)), ' (' + anzahl + ')'),
      h('button', { type: 'button', class: 'knopf primaer', onclick: () => app.tagSetzen(naechster) }, 'Ansehen ›'),
    ];
  } else {
    weiter = h('p', { class: 'leer-text' }, 'In den nächsten zwei Monaten gibt es keine weiteren offenen Bestellungen ' + ansichtFuer(z.ansicht) + '.');
  }
  return h('div', { class: 'leer' }, h('div', { class: 'leer-titel' }, titel), weiter);
}

function erledigtBereich(app, erledigt) {
  const z = app.zustand;
  const abgeholt = erledigt.filter((b) => b.status === 'abgeholt').length;
  const storniert = erledigt.length - abgeholt;
  const teile = [];
  if (abgeholt) teile.push(abgeholt + ' abgeholt');
  if (storniert) teile.push(storniert + ' storniert');
  return h('section', { class: 'erledigt' },
    h('button', {
      type: 'button',
      class: 'erledigt-schalter',
      'aria-expanded': z.erledigtZeigen ? 'true' : 'false',
      onclick: () => { z.erledigtZeigen = !z.erledigtZeigen; listenInhaltErneuern(app); },
    }, z.erledigtZeigen ? '▴ Erledigte ausblenden' : '▾ Erledigt: ' + teile.join(' · ') + ' – anzeigen'),
    z.erledigtZeigen && kachelGitter(app, erledigt));
}

function wocheBauen(app, liste) {
  const z = app.zustand;
  const heute = heuteIso();
  const max = plusTage(heute, VORLAUF_TAGE);
  const start = wochenstart(z.tag);
  const anzahlTage = mitSonntag(z.konfig) ? 7 : 6;
  const tage = [];
  for (let i = 0; i < anzahlTage; i++) {
    const t = plusTage(start, i);
    if (t >= heute && t <= max) tage.push(t);
  }
  const inWoche = liste.filter((b) => tage.includes(b.datum));
  const offenGesamt = inWoche.filter((b) => !istErledigt(b)).length;
  const teile = [titelZeile(app, 'Woche ' + kalenderwoche(start) + ' · ' + wochenText(start),
    zahlenText(offenGesamt, inWoche.length - offenGesamt))];

  let gezeigt = 0;
  for (const t of tage) {
    const maerkte = maerkteAmTag(z.konfig, z.ansicht, t);
    const amTag = sortieren(liste.filter((b) => b.datum === t), z.konfig);
    if (!maerkte.length && !amTag.length) continue;
    gezeigt++;
    const offen = amTag.filter((b) => !istErledigt(b));
    const erledigt = amTag.filter(istErledigt);
    teile.push(h('section', { class: 'tag-block' },
      h('h2', { class: 'tag-kopf' },
        t === heute && h('span', { class: 'heute-marke' }, 'Heute'),
        h('button', { type: 'button', class: 'tag-link', onclick: () => { app.zeitraumSetzen('tag'); app.tagSetzen(t); } }, datumLang(t)),
        h('span', { class: 'tag-zahl' }, offen.length ? offen.length + ' offen' : '')),
      maerkte.length > 0 && z.ansicht.typ !== 'markt' && h('div', { class: 'tag-maerkte' }, maerkte.map((m) => m.name).join(' · ')),
      offen.length ? kachelGitter(app, offen)
        : h('div', { class: 'tag-leer' }, amTag.length ? '✓ Alles erledigt' : 'Keine Bestellungen'),
      erledigt.length > 0 && erledigtBereich(app, erledigt)));
  }
  if (!gezeigt) {
    const dieseWoche = start === wochenstart(heute);
    teile.push(h('div', { class: 'leer' },
      h('div', { class: 'leer-titel' }, ansichtName(z.ansicht) + (dieseWoche ? ': diese Woche keine Markttage mehr' : ': in dieser Woche keine Markttage'))));
  }
  return teile;
}

function sucheBauen(app, alle, inAnsicht) {
  const z = app.zustand;
  const feld = h('input', {
    id: 'suchfeld', class: 'eingabe', type: 'search', value: z.suche, autocomplete: 'off',
    placeholder: 'Kunde oder Ware suchen …', enterkeyhint: 'search', 'aria-label': 'Suche',
  });
  feld.addEventListener('input', () => {
    z.suche = feld.value;
    const ziel = document.getElementById('such-ergebnisse');
    if (ziel) ziel.replaceChildren(...suchErgebnisse(app, alle, inAnsicht));
  });
  return [
    h('div', { class: 'such-leiste' },
      feld,
      h('button', { type: 'button', class: 'knopf', onclick: () => app.sucheSchliessen() }, '✕ Schließen')),
    h('div', { id: 'such-ergebnisse' }, suchErgebnisse(app, alle, inAnsicht)),
  ];
}

function suchErgebnisse(app, alle, inAnsicht) {
  const z = app.zustand;
  if (!z.suche.trim()) {
    return [h('p', { class: 'hinweis-text' }, 'Name des Kunden oder einen Teil der Bestellung eintippen. Gesucht wird in allen kommenden Tagen ' + ansichtFuer(z.ansicht) + '.')];
  }
  const treffer = sortieren(suchen(inAnsicht, z.suche), z.konfig);
  if (!treffer.length) {
    const ids = new Set(inAnsicht.map((b) => b.id));
    const anderswo = suchen(alle, z.suche).filter((b) => !ids.has(b.id));
    return [h('div', { class: 'leer' },
      h('div', { class: 'leer-titel' }, 'Keine Treffer ' + ansichtFuer(z.ansicht)),
      anderswo.length > 0 && h('button', {
        type: 'button', class: 'knopf primaer',
        onclick: () => { app.ansichtSetzen({ typ: 'alle' }); app.render(); },
      }, 'In allen Märkten suchen (' + anderswo.length + ' Treffer)'))];
  }
  const teile = [h('div', { class: 'titel-zahlen such-zahl' }, treffer.length + (treffer.length === 1 ? ' Treffer' : ' Treffer'))];
  for (const t of [...new Set(treffer.map((b) => b.datum))]) {
    const rel = relativerTag(t);
    teile.push(h('h2', { class: 'tag-kopf' },
      rel && h('span', { class: 'heute-marke' }, rel),
      h('span', null, datumLang(t))));
    const amTag = treffer.filter((b) => b.datum === t);
    teile.push(kachelGitter(app, [...amTag.filter((b) => !istErledigt(b)), ...amTag.filter(istErledigt)]));
  }
  return teile;
}

// ---------- Kachel ----------

function kachelGitter(app, liste) {
  return h('div', { class: 'kacheln' }, liste.map((b) => kachel(app, b)));
}

function kachel(app, b) {
  const z = app.zustand;
  const m = marktFinden(z.konfig, b.markt);
  // Fahrzeug nur zeigen, wenn es nicht das eigene ist (oder das Firmen-Tablet alles sieht).
  const fremd = m && (!z.standard || z.standard.typ !== 'fahrzeug' || m.fahrzeug !== z.standard.wert);
  return h('article', { class: 'kachel ' + b.status },
    h('button', {
      type: 'button',
      class: 'kachel-inhalt',
      onclick: () => app.navigieren('detail', { detailId: b.id, detailStorno: null }),
    },
      h('span', { class: 'kachel-markt' }, marktEtikett(b.markt, fremd ? m.fahrzeug : null)),
      h('span', { class: 'kachel-ware' }, b.bestellung),
      h('span', { class: 'kachel-kunde' }, b.kunde),
      (b.kontakt || b.kommentar) && h('span', { class: 'kachel-details' },
        b.kontakt && h('span', null, '☎ ' + b.kontakt),
        b.kommentar && h('span', null, '💬 ' + b.kommentar))),
    h('div', { class: 'kachel-aktion' },
      statusAnzeige(b),
      b.status === 'offen' && abholenKnopf(app, b)));
}
