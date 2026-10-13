// Bestätigung nach dem Speichern einer neuen Bestellung – zum Nachlesen.
// Blau, weil die neue Bestellung „offen" ist (Grün bleibt „abgeholt" vorbehalten).

import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { demoStreifen, marktKopf, zettel } from '../komponenten.js';
import { datumVoll, datumKurz } from '../datum.js';
import { formularNeuStarten } from './formular.js';

export function bestaetigungZeichnen(app) {
  const b = app.zustand.bestaetigung;
  const zeile = (label, wert) => wert && h('div', { class: 'detail-zeile' }, h('span', { class: 'detail-label' }, label), h('span', null, wert));
  const z = zettel(app, b, { mitAktion: false, antippbar: false });
  z.classList.add('detail');
  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    h('div', { class: 'inhalt schmal' },
      h('div', { class: 'erfolg-kopf', role: 'status' }, icon('kreisHaken', { groesse: 34, strich: 2.2 }), 'Bestellung gespeichert'),
      h('div', { class: 'detail-markt' }, marktKopf(app, b.markt, [], { zaehler: false })),
      z,
      h('div', { class: 'karte detail-info' },
        zeile('Abholung', datumVoll(b.datum)),
        zeile('Kontakt', b.kontakt && 'Tel. ' + b.kontakt),
        zeile('Kommentar', b.kommentar),
        zeile('Aufgenommen', b.erfasstVon)),
      h('div', { class: 'knopf-spalte' },
        h('button', {
          type: 'button', class: 'knopf betont breit speichern-knopf',
          onclick: () => {
            app.zurueck();
            toast('Gespeichert für ' + datumKurz(b.datum) + ' · ' + b.markt, {
              dauer: 6000,
              aktion: { text: 'Anzeigen', fn: () => { app.zeitraumSetzen('tag'); app.tagSetzen(b.datum); } },
            });
          },
        }, 'Fertig – zur Übersicht'),
        h('button', {
          type: 'button', class: 'knopf breit',
          onclick: () => app.navigieren('formular', { formular: formularNeuStarten(app) }, { ersetzen: true }),
        }, icon('plus', { groesse: 22, strich: 2.5 }), 'Noch eine Bestellung'))));
}
