// Bausteine, die auf mehreren Bildschirmen gleich aussehen (Konsistenz-Regel).

import { h } from './ui.js';
import { uhrzeit, iso, echtHeuteIso, tagMonat } from './datum.js';

export function demoStreifen() {
  return h('div', { class: 'demo-streifen' }, 'PROTOTYP · Beispieldaten, nur auf diesem Tablet');
}

/** Kopfzeile der Unterseiten: Zurück links, Titel, Verbindungsstatus rechts. */
export function unterKopf(app, titel, { zurueckText = '‹ Zurück' } = {}) {
  return h('header', { class: 'kopf' },
    h('button', { type: 'button', class: 'kopf-zurueck', onclick: () => app.zurueck() }, zurueckText),
    h('h1', { class: 'kopf-titel' }, titel),
    h('div', { class: 'kopf-rechts' },
      h('button', { type: 'button', class: 'status-pill', onclick: () => app.aktualisieren() })));
}

/** Gut sichtbares Markt-Etikett, bei fremden Märkten mit Fahrzeug. */
export function marktEtikett(markt, fahrzeug) {
  return h('span', { class: 'markt-etikett' },
    h('span', { class: 'markt-name' }, markt),
    fahrzeug && h('span', { class: 'markt-fz' }, fahrzeug));
}

function zeitKurz(isoZeit) {
  const d = new Date(isoZeit);
  if (isNaN(d)) return '';
  return (iso(d) === echtHeuteIso() ? '' : tagMonat(iso(d)) + ', ') + uhrzeit(d) + ' Uhr';
}

/** Status immer als Wort + Zeichen + Farbe (nie Farbe allein). */
export function statusAnzeige(b) {
  if (b.status === 'abgeholt') {
    return h('div', { class: 'status abgeholt' },
      h('span', { class: 'status-wort' }, '✓ Abgeholt'),
      b.abgeholtAm && h('span', { class: 'status-zeit' }, zeitKurz(b.abgeholtAm)),
      b.wartet && h('span', { class: 'status-zeit' }, '⏳ wird gesendet'));
  }
  if (b.status === 'storniert') {
    return h('div', { class: 'status storniert' }, h('span', { class: 'status-wort' }, '✕ Storniert'));
  }
  return h('div', { class: 'status offen' },
    h('span', { class: 'status-wort' }, '○ Offen'),
    b.wartet && h('span', { class: 'status-zeit' }, '⏳ wird gesendet'));
}

/**
 * „Abgeholt" in zwei Tipps: Der erste Tipp macht den Knopf scharf (4 Sekunden),
 * erst der zweite setzt den Status. Danach gibt es noch „Rückgängig".
 */
export function abholenKnopf(app, b, { breit = false } = {}) {
  const k = h('button', { type: 'button', class: 'abholen-knopf' + (breit ? ' breit' : ''), 'data-id': b.id });
  abholenKnopfInhalt(k, app.istScharf(b.id));
  k.addEventListener('click', (e) => {
    e.stopPropagation();
    if (k.classList.contains('scharf')) app.abholen(b.id);
    else app.scharfSchalten(b.id);
  });
  return k;
}

export function abholenKnopfInhalt(k, scharf) {
  k.classList.toggle('scharf', scharf);
  k.replaceChildren(...(scharf
    ? [h('span', { class: 'abholen-gross' }, 'Nochmal tippen'), h('span', { class: 'abholen-klein' }, '= abgeholt')]
    : [h('span', { class: 'abholen-gross' }, '✓ Abgeholt')]));
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
export function auswahlKnopf(titel, zusatz, gewaehlt, beiWahl) {
  return h('button', {
    type: 'button',
    class: 'auswahl' + (gewaehlt ? ' gewaehlt' : ''),
    'aria-pressed': gewaehlt ? 'true' : 'false',
    onclick: beiWahl,
  }, h('span', { class: 'auswahl-titel' }, gewaehlt ? '✓ ' + titel : titel), zusatz && h('small', null, zusatz));
}
