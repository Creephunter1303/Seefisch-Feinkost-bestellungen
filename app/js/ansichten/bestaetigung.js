// Bestätigung nach dem Speichern einer neuen Bestellung (wie in v3) – zum Nachlesen.

import { h, toast } from '../ui.js';
import { demoStreifen, marktEtikett } from '../komponenten.js';
import { datumVoll, datumKurz } from '../datum.js';
import { formularNeuStarten } from './formular.js';

export function bestaetigungZeichnen(app) {
  const z = app.zustand;
  const b = z.bestaetigung;
  const zeile = (label, wert) => wert && h('div', { class: 'detail-zeile' }, h('span', { class: 'detail-label' }, label), h('span', null, wert));
  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    h('div', { class: 'inhalt schmal' },
      h('div', { class: 'erfolg-kopf', role: 'status' },
        h('div', { class: 'erfolg-symbol', 'aria-hidden': 'true' }, '✓'),
        h('div', null, 'Bestellung gespeichert')),
      h('article', { class: 'detail-karte offen' },
        h('div', { class: 'detail-oben' }, marktEtikett(b.markt, null)),
        h('div', { class: 'detail-datum' }, 'Abholung: ', h('strong', null, datumVoll(b.datum))),
        h('div', { class: 'detail-ware' }, b.bestellung),
        h('div', { class: 'detail-kunde' }, b.kunde),
        zeile('Kontakt', b.kontakt),
        zeile('Kommentar', b.kommentar),
        zeile('Aufgenommen', b.erfasstVon)),
      h('div', { class: 'knopf-spalte' },
        h('button', {
          type: 'button', class: 'knopf primaer breit',
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
        }, '＋ Noch eine Bestellung'))));
}
