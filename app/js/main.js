// Steuerzentrale: Zustand, Navigation (inkl. Android-Zurück-Taste), Aktualisierung, Aktionen.

import { lesen, schreiben, loeschen, dauerhaftAnfordern, geraeteId } from './speicher.js';
import { heuteIso, heuteSimulieren, uhrzeit } from './datum.js';
import { datenquelleErstellen, einrichtungAusLink, neuVerbunden } from './daten/index.js';
import { demoEinstellungen } from './daten/demo.js';
import { mitZeitlimit, Verbindungsfehler, Zugangsfehler } from './daten/fehler.js';
import { Warteschlange } from './warteschlange.js';
import { ansichtGleich, ansichtName } from './logik.js';
import { h, toast, vibrieren } from './ui.js';
import { scharfInhalt } from './komponenten.js';
import { listeZeichnen } from './ansichten/liste.js';
import { formularZeichnen, formularNeuStarten } from './ansichten/formular.js';
import { detailZeichnen } from './ansichten/detail.js';
import { bestaetigungZeichnen } from './ansichten/bestaetigung.js';
import { einstellungenZeichnen } from './ansichten/einstellungen.js';
import { einrichtungZeichnen } from './ansichten/einrichtung.js';
import { overlayZeichnen } from './ansichten/overlays.js';
import { linkEinfuegen } from './ansichten/link-einfuegen.js';

const AKTUALISIEREN_MS = 3 * 60 * 1000; // Daten automatisch alle 3 Minuten holen
const RUECKGAENGIG_MS = 6000;           // so lange gibt es die „Rückgängig"-Einblendung
const SCHARF_MS = 4000;                 // so lange wartet „Nochmal tippen = abgeholt"
const ZEITLIMIT_MS = 25000;             // danach gilt eine Anfrage als gescheitert

// Einrichtungs-Link (…/#api=…&k=…) zuerst auswerten – er legt fest, ob echte Daten oder Prototyp.
einrichtungAusLink();
const neuEingerichtet = neuVerbunden();   // auch nach eingefügtem Link (Seite wurde neu geladen)
const dq = datenquelleErstellen();
if (dq.istDemo) heuteSimulieren(demoEinstellungen().tag);

const zustand = {
  konfig: null,
  bestellungen: [],
  stand: null,       // Zeitpunkt der letzten erfolgreichen Aktualisierung
  laedt: false,
  fehler: null,      // Text, wenn die letzte Aktualisierung fehlschlug
  standard: lesen('standard'),
  ansicht: null,
  zeitraum: 'tag',
  tag: heuteIso(),
  heute: heuteIso(),
  sucheOffen: false,
  suche: '',
  erledigtZeigen: false,
  bildschirm: 'liste',
  detailId: null,
  detailStorno: null,
  formular: null,
  bestaetigung: null,
  overlay: null,
  listenScroll: 0,
  nachOben: false,
  einrichtungHinweis: null,
  bereit: false,     // erst zeichnen, wenn Konfiguration und Ansicht feststehen
  tablet: null,      // { name } – vom Server, nur im echten Betrieb
  gesperrt: false,   // Schlüssel ungültig / Tablet in der Tabelle gesperrt
};

const app = { zustand, istDemo: !!dq.istDemo };

app.warteschlange = new Warteschlange(dq, {
  beiErfolg: (b) => { if (b) einpflegen(b); },
  beiAblehnung: (eintrag, fehler) => {
    toast('⚠ Nicht übernommen: ' + fehler.message, { dauer: 8000 });
    app.aktualisieren();
  },
  beiAenderung: () => app.statusZeichnen(),
});

// ---------- Daten ----------

function einpflegen(b) {
  const i = zustand.bestellungen.findIndex((x) => x.id === b.id);
  if (i >= 0) zustand.bestellungen[i] = b; else zustand.bestellungen.push(b);
  standSichern();
  anzeigeAktualisieren();
}

function standSichern() {
  // Letzter bekannter Stand: Die App startet damit sofort, auch ohne Netz.
  schreiben('letzter_stand', { konfig: zustand.konfig, bestellungen: zustand.bestellungen, stand: zustand.stand });
}

/** Bestellungen, wie sie angezeigt werden: Server-Stand + noch nicht gesendete Änderungen. */
app.bestellungen = function () {
  const wartend = app.warteschlange.eintraegeJeBestellung();
  const heute = heuteIso();
  return zustand.bestellungen
    .filter((b) => b.datum >= heute)
    .map((b) => {
      const liste = wartend.get(b.id);
      if (!liste) return b;
      // Wartende Änderungen der Reihe nach auf den Server-Stand anwenden – so stimmt auch
      // „Storno aufheben → Abgeholt", wenn das Aufheben noch nicht beim Server ist.
      let status = b.status;
      let zeit = b.abgeholtAm;
      for (const e of liste) {
        if (status === 'storniert' && e.status === 'abgeholt') continue; // Storniertes nicht abholen
        status = e.status;
        zeit = e.zeit;
      }
      return {
        ...b,
        status,
        abgeholtAm: status === 'abgeholt' ? zeit : '',
        storniertVon: status === 'storniert' ? b.storniertVon : '',
        storniertAm: status === 'storniert' ? b.storniertAm : '',
        wartet: true,
      };
    });
};

app.bestellungFinden = (id) => app.bestellungen().find((b) => b.id === id) || null;

app.aktualisieren = async function () {
  if (zustand.laedt) return;
  zustand.laedt = true;
  app.statusZeichnen();
  try {
    const r = await mitZeitlimit(dq.laden(), ZEITLIMIT_MS);
    zustand.konfig = r.konfig;
    zustand.bestellungen = r.bestellungen;
    zustand.stand = new Date().toISOString();
    zustand.fehler = null;
    zustand.gesperrt = false;
    if (r.tablet) zustand.tablet = r.tablet;
    standSichern();
    // Server erreichbar → hängende Änderungen sofort senden, nicht erst nach der Wartezeit.
    if (app.warteschlange.hatFehler()) app.warteschlange.wiederholen();
  } catch (e) {
    zustand.fehler = e.message || 'Unbekannter Fehler';
    zustand.gesperrt = e instanceof Zugangsfehler;
  } finally {
    zustand.laedt = false;
  }
  anzeigeAktualisieren();
};

/** Nach neuen Daten: Liste/Detail neu zeichnen, Formulare nie (Tastatur und Eingaben bleiben). */
function anzeigeAktualisieren() {
  if (zustand.konfig && ['liste', 'detail', 'einstellungen'].includes(zustand.bildschirm)) {
    const tippt = document.activeElement && ['suchfeld', 'linkfeld'].includes(document.activeElement.id);
    if (!tippt) render();
  }
  app.statusZeichnen();
}

// ---------- Verbindungsstatus oben rechts ----------

function statusInfo() {
  const n = app.warteschlange.anzahl();
  const stand = zustand.stand ? uhrzeit(zustand.stand) : '';
  if (zustand.laedt) return { klasse: 'laedt', text: 'Aktualisiere …' };
  if (zustand.gesperrt) return { klasse: 'fehler', text: 'Tablet gesperrt' };
  if (zustand.fehler || app.warteschlange.hatFehler()) {
    return { klasse: 'fehler', text: 'Keine Verbindung' + (n ? ' · ' + n + ' wartet' : '') };
  }
  if (n) return { klasse: 'wartet', text: 'Wird gesendet …' };
  // Auf dem Handy entfällt „Aktuell ·" (zu schmal) – grüner Punkt + Uhrzeit bleiben.
  return stand ? { klasse: 'ok', vorsatz: 'Aktuell · ', text: stand } : { klasse: 'ok', text: 'Verbunden' };
}

app.statusZeichnen = function () {
  const s = statusInfo();
  document.querySelectorAll('.sync').forEach((el) => {
    el.className = 'sync ' + s.klasse;
    el.replaceChildren(...(s.vorsatz ? [h('span', { class: 'sync-vorsatz' }, s.vorsatz)] : []), s.text);
  });
};

// ---------- Ansicht (Fahrzeug / Markt / Alle) ----------

function ansichtLaden() {
  const t = lesen('ansicht_temp');
  // Vorübergehende Ansicht gilt nur bis zum Tagesende.
  if (t && t.datum === heuteIso() && t.ansicht) return t.ansicht;
  loeschen('ansicht_temp');
  return zustand.standard;
}

app.istVoruebergehend = () => !!zustand.standard && !!zustand.ansicht && !ansichtGleich(zustand.standard, zustand.ansicht);

app.ansichtSetzen = function (a) {
  zustand.ansicht = a;
  zustand.nachOben = true;
  if (ansichtGleich(a, zustand.standard)) loeschen('ansicht_temp');
  else schreiben('ansicht_temp', { ansicht: a, datum: heuteIso() });
};

app.standardSetzen = function (a) {
  zustand.standard = a;
  schreiben('standard', a);
  app.ansichtSetzen(a);
};

app.tabletName = () => (zustand.tablet ? zustand.tablet.name
  : !zustand.standard ? '' : zustand.standard.typ === 'alle' ? 'Firma' : zustand.standard.wert);

app.einrichtungAbschliessen = function (a) {
  app.standardSetzen(a);
  zustand.einrichtungHinweis = null;
  zustand.bildschirm = 'liste';
  history.replaceState({ b: 'liste' }, '');
  render();
  toast('Eingerichtet: Dieses Tablet zeigt ' + ansichtName(a) + '.');
};

// ---------- Zeitraum ----------

app.tagSetzen = function (t) {
  zustand.tag = t;
  zustand.nachOben = true;
  if (zustand.bildschirm === 'liste') render();
};

app.zeitraumSetzen = function (z) {
  zustand.zeitraum = z;
  zustand.nachOben = true;
  if (zustand.bildschirm === 'liste') render();
};

app.heuteNeuSetzen = function (tag) {
  heuteSimulieren(tag);
  zustand.heute = heuteIso();
  zustand.tag = zustand.heute;
  zustand.zeitraum = 'tag';
  zustand.ansicht = ansichtLaden();
};

function tagwechselPruefen() {
  const heute = heuteIso();
  if (heute === zustand.heute) return;
  // Neuer Tag: zurück auf Heute und auf die Standard-Ansicht des Tablets.
  zustand.heute = heute;
  zustand.tag = heute;
  zustand.zeitraum = 'tag';
  loeschen('ansicht_temp');
  zustand.ansicht = zustand.standard;
  app.aktualisieren();
}

// ---------- Suche ----------

app.sucheOeffnen = function () {
  zustand.sucheOffen = true;
  render();
  const feld = document.getElementById('suchfeld');
  if (feld) feld.focus();
};

app.sucheSchliessen = function () {
  zustand.sucheOffen = false;
  zustand.suche = '';
  render();
};

// ---------- Abholen (zwei Tipps) und Rückgängig ----------
// Erster Tipp: Knopf wird scharf. Zweiter Tipp: Status ändert sich sofort und geht nach
// RUECKGAENGIG_MS über die Warteschlange raus.

const zusatzDaten = () => ({ tablet: app.tabletName(), geraet: geraeteId() });

// Zwei-Tipp-Knöpfe („Als abgeholt markieren", „Rückgängig" auf dem Zettel) tragen einen
// Schlüssel wie 'abholen:B-…' bzw. 'zurueck:B-…' in data-scharf.
let scharf = null;      // { schluessel, bis }
let scharfTimer = null;

app.istScharf = (schluessel) => !!scharf && scharf.schluessel === schluessel && scharf.bis > Date.now();

function scharfeKnoepfeAktualisieren() {
  document.querySelectorAll('[data-scharf]').forEach((k) => scharfInhalt(k, app.istScharf(k.dataset.scharf)));
}

app.scharfSchalten = function (schluessel) {
  scharf = { schluessel, bis: Date.now() + SCHARF_MS };
  vibrieren(25);
  scharfeKnoepfeAktualisieren();
  clearTimeout(scharfTimer);
  scharfTimer = setTimeout(() => { scharf = null; scharfeKnoepfeAktualisieren(); }, SCHARF_MS);
};

function scharfLoesen() {
  scharf = null;
  clearTimeout(scharfTimer);
}

app.abholen = function (id) {
  const b = app.bestellungFinden(id);
  scharfLoesen();
  if (!b || b.status !== 'offen') return;
  vibrieren([30, 50, 30]);
  app.warteschlange.hinzufuegen(id, 'abgeholt', RUECKGAENGIG_MS, zusatzDaten());
  render();
  toast('✓ Abgeholt: ' + b.kunde, {
    dauer: RUECKGAENGIG_MS,
    art: 'erfolg',
    aktion: { text: 'Rückgängig', fn: () => app.rueckgaengig(id) },
  });
};

/** Abgeholt oder Storniert zurücknehmen → wieder „offen". */
app.rueckgaengig = function (id) {
  const b = app.bestellungFinden(id);
  scharfLoesen();
  if (!b || b.status === 'offen') return;
  const war = b.status;
  // Noch nicht gesendet → einfach zurücknehmen, sonst Gegen-Änderung schicken.
  const e = app.warteschlange.ueberlagerung().get(id);
  if (!(e && e.status === war && app.warteschlange.zuruecknehmen(e.nr))) {
    app.warteschlange.hinzufuegen(id, 'offen', 0, zusatzDaten());
  }
  vibrieren(25);
  render();
  toast((war === 'storniert' ? 'Storno aufgehoben – ' : 'Rückgängig – ') + b.kunde + ' ist wieder offen.');
};

// ---------- Speichern (wartet auf den Server – mit klarer Meldung bei Fehlern) ----------

/** Anfrage mit Zeitlimit; Verbindungsprobleme zeigt auch die Statusanzeige oben an. */
/** Hinweis vom Server, z. B. wenn nur der Kalendertermin nicht angepasst werden konnte. */
function warnungZeigen(r) {
  if (r && r.warnung) toast('⚠ ' + r.warnung, { dauer: 9000 });
}

async function senden(versprechen) {
  try {
    const r = await mitZeitlimit(versprechen, ZEITLIMIT_MS);
    if (zustand.fehler) { zustand.fehler = null; app.statusZeichnen(); }
    return r;
  } catch (e) {
    if (e instanceof Verbindungsfehler) {
      zustand.fehler = e.message;
      zustand.gesperrt = e instanceof Zugangsfehler;
      app.statusZeichnen();
    }
    throw e;
  }
}

app.speichernNeu = async function (daten) {
  const r = await senden(dq.neu(daten));
  einpflegen(r.bestellung);
  warnungZeigen(r);
  return r.bestellung;
};

app.speichernAenderung = async function (daten) {
  const r = await senden(dq.aendern(daten));
  einpflegen(r.bestellung);
  warnungZeigen(r);
  return r.bestellung;
};

app.stornieren = async function (id, mitarbeiter) {
  const r = await senden(dq.stornieren({ id, mitarbeiter, tablet: app.tabletName(), geraet: geraeteId() }));
  einpflegen(r.bestellung);
  warnungZeigen(r);
  return r.bestellung;
};

app.pinPruefen = (pin) => senden(dq.pinPruefen(pin));

// ---------- Navigation ----------
// Jeder Bildschirm und jede Einblendung bekommt einen Eintrag in der Browser-Historie,
// damit die Android-Zurück-Taste genau eine Ebene zurück geht.

app.navigieren = function (bildschirm, daten = {}, { ersetzen = false } = {}) {
  if (zustand.bildschirm === 'liste') zustand.listenScroll = window.scrollY;
  Object.assign(zustand, daten);
  zustand.bildschirm = bildschirm;
  zustand.overlay = null;
  const st = { b: bildschirm };
  if (bildschirm === 'detail') st.id = zustand.detailId;
  if (ersetzen) history.replaceState(st, ''); else history.pushState(st, '');
  render();
};

app.zurueck = () => history.back();

app.neueBestellung = function () {
  app.navigieren('formular', { formular: formularNeuStarten(app) });
};

app.overlayOeffnen = function (name, daten = {}, { ersetzen = false } = {}) {
  zustand.overlay = { name, ...daten };
  const st = { ...(history.state || { b: zustand.bildschirm }), o: name };
  if (ersetzen) history.replaceState(st, ''); else history.pushState(st, '');
  overlayZeichnen_();
};

app.overlaySchliessen = () => history.back();
app.overlayNeuZeichnen = () => overlayZeichnen_();

window.addEventListener('popstate', (e) => {
  const st = e.state || { b: 'liste' };
  let b = st.b || 'liste';
  if (b === 'formular' && !zustand.formular) b = 'liste';
  if (b === 'bestaetigung' && !zustand.bestaetigung) b = 'liste';
  if (b === 'detail' && st.id) zustand.detailId = st.id;
  if (!zustand.standard) b = 'einrichtung';
  if (zustand.bildschirm === 'liste' && b !== 'liste') zustand.listenScroll = window.scrollY;
  if (b !== 'detail') zustand.detailStorno = null;
  zustand.bildschirm = b;
  zustand.overlay = st.o && zustand.overlay && zustand.overlay.name === st.o ? zustand.overlay : null;
  render();
});

// ---------- Zeichnen ----------

const BILDSCHIRME = {
  liste: listeZeichnen,
  formular: formularZeichnen,
  detail: detailZeichnen,
  bestaetigung: bestaetigungZeichnen,
  einstellungen: einstellungenZeichnen,
  einrichtung: einrichtungZeichnen,
};

function render() {
  const wurzel = document.getElementById('app');
  if (!zustand.konfig || !zustand.bereit) return;
  const gleicherBildschirm = wurzel.dataset.bildschirm === zustand.bildschirm;
  const scroll = window.scrollY;
  wurzel.replaceChildren((BILDSCHIRME[zustand.bildschirm] || listeZeichnen)(app));
  wurzel.dataset.bildschirm = zustand.bildschirm;
  if (zustand.nachOben) window.scrollTo(0, 0);
  else if (gleicherBildschirm) window.scrollTo(0, scroll);
  else window.scrollTo(0, zustand.bildschirm === 'liste' ? zustand.listenScroll : 0);
  zustand.nachOben = false;
  overlayZeichnen_();
  app.statusZeichnen();
}
app.render = render;

function overlayZeichnen_() {
  const box = document.getElementById('overlay');
  if (!zustand.overlay || !zustand.konfig) {
    box.hidden = true;
    box.replaceChildren();
    document.body.classList.remove('overlay-offen');
    return;
  }
  box.replaceChildren(overlayZeichnen(app));
  box.hidden = false;
  document.body.classList.add('overlay-offen');
}

function startFehlerZeigen() {
  const wurzel = document.getElementById('app');
  const erneut = h('button', { type: 'button', class: 'knopf primaer', onclick: () => location.reload() }, '↻ Erneut versuchen');
  // Gesperrt (oder neuer Schlüssel in der Tabelle): Hier muss ein neuer Link hinein können –
  // sonst säße z. B. die iPhone-Home-Bildschirm-App fest.
  if (zustand.gesperrt) {
    wurzel.replaceChildren(h('div', { class: 'leer start-fehler' },
      h('div', { class: 'leer-titel' }, '⚠ Dieses Tablet ist gesperrt'),
      h('p', { class: 'leer-text' },
        'In der Tabelle (Blatt „Tablets") ist es gesperrt oder hat einen neuen Schlüssel bekommen. ' +
        'Bitte den aktuellen Einrichtungs-Link öffnen oder hier einfügen.'),
      linkEinfuegen(),
      erneut));
    return;
  }
  wurzel.replaceChildren(h('div', { class: 'leer start-fehler' },
    h('div', { class: 'leer-titel' }, '⚠ Bestellungen konnten nicht geladen werden'),
    h('p', { class: 'leer-text' }, (zustand.fehler || 'Keine Verbindung.') + ' Bitte Internet prüfen und erneut versuchen.'),
    erneut));
}

// ---------- Start ----------

async function start() {
  dauerhaftAnfordern();
  zustand.ansicht = ansichtLaden();
  history.replaceState({ b: 'liste' }, '');

  // Sofort mit dem letzten bekannten Stand starten, dann frisch laden.
  const letzter = lesen('letzter_stand');
  if (letzter && letzter.konfig) {
    zustand.konfig = letzter.konfig;
    zustand.bestellungen = letzter.bestellungen || [];
    zustand.stand = letzter.stand;
    bildschirmBeimStart();
    render();
  }
  await app.aktualisieren();
  if (!zustand.konfig) { startFehlerZeigen(); return; }
  if (neuEingerichtet) {
    toast('✓ Verbunden mit der Google-Tabelle' + (zustand.tablet ? ' · Tablet „' + zustand.tablet.name + '"' : '') + '.', { dauer: 7000 });
  }
  if (!letzter || !letzter.konfig) { bildschirmBeimStart(); render(); }

  app.warteschlange.planen();
  setInterval(() => { if (document.visibilityState === 'visible') app.aktualisieren(); }, AKTUALISIEREN_MS);
  setInterval(tagwechselPruefen, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    tagwechselPruefen();
    if (!zustand.stand || Date.now() - new Date(zustand.stand).getTime() > 60000) app.aktualisieren();
    app.warteschlange.planen();
  });
  window.addEventListener('online', () => { app.warteschlange.wiederholen(); app.aktualisieren(); });
  serviceWorkerAnmelden();
}

function bildschirmBeimStart() {
  zustand.bereit = true;
  const s = zustand.standard;
  const gueltig = s && (s.typ === 'alle' || (s.typ === 'fahrzeug' && zustand.konfig.fahrzeuge.includes(s.wert)));
  if (!gueltig) {
    if (s) zustand.einrichtungHinweis = 'Das bisher eingestellte Fahrzeug „' + s.wert + '" gibt es in der Tabelle nicht mehr. Bitte neu wählen.';
    zustand.standard = null;
    zustand.bildschirm = 'einrichtung';
    return;
  }
  const a = zustand.ansicht;
  const ansichtGueltig = a && (a.typ === 'alle' ||
    (a.typ === 'fahrzeug' && zustand.konfig.fahrzeuge.includes(a.wert)) ||
    (a.typ === 'markt' && zustand.konfig.maerkte.some((m) => m.name === a.wert)));
  if (!ansichtGueltig) zustand.ansicht = s;
  zustand.bildschirm = 'liste';
}

function serviceWorkerAnmelden() {
  if (!('serviceWorker' in navigator)) return;
  const lokal = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
  if (lokal) return; // Bei der Entwicklung immer frische Dateien
  const hatteVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => { /* App läuft auch ohne */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteVersion) return;
    // Neue Version ist installiert. Auf der Übersicht sofort neu laden, sonst anbieten.
    if (zustand.bildschirm === 'liste' && !zustand.overlay) location.reload();
    else toast('Neue Version installiert.', { dauer: 15000, aktion: { text: 'Neu laden', fn: () => location.reload() } });
  });
}

start();
