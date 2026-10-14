/**
 * Seefisch-Feinkost · Bestell-App 2.0 – Backend
 * =============================================
 * Google Apps Script, direkt an die Tabelle „Fisch-Bestellungen" gebunden
 * (Tabelle → Erweiterungen → Apps Script). Reine Daten-Schnittstelle (JSON) für die Tablet-App.
 * Anleitung: docs/backend-einrichten.md
 *
 * Sicherheit: Jede Anfrage braucht den Schlüssel eines Tablets aus dem Blatt „Tablets"
 * (Spalte „Aktiv" ≠ „Nein"). Schlüssel erzeugt das Skript selbst – sie stehen nie im Code.
 */

// ================== Aufbau der Tabelle ==================

const BLATT = {
  bestellungen: 'Bestellungen',
  konfig: 'Konfiguration',
  protokoll: 'Protokoll',
  einstellungen: 'Einstellungen',
  tablets: 'Tablets',
};

// Spalten im Blatt „Bestellungen" (1-basiert). A–Q wie in v3, R–T neu.
const SP = {
  ZEIT: 1, MITARBEITER: 2, MARKT: 3, DATUM: 4, KUNDE: 5, BESTELLUNG: 6, KONTAKT: 7, KOMMENTAR: 8,
  EVENT: 9, GERAET: 10, BROWSER: 11, ID: 12, STATUS: 13, GEAENDERT_AM: 14, GEAENDERT_VON: 15,
  STORNO_AM: 16, STORNO_VON: 17, ABGEHOLT_AM: 18, ABGEHOLT_UEBER: 19, ERFASST_UEBER: 20,
};

const KOPF_BESTELLUNGEN = [
  'Zeitstempel', 'Mitarbeiter', 'Markt', 'Datum', 'Kunde', 'Bestellung', 'Kontakt', 'Kommentar',
  'Kalender-Event-ID', 'Geräte-ID', 'Browser (User-Agent)', 'Bestell-ID', 'Status',
  'Zuletzt geändert am', 'Zuletzt geändert von', 'Storniert am', 'Storniert von',
  'Abgeholt am', 'Abgeholt über (Tablet)', 'Erfasst über (Tablet)',
];

const KOPF_PROTOKOLL = ['Zeitstempel', 'Bestell-ID', 'Aktion', 'Mitarbeiter', 'Details', 'Geräte-ID', 'Browser (User-Agent)', 'Tablet'];
const KOPF_TABLETS = ['Tablet', 'Schlüssel', 'Aktiv', 'Einrichtungs-Link (auf dem Tablet in Chrome öffnen)', 'Zuletzt gesehen', 'Notiz'];

const EINSTELLUNGEN_STANDARD = [
  ['Kalender-Spiegelung', 'Ja', 'Ja = jede Bestellung zusätzlich als ganztägiger Termin im Kalender. Nein = keine Termine.'],
  ['Kalender-Name', 'Bestellungen', 'Name des Google-Kalenders, in den die Termine kommen.'],
  ['Admin-PIN', '', '4 Ziffern, selbst eintragen. Nötig, um die Standard-Ansicht eines Tablets zu ändern.'],
  ['App-Adresse', 'https://creephunter1303.github.io/Seefisch-Feinkost-bestellungen/', 'Adresse der Tablet-App (nicht ändern).'],
  ['Web-App-Adresse', '', 'Nach dem Bereitstellen des Skripts hier die Adresse einfügen, die auf /exec endet.'],
];

const STATUS_TEXT = { offen: 'Offen', abgeholt: 'Abgeholt', storniert: 'Storniert' };
const WOCHENTAGE = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
const MAX_VORLAUF_TAGE = 70;              // die App bietet 62 Tage an, etwas Puffer
const MAX_LAENGE = { kunde: 100, bestellung: 1000, kontakt: 100, kommentar: 500 };

// ================== Menü in der Tabelle ==================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bestell-App')
    .addItem('Einrichten / prüfen', 'einrichten')
    .addItem('Neuen Schlüssel für markiertes Tablet', 'neuerSchluessel')
    .addToUi();
}

// ================== Web-Schnittstelle ==================

function doGet() {
  return json_({ ok: true, info: 'Seefisch Bestell-App: Die Schnittstelle läuft.' });
}

function doPost(e) {
  try {
    const anfrage = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(anfrageBearbeiten_(anfrage));
  } catch (err) {
    return json_({ ok: false, fehler: 'Fehler auf dem Server: ' + err.message });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function anfrageBearbeiten_(a) {
  const ss = tabelle_();
  const tablet = tabletPruefen_(ss, a.schluessel);
  if (!tablet) {
    return {
      ok: false,
      code: 'schluessel',
      fehler: 'Dieses Tablet ist nicht (mehr) freigeschaltet. Bitte den Einrichtungs-Link aus der Tabelle (Blatt „Tablets") neu öffnen.',
    };
  }
  try {
    switch (a.aktion) {
      case 'laden': return laden_(ss, tablet, a);
      case 'neu': return neu_(ss, tablet, a);
      case 'aendern': return aendern_(ss, tablet, a);
      case 'stornieren': return stornieren_(ss, tablet, a);
      case 'status': return statusSetzen_(ss, tablet, a);
      case 'pin': return pinPruefen_(ss, a);
      default: return { ok: false, fehler: 'Unbekannte Aktion: ' + a.aktion };
    }
  } catch (err) {
    if (err.ablehnung) return { ok: false, fehler: err.message };
    throw err;
  }
}

/** Fehler, den die App dem Mitarbeiter anzeigt (z. B. „Datum passt nicht zum Markt"). */
function abgelehnt_(text) {
  const e = new Error(text);
  e.ablehnung = true;
  return e;
}

// ================== Aktionen ==================

function laden_(ss, tablet, a) {
  const konfig = konfigLaden_(ss);
  const heute = heuteText_();
  const bestellungen = bestellungenLesen_(ss).filter((b) => b.datum >= heute);
  const stand = pruefsumme_(JSON.stringify([konfig, bestellungen]));
  const antwort = { ok: true, stand: stand, tablet: { name: tablet.name } };
  // Nichts geändert → nur kurze Antwort (spart Mobilfunk-Daten).
  if (a.stand && a.stand === stand) {
    antwort.unveraendert = true;
    return antwort;
  }
  antwort.konfig = konfig;
  antwort.bestellungen = bestellungen;
  return antwort;
}

function neu_(ss, tablet, a) {
  const id = String(a.id || '').trim();
  if (!/^B-[A-Z0-9]{8}$/.test(id)) throw abgelehnt_('Ungültige Bestell-Nummer – bitte die App neu laden.');
  const konfig = konfigLaden_(ss);
  const p = felderPruefen_(a, konfig);
  const blatt = blattPflicht_(ss, BLATT.bestellungen);

  let zeile;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const vorhanden = zeileFinden_(blatt, id);
    // Schon angekommen (App hat nach Zeitüberschreitung erneut gesendet) → nichts doppelt anlegen.
    if (vorhanden) return { ok: true, bestellung: zeileZuBestellung_(vorhanden.werte) };
    const jetzt = new Date();
    const neu = new Array(KOPF_BESTELLUNGEN.length).fill('');
    neu[SP.ZEIT - 1] = jetzt;
    neu[SP.MITARBEITER - 1] = p.mitarbeiter;
    neu[SP.MARKT - 1] = p.markt;
    neu[SP.DATUM - 1] = p.datum;
    neu[SP.KUNDE - 1] = p.kunde;
    neu[SP.BESTELLUNG - 1] = p.bestellung;
    neu[SP.KONTAKT - 1] = p.kontakt;
    neu[SP.KOMMENTAR - 1] = p.kommentar;
    neu[SP.GERAET - 1] = text_(a.geraet, 60);
    neu[SP.ID - 1] = id;
    neu[SP.STATUS - 1] = STATUS_TEXT.offen;
    neu[SP.ERFASST_UEBER - 1] = tablet.name;
    blatt.appendRow(neu);
    zeile = blatt.getLastRow();
  } finally {
    lock.releaseLock();
  }

  protokoll_(ss, id, 'Erstellt', p.mitarbeiter, kurz_(p.kunde, p.markt, p.datum), a.geraet, tablet.name);
  const warnung = kalenderAbgleichen_(ss, blatt, zeile);
  return { ok: true, bestellung: zeileLesen_(blatt, zeile), warnung: warnung };
}

function aendern_(ss, tablet, a) {
  const id = String(a.id || '').trim();
  const konfig = konfigLaden_(ss);
  const p = felderPruefen_(a, konfig);
  const blatt = blattPflicht_(ss, BLATT.bestellungen);

  let zeile, vorher;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = zeileFinden_(blatt, id);
    if (!t) throw abgelehnt_('Diese Bestellung wurde nicht gefunden. Bitte die Übersicht aktualisieren.');
    if (statusAusText_(t.werte[SP.STATUS - 1]) === 'storniert') {
      throw abgelehnt_('Diese Bestellung ist storniert und kann nicht mehr geändert werden.');
    }
    zeile = t.zeile;
    vorher = kurz_(t.werte[SP.KUNDE - 1], t.werte[SP.MARKT - 1], datumAusZelle_(t.werte[SP.DATUM - 1]));
    blatt.getRange(zeile, SP.MARKT, 1, 6).setValues([[p.markt, p.datum, p.kunde, p.bestellung, p.kontakt, p.kommentar]]);
    blatt.getRange(zeile, SP.GEAENDERT_AM, 1, 2).setValues([[new Date(), p.mitarbeiter]]);
  } finally {
    lock.releaseLock();
  }

  protokoll_(ss, id, 'Bearbeitet', p.mitarbeiter, 'vorher: ' + vorher + ' | jetzt: ' + kurz_(p.kunde, p.markt, p.datum), a.geraet, tablet.name);
  const warnung = kalenderAbgleichen_(ss, blatt, zeile);
  return { ok: true, bestellung: zeileLesen_(blatt, zeile), warnung: warnung };
}

function stornieren_(ss, tablet, a) {
  const id = String(a.id || '').trim();
  const mitarbeiter = String(a.mitarbeiter || '').trim();
  if (konfigLaden_(ss).mitarbeiter.indexOf(mitarbeiter) === -1) throw abgelehnt_('Bitte antippen, wer storniert.');
  const blatt = blattPflicht_(ss, BLATT.bestellungen);

  let zeile, details;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = zeileFinden_(blatt, id);
    if (!t) throw abgelehnt_('Diese Bestellung wurde nicht gefunden. Bitte die Übersicht aktualisieren.');
    zeile = t.zeile;
    if (statusAusText_(t.werte[SP.STATUS - 1]) === 'storniert') return { ok: true, bestellung: zeileZuBestellung_(t.werte) };
    details = kurz_(t.werte[SP.KUNDE - 1], t.werte[SP.MARKT - 1], datumAusZelle_(t.werte[SP.DATUM - 1]));
    const jetzt = new Date();
    blatt.getRange(zeile, SP.STATUS).setValue(STATUS_TEXT.storniert);
    blatt.getRange(zeile, SP.GEAENDERT_AM, 1, 4).setValues([[jetzt, mitarbeiter, jetzt, mitarbeiter]]);
  } finally {
    lock.releaseLock();
  }

  protokoll_(ss, id, 'Storniert', mitarbeiter, details, a.geraet, tablet.name);
  const warnung = kalenderAbgleichen_(ss, blatt, zeile);
  return { ok: true, bestellung: zeileLesen_(blatt, zeile), warnung: warnung };
}

/** Abgeholt / wieder offen / Storno aufheben – kommt ohne Mitarbeiter, das Tablet steht im Protokoll. */
function statusSetzen_(ss, tablet, a) {
  const id = String(a.id || '').trim();
  const neu = String(a.status || '');
  if (neu !== 'abgeholt' && neu !== 'offen') throw abgelehnt_('Unbekannter Status: ' + neu);
  const blatt = blattPflicht_(ss, BLATT.bestellungen);

  let zeile, aktion, details;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = zeileFinden_(blatt, id);
    if (!t) throw abgelehnt_('Diese Bestellung wurde nicht gefunden. Bitte die Übersicht aktualisieren.');
    zeile = t.zeile;
    const bisher = statusAusText_(t.werte[SP.STATUS - 1]);
    if (bisher === 'storniert' && neu === 'abgeholt') {
      throw abgelehnt_('Die Bestellung von ' + t.werte[SP.KUNDE - 1] + ' wurde inzwischen storniert.');
    }
    if (bisher === neu) return { ok: true, bestellung: zeileZuBestellung_(t.werte) }; // schon so
    details = kurz_(t.werte[SP.KUNDE - 1], t.werte[SP.MARKT - 1], datumAusZelle_(t.werte[SP.DATUM - 1]));

    if (neu === 'abgeholt') {
      blatt.getRange(zeile, SP.ABGEHOLT_AM, 1, 2).setValues([[zeitpunktAusApp_(a.zeit), tablet.name]]);
      aktion = 'Abgeholt';
    } else if (bisher === 'storniert') {
      blatt.getRange(zeile, SP.STORNO_AM, 1, 2).setValues([['', '']]);
      aktion = 'Storno aufgehoben';
    } else {
      blatt.getRange(zeile, SP.ABGEHOLT_AM, 1, 2).setValues([['', '']]);
      aktion = 'Abholung rückgängig';
    }
    blatt.getRange(zeile, SP.STATUS).setValue(STATUS_TEXT[neu]);
  } finally {
    lock.releaseLock();
  }

  protokoll_(ss, id, aktion, '', details, a.geraet, tablet.name);
  const warnung = kalenderAbgleichen_(ss, blatt, zeile);
  return { ok: true, bestellung: zeileLesen_(blatt, zeile), warnung: warnung };
}

function pinPruefen_(ss, a) {
  const pin = String(einstellungen_(ss)['Admin-PIN'] || '').trim();
  if (!pin) {
    return { ok: true, richtig: false, hinweis: 'In der Tabelle ist noch keine Admin-PIN hinterlegt (Blatt „Einstellungen").' };
  }
  return { ok: true, richtig: String(a.pin || '') === pin };
}

// ================== Prüfung der Eingaben (wie v3) ==================

function felderPruefen_(f, konfig) {
  const mitarbeiter = text_(f.mitarbeiter);
  const markt = text_(f.markt);
  const datumText = text_(f.datum);
  const kunde = text_(f.kunde);
  const bestellung = text_(f.bestellung);
  const kontakt = text_(f.kontakt);
  const kommentar = text_(f.kommentar);

  if (!mitarbeiter || !markt || !datumText || !kunde || !bestellung) {
    throw abgelehnt_('Bitte alle Pflichtangaben ausfüllen (Markt, Abholtag, Kunde, Bestellung, Mitarbeiter).');
  }
  if (konfig.mitarbeiter.indexOf(mitarbeiter) === -1) throw abgelehnt_('Unbekannter Mitarbeiter: ' + mitarbeiter);
  const m = konfig.maerkte.filter((x) => x.name === markt)[0];
  if (!m) throw abgelehnt_('Unbekannter Markt: ' + markt);

  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datumText);
  if (!teile) throw abgelehnt_('Ungültiges Datum.');
  const datum = new Date(Number(teile[1]), Number(teile[2]) - 1, Number(teile[3]));
  if (datum.getDate() !== Number(teile[3])) throw abgelehnt_('Ungültiges Datum.');
  if (m.tage.indexOf(datum.getDay()) === -1) throw abgelehnt_('Das Datum passt nicht zu den Markttagen von „' + markt + '".');
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  if (datum < heute) throw abgelehnt_('Das Datum liegt in der Vergangenheit.');
  const spaetestens = new Date(heute.getTime());
  spaetestens.setDate(spaetestens.getDate() + MAX_VORLAUF_TAGE);
  if (datum > spaetestens) throw abgelehnt_('Das Datum liegt zu weit in der Zukunft (höchstens 2 Monate).');

  const werte = { kunde: kunde, bestellung: bestellung, kontakt: kontakt, kommentar: kommentar };
  Object.keys(MAX_LAENGE).forEach((k) => {
    if (werte[k].length > MAX_LAENGE[k]) throw abgelehnt_('„' + k + '" ist zu lang (höchstens ' + MAX_LAENGE[k] + ' Zeichen).');
  });

  return { mitarbeiter: mitarbeiter, markt: markt, datum: datum, kunde: kunde, bestellung: bestellung, kontakt: kontakt, kommentar: kommentar };
}

// ================== Lesen ==================

function konfigLaden_(ss) {
  const werte = blattPflicht_(ss, BLATT.konfig).getDataRange().getValues();
  const mitarbeiter = [];
  const maerkte = [];
  const fahrzeuge = [];
  for (let i = 1; i < werte.length; i++) {
    const name = text_(werte[i][0]);
    if (name) mitarbeiter.push(name);
    const markt = text_(werte[i][2]);
    const tageText = text_(werte[i][3]);
    const fahrzeug = text_(werte[i][4]);
    if (markt && tageText) {
      const tage = tageText.split(',')
        .map((t) => WOCHENTAGE[t.trim().slice(0, 2).toLowerCase()])
        .filter((t) => t !== undefined);
      if (tage.length) {
        maerkte.push({ name: markt, tage: tage, fahrzeug: fahrzeug });
        if (fahrzeug && fahrzeuge.indexOf(fahrzeug) === -1) fahrzeuge.push(fahrzeug);
      }
    }
  }
  if (!mitarbeiter.length || !maerkte.length) {
    throw abgelehnt_('Konfiguration unvollständig: Bitte im Blatt „Konfiguration" Mitarbeiter und Märkte eintragen.');
  }
  return { mitarbeiter: mitarbeiter, maerkte: maerkte, fahrzeuge: fahrzeuge };
}

function bestellungenLesen_(ss) {
  const blatt = blattPflicht_(ss, BLATT.bestellungen);
  const letzte = blatt.getLastRow();
  if (letzte < 2) return [];
  const werte = blatt.getRange(2, 1, letzte - 1, KOPF_BESTELLUNGEN.length).getValues();
  return werte
    .filter((z) => text_(z[SP.ID - 1]))
    .map(zeileZuBestellung_)
    .filter((b) => b.datum);
}

function zeileZuBestellung_(z) {
  const datum = datumAusZelle_(z[SP.DATUM - 1]);
  return {
    id: text_(z[SP.ID - 1]),
    datum: datum ? datumText_(datum) : '',
    markt: text_(z[SP.MARKT - 1]),
    kunde: text_(z[SP.KUNDE - 1]),
    bestellung: text_(z[SP.BESTELLUNG - 1]),
    kontakt: text_(z[SP.KONTAKT - 1]),
    kommentar: text_(z[SP.KOMMENTAR - 1]),
    status: statusAusText_(z[SP.STATUS - 1]),
    erfasstVon: text_(z[SP.MITARBEITER - 1]),
    erfasstAm: zeitText_(z[SP.ZEIT - 1]),
    erfasstUeber: text_(z[SP.ERFASST_UEBER - 1]),
    geaendertVon: text_(z[SP.GEAENDERT_VON - 1]),
    geaendertAm: zeitText_(z[SP.GEAENDERT_AM - 1]),
    abgeholtAm: zeitText_(z[SP.ABGEHOLT_AM - 1]),
    storniertVon: text_(z[SP.STORNO_VON - 1]),
    storniertAm: zeitText_(z[SP.STORNO_AM - 1]),
  };
}

function zeileLesen_(blatt, zeile) {
  return zeileZuBestellung_(blatt.getRange(zeile, 1, 1, KOPF_BESTELLUNGEN.length).getValues()[0]);
}

/** Sucht die Zeile mit der Bestell-ID (Zeilennummern taugen nicht – die Tabelle kann sortiert werden). */
function zeileFinden_(blatt, id) {
  const letzte = blatt.getLastRow();
  if (!id || letzte < 2) return null;
  const ids = blatt.getRange(2, SP.ID, letzte - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (text_(ids[i][0]) === id) {
      const zeile = i + 2;
      return { zeile: zeile, werte: blatt.getRange(zeile, 1, 1, KOPF_BESTELLUNGEN.length).getValues()[0] };
    }
  }
  return null;
}

function statusAusText_(wert) {
  const t = text_(wert).toLowerCase();
  if (t === 'abgeholt') return 'abgeholt';
  if (t === 'storniert') return 'storniert';
  return 'offen'; // auch der alte v3-Wert „Aktiv"
}

function einstellungen_(ss) {
  const blatt = ss.getSheetByName(BLATT.einstellungen);
  const e = {};
  if (!blatt) return e;
  blatt.getDataRange().getValues().forEach((z) => { if (text_(z[0])) e[text_(z[0])] = z[1]; });
  return e;
}

// ================== Tablets und Schlüssel ==================

function tabletPruefen_(ss, schluessel) {
  const s = text_(schluessel);
  if (s.length < 16) return null;
  const blatt = ss.getSheetByName(BLATT.tablets);
  if (!blatt) return null;
  const werte = blatt.getDataRange().getValues();
  for (let i = 1; i < werte.length; i++) {
    if (text_(werte[i][1]) !== s) continue;
    if (text_(werte[i][2]).toLowerCase() === 'nein') return null; // gesperrt
    zuletztGesehen_(blatt, i + 1, werte[i][4]);
    return { name: text_(werte[i][0]) || 'Tablet ' + i, zeile: i + 1 };
  }
  return null;
}

function zuletztGesehen_(blatt, zeile, bisher) {
  const jetzt = new Date();
  if (bisher instanceof Date && jetzt - bisher < 10 * 60 * 1000) return; // nicht bei jeder Anfrage schreiben
  try { blatt.getRange(zeile, 5).setValue(jetzt); } catch (err) { /* unwichtig */ }
}

/** Langer Zufallsschlüssel (64 Zeichen). Entsteht hier im Skript – läuft nie durch Chat oder Repo. */
function schluesselErzeugen_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function neuerSchluessel() {
  const ui = SpreadsheetApp.getUi();
  const blatt = SpreadsheetApp.getActiveSheet();
  if (blatt.getName() !== BLATT.tablets) {
    ui.alert('Bitte zuerst im Blatt „Tablets" in die Zeile des Tablets klicken, dann erneut wählen.');
    return;
  }
  const zeile = blatt.getActiveRange().getRow();
  const name = text_(blatt.getRange(zeile, 1).getValue());
  if (zeile < 2 || !name) {
    ui.alert('Bitte in die Zeile eines Tablets klicken (nicht in die Überschrift).');
    return;
  }
  const antwort = ui.alert(
    'Neuer Schlüssel für „' + name + '"?',
    'Der bisherige Einrichtungs-Link funktioniert danach sofort nicht mehr. Das Tablet muss mit dem neuen Link (Spalte D) neu eingerichtet werden.',
    ui.ButtonSet.YES_NO);
  if (antwort !== ui.Button.YES) return;
  blatt.getRange(zeile, 2).setValue(schluesselErzeugen_());
  ui.alert('Erledigt. Den neuen Einrichtungs-Link für „' + name + '" findest du in Spalte D.');
}

// ================== Kalender ==================

/** Termin passend zur Zeile: anlegen, ändern (✓ bei Abgeholt), bei Storno löschen. */
function kalenderAbgleichen_(ss, blatt, zeile) {
  const e = einstellungen_(ss);
  if (text_(e['Kalender-Spiegelung'] || 'Ja').toLowerCase() === 'nein') return null;
  try {
    const kalender = kalender_(e);
    const z = blatt.getRange(zeile, 1, 1, KOPF_BESTELLUNGEN.length).getValues()[0];
    const b = zeileZuBestellung_(z);
    const eventId = text_(z[SP.EVENT - 1]);
    let termin = null;
    if (eventId && eventId.indexOf('KALENDER-FEHLER') !== 0) {
      try { termin = kalender.getEventById(eventId); } catch (err) { termin = null; }
    }
    if (b.status === 'storniert') {
      if (termin) termin.deleteEvent();
      blatt.getRange(zeile, SP.EVENT).setValue('');
      return null;
    }
    const datum = datumAusZelle_(z[SP.DATUM - 1]);
    const titel = (b.status === 'abgeholt' ? '✓ ' : '') + 'Bestellung: ' + b.kunde + ' – ' + b.markt;
    const beschreibung = [
      'Markt: ' + b.markt,
      'Kunde: ' + b.kunde,
      'Bestellung:\n' + b.bestellung,
      b.kontakt && 'Kontakt: ' + b.kontakt,
      b.kommentar && 'Kommentar: ' + b.kommentar,
      'Aufgenommen von: ' + b.erfasstVon,
      'Status: ' + STATUS_TEXT[b.status],
      'Bestell-Nr.: ' + b.id,
    ].filter(Boolean).join('\n');
    if (termin) {
      termin.setTitle(titel);
      termin.setDescription(beschreibung);
      termin.setAllDayDate(datum);
    } else {
      termin = kalender.createAllDayEvent(titel, datum, { description: beschreibung });
      blatt.getRange(zeile, SP.EVENT).setValue(termin.getId());
    }
    return null;
  } catch (err) {
    return 'Gespeichert – aber der Kalendertermin konnte nicht angepasst werden (' + err.message + ').';
  }
}

function kalender_(e) {
  const name = text_(e['Kalender-Name']) || 'Bestellungen';
  const liste = CalendarApp.getCalendarsByName(name);
  if (!liste.length) throw new Error('Kalender „' + name + '" nicht gefunden');
  return liste[0];
}

// ================== Protokoll ==================

function protokoll_(ss, id, aktion, mitarbeiter, details, geraet, tablet) {
  try {
    const blatt = ss.getSheetByName(BLATT.protokoll) || ss.insertSheet(BLATT.protokoll);
    blatt.appendRow([new Date(), id, aktion, mitarbeiter || '', details || '', text_(geraet, 60), '', tablet || '']);
  } catch (err) {
    Logger.log('Protokoll konnte nicht geschrieben werden: ' + err.message);
  }
}

// ================== Einrichten (Menü „Bestell-App → Einrichten / prüfen") ==================

/**
 * Bringt die Tabelle in Form – gefahrlos mehrfach ausführbar: legt fehlende Blätter, Spalten
 * und Einstellungen an, erzeugt fehlende Tablet-Schlüssel und prüft den Kalender.
 * Bestehende Daten werden nicht verändert.
 */
function einrichten() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('TABELLE_ID', ss.getId());
  const meldungen = [];

  // Bestellungen + Protokoll: fehlende Spaltenüberschriften ergänzen, Formate setzen
  const bestellungen = ss.getSheetByName(BLATT.bestellungen) || ss.insertSheet(BLATT.bestellungen);
  kopfSichern_(bestellungen, KOPF_BESTELLUNGEN);
  bestellungen.getRange('D2:D').setNumberFormat('dd.mm.yyyy');
  ['A', 'N', 'P', 'R'].forEach((s) => bestellungen.getRange(s + '2:' + s).setNumberFormat('dd.mm.yyyy hh:mm'));
  kopfSichern_(ss.getSheetByName(BLATT.protokoll) || ss.insertSheet(BLATT.protokoll), KOPF_PROTOKOLL);

  // Konfiguration
  const konfig = ss.getSheetByName(BLATT.konfig);
  if (!konfig) throw new Error('Blatt „Konfiguration" fehlt.');
  if (!text_(konfig.getRange('E1').getValue())) konfig.getRange('E1').setValue('Fahrzeug').setFontWeight('bold');
  const k = konfigLaden_(ss);
  meldungen.push('Konfiguration: ' + k.mitarbeiter.length + ' Mitarbeiter, ' + k.maerkte.length + ' Märkte, Fahrzeuge: ' + (k.fahrzeuge.join(', ') || '–'));

  // Einstellungen: fehlende Zeilen mit Standardwert anlegen
  let einst = ss.getSheetByName(BLATT.einstellungen);
  if (!einst) {
    einst = ss.insertSheet(BLATT.einstellungen);
    einst.getRange(1, 1, 1, 3).setValues([['Einstellung', 'Wert', 'Erklärung']]).setFontWeight('bold');
  }
  const vorhanden = einst.getDataRange().getValues().map((z) => text_(z[0]));
  EINSTELLUNGEN_STANDARD.forEach((zeile) => { if (vorhanden.indexOf(zeile[0]) === -1) einst.appendRow(zeile); });
  benannterBereich_(ss, einst, 'APP_ADRESSE', 'App-Adresse');
  benannterBereich_(ss, einst, 'WEBAPP_ADRESSE', 'Web-App-Adresse');
  const e = einstellungen_(ss);

  // Tablets: je Fahrzeug + Firma eine Zeile, fehlende Schlüssel und Link-Formeln ergänzen
  let tablets = ss.getSheetByName(BLATT.tablets);
  if (!tablets) tablets = ss.insertSheet(BLATT.tablets);
  kopfSichern_(tablets, KOPF_TABLETS);
  if (tablets.getLastRow() < 2) k.fahrzeuge.concat(['Firma']).forEach((n) => tablets.appendRow([n, '', 'Ja']));
  const werte = tablets.getRange(1, 1, tablets.getLastRow(), 4).getValues();
  let neueSchluessel = 0;
  for (let i = 1; i < werte.length; i++) {
    if (!text_(werte[i][0])) continue;
    const z = i + 1;
    if (!text_(werte[i][1])) { tablets.getRange(z, 2).setValue(schluesselErzeugen_()); neueSchluessel++; }
    if (!text_(werte[i][2])) tablets.getRange(z, 3).setValue('Ja');
    if (!tablets.getRange(z, 4).getFormula()) {
      tablets.getRange(z, 4).setFormula('=IF(OR(B' + z + '="",C' + z + '="Nein",WEBAPP_ADRESSE=""),"",APP_ADRESSE&"#api="&ENCODEURL(WEBAPP_ADRESSE)&"&k="&ENCODEURL(B' + z + '))');
    }
  }
  meldungen.push('Tablets: ' + (werte.length - 1) + ' Zeilen, ' + neueSchluessel + ' neue Schlüssel erzeugt.');

  // Kalender prüfen
  if (text_(e['Kalender-Spiegelung'] || 'Ja').toLowerCase() === 'nein') {
    meldungen.push('Kalender-Spiegelung: aus.');
  } else {
    try {
      meldungen.push('Kalender: „' + kalender_(e).getName() + '" gefunden ✓');
    } catch (err) {
      meldungen.push('⚠ ' + err.message + ' – bitte den Namen im Blatt „Einstellungen" prüfen.');
    }
  }

  // Web-App-Adresse
  const webapp = text_(e['Web-App-Adresse']);
  if (!webapp) meldungen.push('⚠ Noch keine Web-App-Adresse im Blatt „Einstellungen" – erst nach dem Bereitstellen eintragen, dann erscheinen die Einrichtungs-Links.');
  else if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(webapp)) meldungen.push('⚠ Die Web-App-Adresse muss mit https://script.google.com/ beginnen und auf /exec enden.');
  else meldungen.push('Web-App-Adresse eingetragen ✓ – die Einrichtungs-Links stehen im Blatt „Tablets", Spalte D.');

  if (!text_(e['Admin-PIN'])) meldungen.push('⚠ Noch keine Admin-PIN im Blatt „Einstellungen".');

  const text = meldungen.join('\n');
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert('Bestell-App – Einrichtung', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (err) { /* ohne Oberfläche */ }
}

function kopfSichern_(blatt, kopf) {
  if (blatt.getMaxColumns() < kopf.length) blatt.insertColumnsAfter(blatt.getMaxColumns(), kopf.length - blatt.getMaxColumns());
  const bisher = blatt.getRange(1, 1, 1, kopf.length).getValues()[0];
  kopf.forEach((name, i) => { if (!text_(bisher[i])) blatt.getRange(1, i + 1).setValue(name).setFontWeight('bold'); });
  if (blatt.getFrozenRows() < 1) blatt.setFrozenRows(1);
}

function benannterBereich_(ss, blatt, name, beschriftung) {
  if (ss.getRangeByName(name)) return;
  const zeilen = blatt.getDataRange().getValues();
  for (let i = 0; i < zeilen.length; i++) {
    if (text_(zeilen[i][0]) === beschriftung) { ss.setNamedRange(name, blatt.getRange(i + 1, 2)); return; }
  }
}

// ================== Helfer ==================

function tabelle_() {
  const aktiv = SpreadsheetApp.getActiveSpreadsheet();
  if (aktiv) return aktiv;
  const id = PropertiesService.getScriptProperties().getProperty('TABELLE_ID');
  if (!id) throw new Error('Tabelle unbekannt – bitte einmal „Bestell-App → Einrichten / prüfen" ausführen.');
  return SpreadsheetApp.openById(id);
}

function blattPflicht_(ss, name) {
  const blatt = ss.getSheetByName(name);
  if (!blatt) throw abgelehnt_('Blatt „' + name + '" fehlt in der Tabelle.');
  return blatt;
}

/** Zellwert als bereinigter Text (Zeilenumbrüche innen bleiben erhalten). */
function text_(wert, max) {
  const t = String(wert === null || wert === undefined ? '' : wert).trim();
  return max ? t.slice(0, max) : t;
}

function datumAusZelle_(roh) {
  if (roh instanceof Date && !isNaN(roh.getTime())) return new Date(roh.getFullYear(), roh.getMonth(), roh.getDate());
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(text_(roh));
  return t ? new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3])) : null;
}

function datumText_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function heuteText_() { return datumText_(new Date()); }
function zeitText_(wert) { return wert instanceof Date && !isNaN(wert.getTime()) ? wert.toISOString() : ''; }

function kurz_(kunde, markt, datum) {
  const d = datum instanceof Date ? Utilities.formatDate(datum, Session.getScriptTimeZone(), 'dd.MM.yyyy') : '?';
  return text_(kunde) + ' – ' + text_(markt) + ' – ' + d;
}

/** Zeitpunkt des Tipps auf dem Tablet übernehmen, wenn plausibel (z. B. nach Funkloch), sonst jetzt. */
function zeitpunktAusApp_(wert) {
  const d = new Date(wert);
  const jetzt = new Date();
  if (isNaN(d.getTime()) || d > new Date(jetzt.getTime() + 5 * 60000) || jetzt - d > 7 * 86400000) return jetzt;
  return d;
}

function pruefsumme_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8)
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
