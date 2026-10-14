// Einrichtungs-Link von Hand einfügen. Nötig für die App vom iPhone-Home-Bildschirm: Sie hat einen
// eigenen Speicher und bekommt die Verbindung aus Safari nicht mit. Nur im Prototyp-Modus sichtbar.

import { h } from '../ui.js';
import { icon } from '../icons.js';
import { einrichtungAusText } from '../daten/index.js';

// Eingabe und Fehler überleben das Neuzeichnen der Seite (automatisches Aktualisieren).
let entwurf = '';
let fehler = '';

/** titel: false, wenn der umgebende Abschnitt schon eine Überschrift hat. */
export function linkEinfuegen({ titel = true } = {}) {
  const meldung = h('div', { class: 'meldung fehler', role: 'alert', hidden: !fehler }, fehler);
  const zeigeFehler = (text) => {
    fehler = text || '';
    meldung.textContent = fehler;
    meldung.hidden = !fehler;
  };

  const feld = h('textarea', {
    id: 'linkfeld', class: 'eingabe link-feld', rows: 3,
    placeholder: 'https://…#api=…&k=…',
    autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    'aria-label': 'Einrichtungs-Link',
  });
  feld.value = entwurf;
  feld.addEventListener('input', () => { entwurf = feld.value; if (fehler) zeigeFehler(''); });

  const verbinden = () => {
    const f = einrichtungAusText(feld.value);
    if (f) { zeigeFehler(f); return; }
    entwurf = '';
    location.reload();   // App startet mit echter Verbindung neu und meldet „Verbunden …"
  };

  const einfuegenKnopf = navigator.clipboard && navigator.clipboard.readText
    ? h('button', {
      type: 'button', class: 'knopf',
      onclick: async () => {
        try {
          feld.value = (await navigator.clipboard.readText()).trim();
          entwurf = feld.value;
          zeigeFehler('');
        } catch (e) {
          zeigeFehler('Die Zwischenablage ließ sich nicht lesen. Bitte lange ins Feld tippen → „Einfügen".');
        }
      },
    }, icon('ablage', { groesse: 22 }), 'Aus Zwischenablage einfügen')
    : null;

  return h('div', { class: 'link-einfuegen' },
    titel && h('div', { class: 'feld-titel' }, 'Einrichtungs-Link einfügen'),
    h('p', { class: 'hinweis-text' },
      'Den Link aus der Tabelle (Blatt „Tablets", Spalte D) kopieren und hier einfügen. ' +
      'Nötig für die App vom iPhone-Home-Bildschirm – sie übernimmt die Verbindung aus Safari nicht.'),
    feld,
    meldung,
    h('div', { class: 'knopf-reihe' },
      einfuegenKnopf,
      h('button', { type: 'button', class: 'knopf betont', onclick: verbinden }, icon('haken', { groesse: 22, strich: 2.5 }), 'Verbinden')));
}
