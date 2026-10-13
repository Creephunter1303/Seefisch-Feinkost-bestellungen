// Einstellungen: Verbindung, Standard-Ansicht des Tablets (Admin-PIN), Prototyp-Schalter.

import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { demoStreifen, unterKopf } from '../komponenten.js';
import { geraeteId, allesLoeschen } from '../speicher.js';
import { echtHeuteIso, plusTage, datumKurz, heuteIso, istSimuliert, zeitpunktText } from '../datum.js';
import { ansichtName } from '../logik.js';
import { demoEinstellungen, demoEinstellungenSpeichern, demoDatenZuruecksetzen } from '../daten/demo.js';
import { APP_VERSION } from '../version.js';

function abschnitt(titel, ...inhalt) {
  return h('section', { class: 'karte' }, h('h2', null, titel), inhalt);
}

function schalter(titel, erklaerung, an, beiWechsel) {
  return h('div', { class: 'schalter-zeile' },
    h('div', { class: 'schalter-text' }, h('strong', null, titel), erklaerung && h('span', null, erklaerung)),
    h('button', {
      type: 'button', class: 'knopf schalter' + (an ? ' an' : ''), 'aria-pressed': an ? 'true' : 'false',
      onclick: beiWechsel,
    }, an ? '✓ An' : 'Aus'));
}

export function einstellungenZeichnen(app) {
  const z = app.zustand;
  const n = app.warteschlange.anzahl();
  return h('div', { class: 'bs' },
    app.istDemo && demoStreifen(),
    unterKopf(app, 'Einstellungen'),
    h('div', { class: 'inhalt schmal' },
      abschnitt('Verbindung',
        h('p', null, z.fehler ? '⚠ Letzte Aktualisierung fehlgeschlagen: ' + z.fehler : 'Verbindung in Ordnung.'),
        z.stand && h('p', null, 'Stand der Daten: ' + zeitpunktText(z.stand)),
        h('p', null, n ? '⏳ ' + n + (n === 1 ? ' Änderung wartet' : ' Änderungen warten') + ' auf das Senden.' : 'Alle Änderungen sind gesendet.'),
        h('p', { class: 'hinweis-text' }, 'Die Übersicht aktualisiert sich alle 3 Minuten von selbst.'),
        h('button', { type: 'button', class: 'knopf breit', onclick: () => app.aktualisieren() }, icon('zurueckDrehen', { groesse: 22 }), 'Jetzt aktualisieren')),

      abschnitt('Dieses Tablet',
        h('p', null, 'Standard-Ansicht beim Öffnen: ', h('strong', null, ansichtName(z.standard))),
        h('p', { class: 'hinweis-text' }, 'Vorübergehend umschalten geht jederzeit oben links. Am nächsten Tag zeigt das Tablet automatisch wieder seine Standard-Ansicht.'),
        h('button', { type: 'button', class: 'knopf breit', onclick: () => app.overlayOeffnen('pin') }, icon('schloss', { groesse: 22 }), 'Standard ändern (Admin-PIN)')),

      app.istDemo && demoAbschnitt(app),

      abschnitt('Über diese App',
        h('p', null, 'Seefisch-Feinkost · Bestellungen · Version ' + APP_VERSION + (app.istDemo ? ' (Prototyp)' : '')),
        h('p', { class: 'hinweis-text' }, 'Geräte-Kennung: ' + geraeteId()))));
}

function demoAbschnitt(app) {
  const e = demoEinstellungen();
  const aendern = (neu, text) => {
    demoEinstellungenSpeichern({ ...e, ...neu });
    if ('tag' in neu) app.heuteNeuSetzen(neu.tag);
    app.aktualisieren();
    app.render();
    if (text) toast(text);
  };
  const echt = echtHeuteIso();
  const tage = [];
  for (let i = 0; i < 7; i++) tage.push(plusTage(echt, i));

  return abschnitt('Nur im Prototyp',
    h('p', { class: 'hinweis-text' }, 'Admin-PIN im Prototyp: 1234'),
    schalter('Verbindung unterbrechen', 'Zum Testen der Fehlermeldungen (wie Funkloch).', e.offline,
      () => aendern({ offline: !e.offline }, e.offline ? 'Verbindung wieder da.' : 'Verbindung unterbrochen (Test).')),
    schalter('Weihnachtsmenge', 'Ca. 60 Bestellungen pro Woche statt ca. 10.', e.weihnachten,
      () => aendern({ weihnachten: !e.weihnachten }, 'Beispieldaten werden neu erzeugt …')),
    h('div', { class: 'feld-titel' }, 'Tag simulieren'),
    h('p', { class: 'hinweis-text' }, 'So tun, als wäre heute ein anderer Tag (z. B. Samstag, wenn alle Wagen auf dem Markt sind).'),
    h('div', { class: 'auswahl-gitter termine' },
      tage.map((t) => {
        const gewaehlt = t === echt ? !istSimuliert() : heuteIso() === t && istSimuliert();
        return h('button', {
          type: 'button', class: 'auswahl' + (gewaehlt ? ' gewaehlt' : ''),
          onclick: () => aendern({ tag: t === echt ? null : t }, 'Heute ist jetzt: ' + datumKurz(t)),
        }, h('span', { class: 'auswahl-titel' }, (gewaehlt ? '✓ ' : '') + datumKurz(t)), h('small', null, t === echt ? 'echtes Datum' : 'simuliert'));
      })),
    h('div', { class: 'knopf-spalte' },
      h('button', {
        type: 'button', class: 'knopf breit',
        onclick: () => { demoDatenZuruecksetzen(); app.aktualisieren(); toast('Beispieldaten neu erzeugt.'); },
      }, '↻ Beispieldaten neu erzeugen'),
      h('button', {
        type: 'button', class: 'knopf breit',
        onclick: () => { allesLoeschen(); location.reload(); },
      }, '⟲ Prototyp zurücksetzen (wie neu installiert)')));
}
