// Neue Bestellung / Bestellung bearbeiten – eine Aufgabe pro Bildschirm.
// Eingaben werden laufend als Entwurf gesichert (Zurück-Taste, Absturz, Funkloch).

import { h, toast, vibrieren } from '../ui.js';
import { lesen, schreiben, loeschen, geraeteId } from '../speicher.js';
import { heuteIso, plusTage, VORLAUF_TAGE, relativerTag, TAGE_LANG, wochentag, tagMonat, datumKurz, uhrzeit } from '../datum.js';
import { vorbelegterMarkt, marktnamenDerAnsicht, marktFinden, termine, tageText, maerkteNachFahrzeug } from '../logik.js';
import { bestellungPruefen, MAX_LAENGE } from '../pruefung.js';
import { Verbindungsfehler } from '../daten/fehler.js';
import { demoStreifen, unterKopf, namensGitter } from '../komponenten.js';

const ENTWURF = 'entwurf';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PFLICHTFELDER = ['markt', 'datum', 'kunde', 'bestellung', 'mitarbeiter'];
const TERMINE_ANFANGS = 6;

/** Bestell-ID entsteht schon auf dem Tablet – so legt erneutes Senden nichts doppelt an. */
export function neueBestellId() {
  const zahlen = new Uint8Array(8);
  crypto.getRandomValues(zahlen);
  return 'B-' + Array.from(zahlen, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

function leereFelder() {
  return { id: neueBestellId(), markt: '', datum: '', kunde: '', bestellung: '', kontakt: '', kommentar: '', mitarbeiter: '' };
}

function hatInhalt(f) {
  return !!(f.kunde || f.bestellung || f.kontakt || f.kommentar);
}

/** Ein Entwurf kann veraltet sein: Markt umbenannt, Abholtag inzwischen vorbei. */
function bereinigen(f, konfig) {
  if (f.markt && !marktFinden(konfig, f.markt)) { f.markt = ''; f.datum = ''; }
  if (f.datum && f.datum < heuteIso()) f.datum = '';
  if (f.mitarbeiter && !konfig.mitarbeiter.includes(f.mitarbeiter)) f.mitarbeiter = '';
  return f;
}

function zustandBauen(modus, felder, wiederhergestellt, original) {
  return {
    modus, felder, original, wiederhergestellt,
    beruehrt: {}, versucht: false, sendet: false, fehlgeschlagen: false, meldung: null,
    weitereMaerkte: false, weitereTermine: false,
  };
}

export function formularNeuStarten(app) {
  const z = app.zustand;
  const e = lesen(ENTWURF);
  if (e && e.modus === 'neu' && e.felder && hatInhalt(e.felder)) {
    return zustandBauen('neu', bereinigen({ ...leereFelder(), ...e.felder }, z.konfig), e.zeit, null);
  }
  const f = leereFelder();
  f.markt = vorbelegterMarkt(z.konfig, z.ansicht) || '';
  return zustandBauen('neu', f, null, null);
}

export function formularBearbeitenStarten(app, b) {
  const z = app.zustand;
  const e = lesen(ENTWURF);
  if (e && e.modus === 'bearbeiten' && e.felder && e.felder.id === b.id) {
    return zustandBauen('bearbeiten', bereinigen({ ...e.felder }, z.konfig), e.zeit, b);
  }
  const f = {
    id: b.id, markt: b.markt, datum: b.datum, kunde: b.kunde, bestellung: b.bestellung,
    kontakt: b.kontakt || '', kommentar: b.kommentar || '', mitarbeiter: '',
  };
  return zustandBauen('bearbeiten', bereinigen(f, z.konfig), null, b);
}

function entwurfSichern(fo) {
  schreiben(ENTWURF, { modus: fo.modus, felder: fo.felder, zeit: new Date().toISOString() });
}

function pruefen(app) {
  const fo = app.zustand.formular;
  return bestellungPruefen(fo.felder, app.zustand.konfig, { heute: heuteIso(), bearbeiten: fo.modus === 'bearbeiten' });
}

// ---------- Zeichnen ----------

export function formularZeichnen(app) {
  const z = app.zustand;
  const fo = z.formular;
  const neu = fo.modus === 'neu';
  const wurzel = h('div', { class: 'bs bs-formular' },
    app.istDemo && demoStreifen(),
    unterKopf(app, neu ? 'Neue Bestellung' : 'Bestellung bearbeiten', { zurueckText: '‹ Abbrechen' }),
    h('div', { class: 'inhalt schmal formular' },
      fo.wiederhergestellt && h('div', { class: 'meldung info', id: 'entwurf-hinweis' },
        h('span', null, 'Entwurf von ' + uhrzeit(fo.wiederhergestellt) + ' Uhr wiederhergestellt.'),
        h('button', { type: 'button', class: 'knopf klein', onclick: () => entwurfVerwerfen(app) }, 'Verwerfen')),
      !neu && h('div', { class: 'meldung info' },
        h('span', null, 'Du bearbeitest die Bestellung von ', h('strong', null, fo.original.kunde), '.')),
      abschnittMarkt(app),
      abschnittDatum(app),
      textFeld(app, 'kunde', 'Kunde', { pflicht: true, platzhalter: 'Name des Kunden', gross: 'words' }),
      textFeld(app, 'bestellung', 'Bestellung', { pflicht: true, mehrzeilig: true, platzhalter: 'z. B. 2 kg Lachsfilet, 1 kg Garnelen' }),
      textFeld(app, 'kontakt', 'Kontakt', { hinweis: 'optional · ab 50 € empfohlen', platzhalter: 'Telefon oder E-Mail' }),
      textFeld(app, 'kommentar', 'Kommentar', { hinweis: 'optional', mehrzeilig: true, platzhalter: 'Besonderheiten, Abholzeit …' }),
      abschnittMitarbeiter(app),
      h('div', { id: 'formular-meldung' }, meldungElement(fo)),
      h('button', { type: 'button', class: 'knopf primaer breit speichern-knopf', id: 'speichern-knopf', onclick: () => speichern(app) },
        speichernInhalt(fo)),
      h('button', { type: 'button', class: 'knopf breit', onclick: () => app.zurueck() }, 'Abbrechen')));
  // Fehler-/OK-Markierungen nach dem Einhängen setzen.
  queueMicrotask(() => PFLICHTFELDER.concat(['kontakt', 'kommentar']).forEach((n) => feldStatus(app, n)));
  return wurzel;
}

function feldTitel(text, { pflicht = false, hinweis = null, fuer = null } = {}) {
  return h(fuer ? 'label' : 'div', { class: 'feld-titel', for: fuer },
    h('span', null, text),
    pflicht && h('span', { class: 'pflicht', 'aria-label': 'Pflichtfeld' }, '*'),
    hinweis && h('span', { class: 'feld-hinweis' }, hinweis),
    h('span', { class: 'ok-marke', 'aria-hidden': 'true' }, '✓'));
}

function abschnittMarkt(app) {
  const z = app.zustand;
  const fo = z.formular;
  const k = z.konfig;
  const eigeneNamen = z.ansicht.typ === 'alle' ? [] : marktnamenDerAnsicht(k, z.ansicht);
  const eigene = k.maerkte.filter((m) => eigeneNamen.includes(m.name));
  const rest = k.maerkte.filter((m) => !eigeneNamen.includes(m.name));
  const zeigeRest = !eigene.length || fo.weitereMaerkte || rest.some((m) => m.name === fo.felder.markt);

  const knopf = (m) => h('button', {
    type: 'button',
    class: 'auswahl' + (fo.felder.markt === m.name ? ' gewaehlt' : ''),
    'aria-pressed': fo.felder.markt === m.name ? 'true' : 'false',
    onclick: () => marktWaehlen(app, m.name),
  }, h('span', { class: 'auswahl-titel' }, (fo.felder.markt === m.name ? '✓ ' : '') + m.name), h('small', null, tageText(m)));

  // Weitere Märkte nach Fahrzeug gruppiert, damit man nicht 13 Knöpfe absuchen muss.
  const gruppen = !zeigeRest ? [] : maerkteNachFahrzeug(k, rest).flatMap(([fahrzeug, maerkte]) => [
    h('div', { class: 'gruppe-titel' }, fahrzeug),
    h('div', { class: 'auswahl-gitter' }, maerkte.map(knopf)),
  ]);

  return h('div', { class: 'feld', id: 'abschnitt-markt' },
    feldTitel('Markt', { pflicht: true }),
    eigene.length > 0 && h('div', { class: 'gruppe-titel' }, z.ansicht.typ === 'markt' ? 'Markt der aktuellen Ansicht' : 'Märkte von ' + z.ansicht.wert),
    eigene.length > 0 && h('div', { class: 'auswahl-gitter' }, eigene.map(knopf)),
    zeigeRest ? gruppen
      : h('button', { type: 'button', class: 'mehr-knopf', onclick: () => { fo.weitereMaerkte = true; abschnittNeu(app, 'markt'); } },
        '▾ Andere Märkte anzeigen (' + rest.length + ')'),
    h('div', { class: 'feld-fehler', id: 'fehler-markt' }));
}

function marktWaehlen(app, name) {
  const fo = app.zustand.formular;
  const m = marktFinden(app.zustand.konfig, name);
  fo.felder.markt = name;
  fo.beruehrt.markt = true;
  if (fo.felder.datum && m && !m.tage.includes(wochentag(fo.felder.datum))) fo.felder.datum = '';
  fo.weitereTermine = false;
  entwurfSichern(fo);
  abschnittNeu(app, 'markt');
  abschnittNeu(app, 'datum');
}

function abschnittDatum(app) {
  const fo = app.zustand.formular;
  const m = marktFinden(app.zustand.konfig, fo.felder.markt);
  let inhalt;
  if (!m) {
    inhalt = h('div', { class: 'feld-leer' }, 'Bitte zuerst oben den Markt antippen.');
  } else {
    const heute = heuteIso();
    const alle = termine(m, heute, plusTage(heute, VORLAUF_TAGE));
    // Beim Bearbeiten: bisherigen Termin anbieten, auch wenn er außerhalb des Zeitfensters liegt.
    if (fo.felder.datum && !alle.includes(fo.felder.datum)) alle.unshift(fo.felder.datum);
    const index = alle.indexOf(fo.felder.datum);
    const zeigeAlle = fo.weitereTermine || index >= TERMINE_ANFANGS;
    const sichtbar = zeigeAlle ? alle : alle.slice(0, TERMINE_ANFANGS);
    inhalt = [
      h('div', { class: 'auswahl-gitter termine' }, sichtbar.map((t) => terminKnopf(app, t))),
      alle.length > sichtbar.length && h('button', {
        type: 'button', class: 'mehr-knopf',
        onclick: () => { fo.weitereTermine = true; abschnittNeu(app, 'datum'); },
      }, '▾ Weitere Termine anzeigen (bis ' + datumKurz(alle[alle.length - 1]) + ')'),
    ];
  }
  return h('div', { class: 'feld', id: 'abschnitt-datum' },
    feldTitel('Abholtag', { pflicht: true, hinweis: m ? 'nur Markttage von ' + m.name : null }),
    inhalt,
    h('div', { class: 'feld-fehler', id: 'fehler-datum' }));
}

function terminKnopf(app, t) {
  const fo = app.zustand.formular;
  const gewaehlt = fo.felder.datum === t;
  const rel = relativerTag(t);
  return h('button', {
    type: 'button',
    class: 'auswahl termin' + (gewaehlt ? ' gewaehlt' : ''),
    'aria-pressed': gewaehlt ? 'true' : 'false',
    onclick: () => {
      fo.felder.datum = t;
      fo.beruehrt.datum = true;
      entwurfSichern(fo);
      abschnittNeu(app, 'datum');
    },
  }, h('span', { class: 'auswahl-titel' }, (gewaehlt ? '✓ ' : '') + (rel || TAGE_LANG[wochentag(t)])), h('small', null, tagMonat(t)));
}

function textFeld(app, name, titel, { pflicht = false, mehrzeilig = false, hinweis = null, platzhalter = '', gross = 'sentences' }) {
  const fo = app.zustand.formular;
  const attrs = {
    id: 'feld-' + name, class: 'eingabe', name, placeholder: platzhalter, maxlength: MAX_LAENGE[name],
    autocomplete: 'off', autocapitalize: gross, value: fo.felder[name],
  };
  const eingabe = mehrzeilig ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: 'text', enterkeyhint: 'next' });
  eingabe.addEventListener('input', () => {
    fo.felder[name] = eingabe.value;
    entwurfSichern(fo);
    feldStatus(app, name);
  });
  eingabe.addEventListener('blur', () => {
    if (eingabe.value.trim()) fo.beruehrt[name] = true;
    feldStatus(app, name);
  });
  if (!mehrzeilig) {
    // Enter springt ins nächste Feld statt versehentlich zu speichern.
    eingabe.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const felder = [...document.querySelectorAll('.formular .eingabe')];
      const naechstes = felder[felder.indexOf(eingabe) + 1];
      if (naechstes) naechstes.focus(); else eingabe.blur();
    });
  }
  return h('div', { class: 'feld', id: 'abschnitt-' + name },
    feldTitel(titel, { pflicht, hinweis, fuer: 'feld-' + name }),
    eingabe,
    h('div', { class: 'feld-fehler', id: 'fehler-' + name }));
}

function abschnittMitarbeiter(app) {
  const z = app.zustand;
  const fo = z.formular;
  return h('div', { class: 'feld', id: 'abschnitt-mitarbeiter' },
    feldTitel(fo.modus === 'neu' ? 'Wer nimmt die Bestellung auf?' : 'Wer ändert die Bestellung?', { pflicht: true }),
    namensGitter(z.konfig.mitarbeiter, fo.felder.mitarbeiter, (n) => {
      fo.felder.mitarbeiter = n;
      fo.beruehrt.mitarbeiter = true;
      entwurfSichern(fo);
      abschnittNeu(app, 'mitarbeiter');
    }),
    h('div', { class: 'feld-fehler', id: 'fehler-mitarbeiter' }));
}

const ABSCHNITTE = { markt: abschnittMarkt, datum: abschnittDatum, mitarbeiter: abschnittMitarbeiter };

/** Einen Abschnitt neu aufbauen, ohne das restliche Formular (und die Tastatur) anzufassen. */
function abschnittNeu(app, name) {
  const alt = document.getElementById('abschnitt-' + name);
  if (!alt) return;
  alt.replaceWith(ABSCHNITTE[name](app));
  feldStatus(app, name);
  if (app.zustand.formular.versucht) meldungAktualisieren(app);
}

/** Fehlertext und ✓-Marke eines Felds aktualisieren. */
function feldStatus(app, name) {
  const fo = app.zustand.formular;
  if (!fo) return;
  const el = document.getElementById('abschnitt-' + name);
  const fehlerEl = document.getElementById('fehler-' + name);
  if (!el || !fehlerEl) return;
  const fehler = pruefen(app)[name];
  const zeigen = fehler && (fo.versucht || fo.beruehrt[name]) ? fehler : '';
  el.classList.toggle('fehlerhaft', !!zeigen);
  el.classList.toggle('ok', !fehler && !!String(fo.felder[name] || '').trim());
  fehlerEl.textContent = zeigen;
}

function meldungElement(fo) {
  if (!fo.meldung) return null;
  return h('div', { class: 'meldung ' + fo.meldung.art, role: 'alert' }, fo.meldung.text);
}

function meldungAktualisieren(app) {
  const fo = app.zustand.formular;
  // Hinweis „rot markierte Felder" verschwindet, sobald alles stimmt.
  if (fo.meldung && fo.meldung.pruefung && !Object.keys(pruefen(app)).length) fo.meldung = null;
  const ziel = document.getElementById('formular-meldung');
  if (ziel) ziel.replaceChildren(...[meldungElement(fo)].filter(Boolean));
}

function speichernInhalt(fo) {
  if (fo.sendet) return [h('span', { class: 'dreher', 'aria-hidden': 'true' }), ' Wird gespeichert …'];
  if (fo.fehlgeschlagen) return '↻ Erneut senden';
  return fo.modus === 'neu' ? 'Bestellung speichern' : 'Änderungen speichern';
}

function speichernKnopfAktualisieren(fo) {
  const k = document.getElementById('speichern-knopf');
  if (!k) return;
  k.disabled = fo.sendet;
  k.replaceChildren(...[].concat(speichernInhalt(fo)).map((x) => (typeof x === 'string' ? document.createTextNode(x) : x)));
}

function unveraendert(fo) {
  const o = fo.original;
  const f = fo.felder;
  return o && ['markt', 'datum', 'kunde', 'bestellung', 'kontakt', 'kommentar']
    .every((n) => String(f[n] || '').trim() === String(o[n] || '').trim());
}

async function speichern(app) {
  const z = app.zustand;
  const fo = z.formular;
  if (fo.sendet) return; // Schutz gegen Doppel-Tippen

  if (fo.modus === 'bearbeiten' && unveraendert(fo)) {
    loeschen(ENTWURF);
    app.zurueck();
    toast('Keine Änderungen – nichts gespeichert.');
    return;
  }

  const fehler = pruefen(app);
  if (Object.keys(fehler).length) {
    fo.versucht = true;
    fo.meldung = { art: 'fehler', text: 'Bitte die rot markierten Angaben ergänzen.', pruefung: true };
    PFLICHTFELDER.concat(['kontakt', 'kommentar']).forEach((n) => feldStatus(app, n));
    meldungAktualisieren(app);
    vibrieren([60, 40, 60]);
    const erstes = document.querySelector('.feld.fehlerhaft');
    if (erstes) erstes.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  fo.sendet = true;
  fo.meldung = null;
  speichernKnopfAktualisieren(fo);
  meldungAktualisieren(app);

  const daten = { ...fo.felder, tablet: app.tabletName(), geraet: geraeteId() };
  try {
    if (fo.modus === 'neu') {
      const b = await app.speichernNeu(daten);
      loeschen(ENTWURF);
      z.formular = null;
      app.navigieren('bestaetigung', { bestaetigung: b }, { ersetzen: true });
    } else {
      await app.speichernAenderung(daten);
      loeschen(ENTWURF);
      z.formular = null;
      app.zurueck();
      toast('✓ Änderungen gespeichert.', { art: 'erfolg' });
    }
  } catch (e) {
    fo.sendet = false;
    fo.fehlgeschlagen = e instanceof Verbindungsfehler;
    fo.meldung = {
      art: 'fehler',
      text: e instanceof Verbindungsfehler
        ? '❌ Nicht gespeichert – ' + e.message + ' Deine Eingaben sind noch da. Bitte Verbindung prüfen und „Erneut senden" tippen.'
        : '❌ Nicht gespeichert: ' + e.message,
    };
    speichernKnopfAktualisieren(fo);
    meldungAktualisieren(app);
    vibrieren([60, 40, 60]);
    const ziel = document.getElementById('formular-meldung');
    if (ziel) ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function entwurfVerwerfen(app) {
  const z = app.zustand;
  loeschen(ENTWURF);
  z.formular = z.formular.modus === 'neu' ? formularNeuStarten(app) : formularBearbeitenStarten(app, z.formular.original);
  app.render();
  toast('Entwurf verworfen.');
}
