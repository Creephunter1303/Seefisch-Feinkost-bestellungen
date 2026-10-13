// Einzelne Bestellung: alle Daten, Abgeholt / Bearbeiten, Stornieren (abgesetzt und rot).

import { h, toast } from '../ui.js';
import { demoStreifen, unterKopf, marktEtikett, statusAnzeige, abholenKnopf, namensGitter } from '../komponenten.js';
import { datumVoll, relativerTag, zeitpunktText } from '../datum.js';
import { marktFinden } from '../logik.js';
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
          h('button', { type: 'button', class: 'knopf primaer', onclick: () => app.zurueck() }, '‹ Zurück zur Übersicht'))));
  }

  const m = marktFinden(z.konfig, b.markt);
  const rel = relativerTag(b.datum);
  const verlauf = [
    b.erfasstVon && ['Aufgenommen', b.erfasstVon + (b.erfasstAm ? ', ' + zeitpunktText(b.erfasstAm) : '')],
    b.geaendertVon && ['Zuletzt geändert', b.geaendertVon + (b.geaendertAm ? ', ' + zeitpunktText(b.geaendertAm) : '')],
    b.status === 'abgeholt' && b.abgeholtAm && ['Abgeholt', zeitpunktText(b.abgeholtAm)],
    b.status === 'storniert' && ['Storniert', (b.storniertVon || 'unbekannt') + (b.storniertAm ? ', ' + zeitpunktText(b.storniertAm) : '')],
  ].filter(Boolean);

  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    unterKopf(app, 'Bestellung'),
    h('div', { class: 'inhalt schmal' },
      h('article', { class: 'detail-karte ' + b.status },
        h('div', { class: 'detail-oben' },
          marktEtikett(b.markt, m ? m.fahrzeug : null),
          statusAnzeige(b)),
        h('div', { class: 'detail-datum' }, 'Abholung: ', h('strong', null, datumVoll(b.datum)), rel && ' · ' + rel),
        h('div', { class: 'detail-ware' }, b.bestellung),
        h('div', { class: 'detail-kunde' }, b.kunde),
        b.kontakt && h('div', { class: 'detail-zeile' }, h('span', { class: 'detail-label' }, 'Kontakt'), h('span', null, '☎ ' + b.kontakt)),
        b.kommentar && h('div', { class: 'detail-zeile' }, h('span', { class: 'detail-label' }, 'Kommentar'), h('span', null, '💬 ' + b.kommentar)),
        h('div', { class: 'detail-verlauf' },
          verlauf.map(([label, text]) => h('div', { class: 'detail-zeile klein' }, h('span', { class: 'detail-label' }, label), h('span', null, text))),
          h('div', { class: 'detail-zeile klein' }, h('span', { class: 'detail-label' }, 'Bestell-Nr.'), h('span', null, b.id)))),

      b.status === 'storniert'
        ? h('div', { class: 'meldung info' }, 'Diese Bestellung ist storniert und kann nicht mehr geändert werden.')
        : h('div', { class: 'detail-aktionen' },
          b.status === 'offen' && abholenKnopf(app, b, { breit: true }),
          b.status === 'abgeholt' && h('button', {
            type: 'button', class: 'knopf breit', onclick: () => app.wiederOffen(b.id),
          }, '↩ Doch nicht abgeholt – wieder „Offen"'),
          h('button', {
            type: 'button', class: 'knopf breit',
            onclick: () => app.navigieren('formular', { formular: formularBearbeitenStarten(app, b) }),
          }, '✏️ Bearbeiten')),

      b.status !== 'storniert' && stornoBereich(app, b)));
}

function stornoBereich(app, b) {
  const z = app.zustand;
  const s = z.detailStorno;
  if (!s) {
    return h('div', { class: 'storno-bereich' },
      h('button', {
        type: 'button', class: 'knopf gefahr-umriss breit',
        onclick: () => {
          z.detailStorno = { name: '', sendet: false, fehler: null };
          app.render();
          const el = document.getElementById('storno');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      }, '✕ Bestellung stornieren'));
  }
  return h('div', { class: 'storno-bereich offen', id: 'storno' },
    h('p', { class: 'storno-frage' }, 'Bestellung von ' + b.kunde + ' wirklich stornieren?'),
    h('p', { class: 'storno-hinweis' }, 'Sie bleibt in der Tabelle erhalten und wird dort als „Storniert" markiert.'),
    h('div', { class: 'feld-titel' }, 'Wer storniert?'),
    namensGitter(z.konfig.mitarbeiter, s.name, (n) => { s.name = n; app.render(); }),
    s.fehler && h('div', { class: 'meldung fehler', role: 'alert' }, s.fehler),
    h('div', { class: 'knopf-reihe' },
      h('button', { type: 'button', class: 'knopf', onclick: () => { z.detailStorno = null; app.render(); } }, 'Doch nicht'),
      h('button', {
        type: 'button', class: 'knopf gefahr', disabled: !s.name || s.sendet,
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
    s.fehler = '❌ Nicht storniert: ' + e.message + (e instanceof Verbindungsfehler ? ' Bitte erneut versuchen.' : '');
    app.render();
  }
}
