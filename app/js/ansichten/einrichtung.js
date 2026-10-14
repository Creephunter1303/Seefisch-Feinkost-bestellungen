// Erster Start: Zu welchem Fahrzeug gehört dieses Tablet? (= Standard-Ansicht)

import { h } from '../ui.js';
import { demoStreifen, auswahlKnopf } from '../komponenten.js';
import { ansichtName } from '../logik.js';

export function einrichtungZeichnen(app) {
  const z = app.zustand;
  const k = z.konfig;
  const waehlen = (a) => app.einrichtungAbschliessen(a);
  const passt = (name) => (z.tablet && z.tablet.name === name ? ' · passt zu diesem Tablet' : '');
  const anzahl = (f) => {
    const n = k.maerkte.filter((m) => m.fahrzeug === f).length;
    return n + (n === 1 ? ' Markt' : ' Märkte') + passt(f);
  };
  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    h('div', { class: 'inhalt schmal einrichtung' },
      h('h1', null, 'Willkommen!'),
      h('p', { class: 'einrichtung-frage' }, 'Zu welchem Fahrzeug gehört dieses Tablet?'),
      z.einrichtungHinweis && h('div', { class: 'meldung fehler' }, z.einrichtungHinweis),
      h('div', { class: 'auswahl-gitter gross' },
        k.fahrzeuge.map((f) => auswahlKnopf(f, anzahl(f), false, () => waehlen({ typ: 'fahrzeug', wert: f }), 'lkw')),
        auswahlKnopf('Firma', 'alle Märkte' + passt('Firma'), false, () => waehlen({ typ: 'alle' }), 'firma')),
      h('p', { class: 'hinweis-text' },
        'Das Tablet zeigt beim Öffnen immer die Bestellungen dieser Auswahl („' + ansichtName({ typ: 'alle' }) +
        '" für die Firma). Andere Fahrzeuge oder Märkte kann jeder vorübergehend mit einem Tipp anzeigen. ' +
        'Diese Grundeinstellung lässt sich später nur mit der Admin-PIN ändern.')));
}
