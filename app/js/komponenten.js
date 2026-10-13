// Bausteine, die auf mehreren Bildschirmen gleich aussehen (Designvorlage F6).

import { h } from './ui.js';
import { icon } from './icons.js';
import { uhrzeit, iso, echtHeuteIso, tagMonat } from './datum.js';
import { marktFinden } from './logik.js';

export function demoStreifen() {
  return h('div', { class: 'demo-streifen' }, 'PROTOTYP · Beispieldaten, nur auf diesem Tablet');
}

/** Sync-Status als reiner Text; Tippen aktualisiert. Inhalt setzt app.statusZeichnen(). */
export function syncAnzeige(app) {
  return h('button', { type: 'button', class: 'sync', title: 'Tippen zum Aktualisieren', onclick: () => app.aktualisieren() });
}

/** Kopfleiste der Unterseiten: Zurück links, Titel, Sync-Status rechts. */
export function unterKopf(app, titel, { zurueckText = 'Zurück' } = {}) {
  return h('header', { class: 'kopf unter' },
    h('button', { type: 'button', class: 'kopf-zurueck', onclick: () => app.zurueck() },
      icon('pfeilLinks', { groesse: 22, strich: 2.5 }), zurueckText),
    h('h1', { class: 'kopf-titel' }, titel),
    syncAnzeige(app));
}

/** Fahrzeug eines Markts – nur wenn es nicht das eigene des Tablets ist (Firmen-Tablet: immer). */
export function fremdesFahrzeug(app, marktName) {
  const z = app.zustand;
  const m = marktFinden(z.konfig, marktName);
  if (!m) return null;
  const eigenes = z.standard && z.standard.typ === 'fahrzeug' ? z.standard.wert : null;
  return m.fahrzeug !== eigenes ? m.fahrzeug : null;
}

/** Markt-Überschrift: Ort-Symbol, Name in Großbuchstaben, rechts der Zähler. */
export function marktKopf(app, name, liste, { klein = false, zaehler = true } = {}) {
  const offen = liste.filter((b) => b.status === 'offen').length;
  const abgeholt = liste.filter((b) => b.status === 'abgeholt').length;
  const storniert = liste.filter((b) => b.status === 'storniert').length;
  const fz = fremdesFahrzeug(app, name);
  return h('div', { class: 'markt' + (klein ? ' klein' : '') },
    h('div', { class: 'markt-name' },
      icon('ort', { groesse: klein ? 20 : 22, strich: 2.2 }),
      h('h2', null, name),
      fz && h('span', { class: 'markt-fz' }, fz)),
    zaehler && h('span', { class: 'zaehler' },
      h('b', null, offen ? offen + ' zurücklegen' : 'nichts zurückzulegen'),
      abgeholt ? ' · ' + abgeholt + ' abgeholt' : '',
      storniert ? ' · ' + storniert + ' storniert' : ''));
}

function zeitKurz(isoZeit) {
  const d = new Date(isoZeit);
  if (isNaN(d)) return '';
  return (iso(d) === echtHeuteIso() ? '' : tagMonat(iso(d)) + ', ') + uhrzeit(d) + ' Uhr';
}

function datumKurzAus(isoZeit) {
  const d = new Date(isoZeit);
  return isNaN(d) ? '' : tagMonat(iso(d));
}

/** „Abgeholt · 10:12 Uhr" bzw. „Storniert · Ben, 12.10." */
export function statusText(b) {
  if (b.status === 'abgeholt') {
    return 'Abgeholt' + (b.abgeholtAm ? ' · ' + zeitKurz(b.abgeholtAm) : '') + (b.wartet ? ' · wird gesendet' : '');
  }
  if (b.status === 'storniert') {
    const wer = [b.storniertVon, b.storniertAm && datumKurzAus(b.storniertAm)].filter(Boolean).join(', ');
    return 'Storniert' + (wer ? ' · ' + wer : '') + (b.wartet ? ' · wird gesendet' : '');
  }
  return 'Offen';
}

/** Statuszeile der erledigten Zettel, mit „Rückgängig". */
export function statusZeile(app, b) {
  const abgeholt = b.status === 'abgeholt';
  return h('div', { class: 'status-zeile' },
    h('span', { class: 'status-punkt' },
      abgeholt ? icon('haken', { groesse: 17, strich: 3.2 }) : icon('kreuz', { groesse: 15, strich: 3.4 })),
    h('span', { class: 'status-text' }, statusText(b)),
    h('button', { type: 'button', class: 'rueckgaengig', onclick: () => app.rueckgaengig(b.id) }, 'Rückgängig'));
}

/** „Als abgeholt markieren" – ein Tipp, danach Rückgängig auf dem Zettel. */
export function abgeholtKnopf(app, b, { breit = false } = {}) {
  return h('button', {
    type: 'button',
    class: 'knopf-abgeholt' + (breit ? ' breit' : ''),
    onclick: (e) => { e.stopPropagation(); app.abholen(b.id); },
  }, icon('kreisHaken', { groesse: 24, strich: 2.2 }), 'Als abgeholt markieren');
}

/** Zettel einer Bestellung – drei Typen: offen (weiß, blau), abgeholt (grün), storniert (rot). */
export function zettel(app, b, { mitAktion = true, antippbar = true } = {}) {
  const oben = (klasse, ...kinder) => (antippbar
    ? h('button', {
      type: 'button',
      class: 'zettel-oben ' + klasse,
      'aria-label': 'Bestellung von ' + b.kunde + ' öffnen',
      onclick: () => app.navigieren('detail', { detailId: b.id, detailStorno: null }),
    }, ...kinder)
    : h('div', { class: 'zettel-oben ' + klasse }, ...kinder));

  if (b.status === 'offen') {
    const infos = [b.kontakt && 'Tel. ' + b.kontakt, b.kommentar && '„' + b.kommentar + '“'].filter(Boolean);
    return h('article', { class: 'zettel offen' },
      oben('', h('span', { class: 'ware' }, b.bestellung), h('span', { class: 'kunde' }, b.kunde)),
      mitAktion && h('div', { class: 'fuss' },
        h('div', { class: 'infos' },
          infos.length ? infos.map((t) => h('span', null, t)) : h('span', null, 'Keine weiteren Angaben'),
          b.wartet && h('span', null, '⏳ wird gesendet')),
        abgeholtKnopf(app, b)));
  }
  return h('article', { class: 'zettel ' + b.status },
    oben('kopfteil', h('span', { class: 'ware' }, b.bestellung), h('span', { class: 'kunde' }, b.kunde)),
    statusZeile(app, b));
}

/** Große Namens-Knöpfe für die Mitarbeiter-Auswahl. */
export function namensGitter(namen, gewaehlt, beiWahl) {
  return h('div', { class: 'auswahl-gitter namen' },
    namen.map((n) => h('button', {
      type: 'button',
      class: 'auswahl' + (n === gewaehlt ? ' gewaehlt' : ''),
      'aria-pressed': n === gewaehlt ? 'true' : 'false',
      onclick: () => beiWahl(n),
    }, n === gewaehlt ? '✓ ' + n : n)));
}

/** Auswahl-Knopf mit Titel und kleiner Zusatzzeile. */
export function auswahlKnopf(titel, zusatz, gewaehlt, beiWahl, symbol = null) {
  return h('button', {
    type: 'button',
    class: 'auswahl' + (gewaehlt ? ' gewaehlt' : ''),
    'aria-pressed': gewaehlt ? 'true' : 'false',
    onclick: beiWahl,
  },
    h('span', { class: 'auswahl-titel' }, symbol && icon(symbol, { groesse: 24 }), (gewaehlt ? '✓ ' : '') + titel),
    zusatz && h('small', null, zusatz));
}
