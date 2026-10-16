// Bausteine, die auf mehreren Bildschirmen gleich aussehen (Designvorlage F6).

import { h } from './ui.js';
import { icon } from './icons.js';
import { uhrzeit, iso, echtHeuteIso, tagMonat } from './datum.js';
import { marktFinden } from './logik.js';

export function demoStreifen() {
  return h('div', { class: 'demo-streifen' }, 'PROTOTYP · Beispieldaten, nur auf diesem Tablet');
}

/** Sync-Status: normal nur ein Punkt, Text nur bei Problemen; Tippen aktualisiert. Inhalt setzt app.statusZeichnen(). */
export function syncAnzeige(app) {
  return h('button', { type: 'button', class: 'sync-punkt', 'data-sync': '', onclick: () => app.aktualisieren() });
}

/** Kopfleiste der Unterseiten: Zurück links, Titel, Sync-Status rechts. */
export function unterKopf(app, titel, { zurueckText = 'Zurück' } = {}) {
  return h('header', { class: 'kopf unter' },
    h('button', { type: 'button', class: 'kopf-zurueck', onclick: () => app.zurueck() },
      icon('pfeilLinks', { groesse: 22, strich: 2.5 }), zurueckText),
    h('h1', { class: 'kopf-titel' }, titel),
    syncAnzeige(app));
}

/**
 * Fahrzeug zu einem Markt anzeigen? In „Alle Märkte" immer, sonst nur wenn es nicht das
 * eigene Fahrzeug des Tablets ist (Firmen-Tablet: immer).
 */
export function fremdesFahrzeug(app, marktName) {
  const z = app.zustand;
  const m = marktFinden(z.konfig, marktName);
  if (!m) return null;
  if (z.ansicht && z.ansicht.typ === 'alle') return m.fahrzeug;
  const eigenes = z.standard && z.standard.typ === 'fahrzeug' ? z.standard.wert : null;
  return m.fahrzeug !== eigenes ? m.fahrzeug : null;
}

/** Markt-Überschrift (F6 v3): Ort-Symbol, Name in Großbuchstaben, ggf. dezent das Fahrzeug. Kein Zähler. */
export function marktKopf(app, name, { klein = false } = {}) {
  const fz = fremdesFahrzeug(app, name);
  return h('div', { class: 'markt-v3' + (klein ? ' klein' : '') },
    h('div', { class: 'markt-name' },
      icon('ort', { groesse: 20, strich: 2.2 }),
      h('h2', null, name)),
    fz && h('span', { class: 'fz' }, icon('lkw', { groesse: 18 }), fz));
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

/** Statuszeile der erledigten Zettel, mit „Rückgängig" (zwei Tipps). */
export function statusZeile(app, b) {
  const abgeholt = b.status === 'abgeholt';
  return h('div', { class: 'status-zeile' },
    h('span', { class: 'status-punkt' },
      abgeholt ? icon('haken', { groesse: 17, strich: 3.2 }) : icon('kreuz', { groesse: 15, strich: 3.4 })),
    h('span', { class: 'status-text' }, statusText(b)),
    zweiTippKnopf(app, 'zurueck:' + b.id, 'rueckgaengig', () => app.rueckgaengig(b.id)));
}

/**
 * „Als abgeholt markieren" in zwei Tipps: Der erste Tipp macht den Knopf scharf (4 Sekunden),
 * erst der zweite setzt den Status. Danach „Rückgängig" auf dem Zettel.
 */
export function abgeholtKnopf(app, b, { breit = false } = {}) {
  return zweiTippKnopf(app, 'abholen:' + b.id, 'knopf-abgeholt' + (breit ? ' breit' : ''), () => app.abholen(b.id));
}

/** Knopf, der erst beim zweiten Tipp innerhalb von 4 Sekunden auslöst – gegen Versehen. */
function zweiTippKnopf(app, schluessel, klasse, ausloesen) {
  const k = h('button', { type: 'button', class: klasse, 'data-scharf': schluessel });
  scharfInhalt(k, app.istScharf(schluessel));
  k.addEventListener('click', (e) => {
    e.stopPropagation();
    if (k.classList.contains('scharf')) ausloesen();
    else app.scharfSchalten(schluessel);
  });
  return k;
}

/** Beschriftung je Zustand; die Breite bleibt beim Scharfschalten gleich. */
export function scharfInhalt(k, scharf) {
  k.classList.toggle('scharf', scharf);
  if (k.classList.contains('haken')) {
    // Startseite (F6 v3): Kreis-Haken + „Abgeholt?" → Haken + „Nochmal tippen"; Größe fest in der CSS.
    k.replaceChildren(
      icon(scharf ? 'haken' : 'kreisHaken', { groesse: 30, strich: scharf ? 3 : 2 }),
      scharf ? 'Nochmal tippen' : 'Abgeholt?');
    return;
  }
  if (k.classList.contains('rueckgaengig')) {
    // Feste Mindestbreite in der CSS – passt für beide Texte.
    k.replaceChildren(scharf ? 'Nochmal tippen' : 'Rückgängig');
    return;
  }
  if (scharf && !k.style.width && k.offsetWidth) k.style.width = k.offsetWidth + 'px';
  if (!scharf) k.style.width = '';
  k.replaceChildren(
    icon(scharf ? 'haken' : 'kreisHaken', { groesse: 24, strich: scharf ? 3 : 2.2 }),
    scharf ? 'Nochmal tippen' : 'Als abgeholt markieren');
}

/** „Tel. 0171 …" bzw. „E-Mail …" – das Kontaktfeld ist Freitext. */
export function kontaktText(kontakt) {
  return (kontakt.includes('@') ? 'E-Mail ' : 'Tel. ') + kontakt;
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
    const infos = [b.kontakt && kontaktText(b.kontakt), b.kommentar && '„' + b.kommentar + '“'].filter(Boolean);
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

/**
 * Offener Zettel auf der Startseite (F6 v3 „Schlicht"): Bestellung im blauen Feld, darunter eine Zeile
 * mit Kunde (+ Symbol, falls Kontakt hinterlegt), Kommentar und rechts „Abgeholt?" (zwei Tipps).
 * Kontakt selbst steht nur in der Detailansicht – Zettel antippen.
 */
export function zettelSchlicht(app, b) {
  const oeffnen = () => app.navigieren('detail', { detailId: b.id, detailStorno: null });
  const kontakt = b.kontakt && b.kontakt.trim();
  return h('article', { class: 'zettel-s', onclick: oeffnen },
    h('button', { type: 'button', class: 'ware', 'aria-label': 'Bestellung von ' + b.kunde + ' öffnen: ' + b.bestellung }, b.bestellung),
    h('div', { class: 'unten' },
      h('div', { class: 'wer' },
        h('span', { class: 'kunde' }, b.kunde,
          kontakt && h('span', { class: 'kontakt-icon', title: 'Kontakt hinterlegt', 'aria-label': 'Kontakt hinterlegt', role: 'img' },
            icon(kontakt.includes('@') ? 'brief' : 'telefon', { groesse: 18 }))),
        b.kommentar && h('span', { class: 'hinweis' }, icon('sprechblase', { groesse: 18, strich: 2.2 }), b.kommentar),
        b.wartet && h('span', { class: 'wartet' }, '⏳ wird gesendet')),
      hakenKnopf(app, b)));
}

/** „Abgeholt?" auf dem schlichten Zettel – zwei Tipps wie „Als abgeholt markieren". */
function hakenKnopf(app, b) {
  const k = zweiTippKnopf(app, 'abholen:' + b.id, 'haken', () => app.abholen(b.id));
  k.setAttribute('aria-label', 'Als abgeholt markieren');
  return k;
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
