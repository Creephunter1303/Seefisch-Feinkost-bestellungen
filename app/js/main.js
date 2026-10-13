// Steuerzentrale: Zustand, Navigation (inkl. Android-Zurück-Taste), Aktualisierung, Aktionen.

import { lesen, schreiben, loeschen, dauerhaftAnfordern, geraeteId } from './speicher.js';
import { heuteIso, heuteSimulieren, uhrzeit } from './datum.js';
import { datenquelleErstellen } from './daten/index.js';
import { demoEinstellungen } from './daten/demo.js';
import { mitZeitlimit, Verbindungsfehler } from './daten/fehler.js';
import { Warteschlange } from './warteschlange.js';
import { ansichtGleich, ansichtName } from './logik.js';
import { toast, vibrieren } from './ui.js';
import { abholenKnopfInhalt } from './komponenten.js';
import { listeZeichnen } from './ansichten/liste.js';
import { formularZeichnen, formularNeuStarten } from './ansichten/formular.js';
import { detailZeichnen } from './ansichten/detail.js';
import { bestaetigungZeichnen } from './ansichten/bestaetigung.js';
import { einstellungenZeichnen } from './ansichten/einstellungen.js';
import { einrichtungZeichnen } from './ansichten/einrichtung.js';
import { overlayZeichnen } from './ansichten/overlays.js';

const AKTUALISIEREN_MS = 3 * 60 * 1000; // Daten automatisch alle 3 Minuten holen
const RUECKGAENGIG_MS = 6000;           // so lange gibt es „Rückgängig" nach „Abgeholt"
const SCHARF_MS = 4000;                 // so lange wartet „Nochmal tippen = abgeholt"
const ZEITLIMIT_MS = 25000;             // danach gilt eine Anfrage als gescheitert

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
  scharf: null,
  einrichtungHinweis: null,
  bereit: false,     // erst zeichnen, wenn Konfiguration und Ansicht feststehen
};

const app = { zustand, istDemo: !!dq.istDemo };

app.warteschlange = new Warteschlange(dq, {
  beiErfolg: (b) => { if (b) einpflegen(b); },
  beiAblehnung: (eintrag, fehler) => {
    toast('⚠ Nicht übernommen: ' + fehler.message, { art: 'fehler', dauer: 8000 });
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
  const ueber = app.warteschlange.ueberlagerung();
  const heute = heuteIso();
  return zustand.bestellungen
    .filter((b) => b.datum >= heute)
    .map((b) => {
      const e = ueber.get(b.id);
      if (!e || b.status === 'storniert') return b;
      return { ...b, status: e.status, abgeholtAm: e.status === 'abgeholt' ? e.zeit : '', wartet: true };
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
    standSichern();
  } catch (e) {
    zustand.fehler = e.message || 'Unbekannter Fehler';
  } finally {
    zustand.laedt = false;
  }
  anzeigeAktualisieren();
};

/** Nach neuen Daten: Liste/Detail neu zeichnen, Formulare nie (Tastatur und Eingaben bleiben). */
function anzeigeAktualisieren() {
  if (zustand.konfig && ['liste', 'detail', 'einstellungen'].includes(zustand.bildschirm)) {
    const sucheAktiv = document.activeElement && document.activeElement.id === 'suchfeld';
    if (!sucheAktiv) render();
  }
  app.statusZeichnen();
}

// ---------- Verbindungsstatus oben rechts ----------

function statusInfo() {
  const n = app.warteschlange.anzahl();
  const stand = zustand.stand ? uhrzeit(zustand.stand) : '';
  if (zustand.laedt) return { klasse: 'laedt', text: '⟳ Aktualisiere …' };
  if (zustand.fehler || app.warteschlange.hatFehler()) {
    return { klasse: 'fehler', text: '⚠ Keine Verbindung' + (n ? ' · ' + n + ' wartet' : '') };
  }
  if (n) return { klasse: 'wartet', text: '⏳ Wird gesendet …' };
  return { klasse: 'ok', text: stand ? '● Aktuell · ' + stand : '● Verbunden' };
}

app.statusZeichnen = function () {
  const s = statusInfo();
  document.querySelectorAll('.status-pill').forEach((el) => {
    el.className = 'status-pill ' + s.klasse;
    el.textContent = s.text;
    el.title = 'Tippen zum Aktualisieren';
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

app.tabletName = () => (!zustand.standard ? '' : zustand.standard.typ === 'alle' ? 'Firma' : zustand.standard.wert);

app.einrichtungAbschliessen = function (a) {
  app.standardSetzen(a);
  zustand.einrichtungHinweis = null;
  zustand.bildschirm = 'liste';
  history.replaceState({ b: 'liste' }, '');
  render();
  toast('Eingerichtet: Dieses Tablet zeigt ' + ansichtName(a) + '.', { art: 'erfolg' });
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
  const h = heuteIso();
  if (h === zustand.heute) return;
  // Neuer Tag: zurück auf Heute und auf die Standard-Ansicht des Tablets.
  zustand.heute = h;
  zustand.tag = h;
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

// ---------- Abholen (zwei Tipps + Rückgängig) ----------

let scharfTimer = null;

app.istScharf = (id) => !!zustand.scharf && zustand.scharf.id === id && zustand.scharf.bis > Date.now();

function abholKnoepfeAktualisieren() {
  document.querySelectorAll('.abholen-knopf').forEach((k) => abholenKnopfInhalt(k, app.istScharf(k.dataset.id)));
}

app.scharfSchalten = function (id) {
  zustand.scharf = { id, bis: Date.now() + SCHARF_MS };
  vibrieren(25);
  abholKnoepfeAktualisieren();
  clearTimeout(scharfTimer);
  scharfTimer = setTimeout(() => { zustand.scharf = null; abholKnoepfeAktualisieren(); }, SCHARF_MS);
};

function statusAendern(id, status, meldung, gegenteil) {
  const b = app.bestellungFinden(id);
  if (!b) return;
  zustand.scharf = null;
  const zusatz = { tablet: app.tabletName(), geraet: geraeteId() };
  const nr = app.warteschlange.hinzufuegen(id, status, RUECKGAENGIG_MS, zusatz);
  render();
  toast(meldung + b.kunde, {
    dauer: RUECKGAENGIG_MS,
    art: status === 'abgeholt' ? 'erfolg' : '',
    aktion: {
      text: 'Rückgängig',
      fn: () => {
        // Noch nicht gesendet → einfach zurücknehmen, sonst Gegen-Änderung schicken.
        if (!app.warteschlange.zuruecknehmen(nr)) app.warteschlange.hinzufuegen(id, gegenteil, 0, zusatz);
        render();
        toast('Rückgängig gemacht – ' + b.kunde + ' ist wieder „' + (gegenteil === 'offen' ? 'Offen' : 'Abgeholt') + '".');
      },
    },
  });
}

app.abholen = function (id) {
  clearTimeout(scharfTimer);
  vibrieren([30, 50, 30]);
  statusAendern(id, 'abgeholt', '✓ Abgeholt: ', 'offen');
};

app.wiederOffen = function (id) {
  statusAendern(id, 'offen', 'Wieder offen: ', 'abgeholt');
};

// ---------- Speichern (wartet auf den Server – mit klarer Meldung bei Fehlern) ----------

/** Anfrage mit Zeitlimit; Verbindungsprobleme zeigt auch die Statusanzeige oben an. */
async function senden(versprechen) {
  try {
    const r = await mitZeitlimit(versprechen, ZEITLIMIT_MS);
    if (zustand.fehler) { zustand.fehler = null; app.statusZeichnen(); }
    return r;
  } catch (e) {
    if (e instanceof Verbindungsfehler) { zustand.fehler = e.message; app.statusZeichnen(); }
    throw e;
  }
}

app.speichernNeu = async function (daten) {
  const r = await senden(dq.neu(daten));
  einpflegen(r.bestellung);
  return r.bestellung;
};

app.speichernAenderung = async function (daten) {
  const r = await senden(dq.aendern(daten));
  einpflegen(r.bestellung);
  return r.bestellung;
};

app.stornieren = async function (id, mitarbeiter) {
  const r = await senden(dq.stornieren({ id, mitarbeiter, tablet: app.tabletName(), geraet: geraeteId() }));
  einpflegen(r.bestellung);
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
  const knopf = document.createElement('button');
  knopf.className = 'knopf primaer';
  knopf.textContent = '↻ Erneut versuchen';
  knopf.addEventListener('click', () => location.reload());
  const box = document.createElement('div');
  box.className = 'leer start-fehler';
  const titel = document.createElement('div');
  titel.className = 'leer-titel';
  titel.textContent = '⚠ Bestellungen konnten nicht geladen werden';
  const text = document.createElement('p');
  text.className = 'leer-text';
  text.textContent = (zustand.fehler || 'Keine Verbindung.') + ' Bitte Internet prüfen und erneut versuchen.';
  box.append(titel, text, knopf);
  wurzel.replaceChildren(box);
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
