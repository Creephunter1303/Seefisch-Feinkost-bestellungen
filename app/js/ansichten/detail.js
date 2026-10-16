// Einzelne Bestellung: Zettel wie in der Übersicht, darunter alle Angaben,
// Abgeholt / Rückgängig / Bearbeiten, Stornieren abgesetzt (Rot = storniert).

import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { demoStreifen, unterKopf, marktKopf, zettel, abgeholtKnopf, namensGitter, kontaktText } from '../komponenten.js';
import { datumVoll, relativerTag, zeitpunktText } from '../datum.js';
import { Verbindungsfehler } from '../daten/fehler.js';
import { formularBearbeitenStarten } from './formular.js';

export function detailZeichnen(app) {
  const z = app.zustand;
  const b = app.bestellungFinden(z.detailId);
  if (!b) {
    return h('div', { class: 'bs' },
      app.istDemo && demoStreifen(),
      unterKopf(app, 'Bestellung'),
      h('div', { class: 'inhalt schmal' },
        h('div', { class: 'leer' },
          h('div', { class: 'leer-titel' }, 'Diese Bestellung ist nicht (mehr) in der Übersicht.'),
          h('p', { class: 'leer-text' }, 'Vergangene Bestellungen stehen nur in der Google-Tabelle.'),
          h('button', { type: 'button', class: 'knopf', onclick: () => app.zurueck() }, 'Zurück zur Übersicht'))));
  }

  const rel = relativerTag(b.datum);
  const zeile = (label, wert, klein = false) => wert && h('div', { class: 'detail-zeile' + (klein ? ' klein' : '') },
    h('span', { class: 'detail-label' }, label), h('span', null, wert));

  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    unterKopf(app, 'Bestellung'),
    h('div', { class: 'inhalt schmal' },
      h('div', { class: 'detail-markt' }, marktKopf(app, b.markt)),
      zettelDetail(app, b),
      h('div', { class: 'karte detail-info' },
        zeile('Abholung', datumVoll(b.datum) + (rel ? ' · ' + rel : '')),
        zeile('Kontakt', b.kontakt ? kontaktText(b.kontakt) : 'keine Angabe'),
        zeile('Kommentar', b.kommentar || 'kein Kommentar'),
        zeile('Aufgenommen', b.erfasstVon && b.erfasstVon + (b.erfasstAm ? ', ' + zeitpunktText(b.erfasstAm) : ''), true),
        zeile('Geändert', b.geaendertVon && b.geaendertVon + (b.geaendertAm ? ', ' + zeitpunktText(b.geaendertAm) : ''), true),
        zeile('Bestell-Nr.', b.id, true)),

      b.status !== 'storniert' && h('div', { class: 'detail-aktionen' },
        b.status === 'offen' && abgeholtKnopf(app, b, { breit: true }),
        h('button', {
          type: 'button', class: 'knopf breit',
          onclick: () => app.navigieren('formular', { formular: formularBearbeitenStarten(app, b) }),
        }, icon('stift', { groesse: 22 }), 'Bearbeiten')),

      b.status !== 'storniert' && stornoBereich(app, b)));
}

/** Der Zettel wie in der Übersicht – hier nicht antippbar, „Rückgängig" bleibt auf dem Zettel. */
function zettelDetail(app, b) {
  const z = zettel(app, b, { mitAktion: false, antippbar: false });
  z.classList.add('detail');
  return z;
}

function stornoBereich(app, b) {
  const z = app.zustand;
  const s = z.detailStorno;
  if (!s) {
    return h('div', { class: 'storno-bereich' },
      h('button', {
        type: 'button', class: 'knopf rot-umriss breit',
        onclick: () => {
          z.detailStorno = { name: '', sendet: false, fehler: null };
          app.render();
          const el = document.getElementById('storno');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      }, icon('kreuz', { groesse: 20, strich: 2.5 }), 'Bestellung stornieren'));
  }
  return h('div', { class: 'storno-bereich offen', id: 'storno' },
    h('p', { class: 'storno-frage' }, 'Bestellung von ' + b.kunde + ' wirklich stornieren?'),
    h('p', { class: 'storno-hinweis' }, 'Sie bleibt sichtbar und lässt sich mit „Rückgängig" wieder öffnen.'),
    h('div', { class: 'feld-titel' }, 'Wer storniert?'),
    namensGitter(z.konfig.mitarbeiter, s.name, (n) => { s.name = n; app.render(); }),
    s.fehler && h('div', { class: 'meldung fehler', role: 'alert' }, s.fehler),
    h('div', { class: 'knopf-reihe' },
      h('button', { type: 'button', class: 'knopf', onclick: () => { z.detailStorno = null; app.render(); } }, 'Doch nicht'),
      h('button', {
        type: 'button', class: 'knopf rot', disabled: !s.name || s.sendet,
        onclick: () => stornieren(app, b, s),
      }, s.sendet ? 'Storniere …' : s.name ? 'Ja, stornieren' : 'Erst Namen antippen')));
}

async function stornieren(app, b, s) {
  const z = app.zustand;
  s.sendet = true;
  s.fehler = null;
  app.render();
  try {
    await app.stornieren(b.id, s.name);
    z.detailStorno = null;
    app.zurueck();
    toast('Bestellung von ' + b.kunde + ' storniert.');
  } catch (e) {
    s.sendet = false;
    s.fehler = '⚠ Nicht storniert: ' + e.message + (e instanceof Verbindungsfehler ? ' Bitte erneut versuchen.' : '');
    app.render();
  }
}
