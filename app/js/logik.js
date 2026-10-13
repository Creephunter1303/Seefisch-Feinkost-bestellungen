// Fachlogik ohne Oberfläche: Ansichten (Fahrzeug / Markt / Alle), Markttage, Sortierung.
//
// Eine "Ansicht" ist { typ: 'fahrzeug', wert: 'Wagen 2' } | { typ: 'markt', wert: 'Uetze' } | { typ: 'alle' }.

import { heuteIso, plusTage, wochentag, TAGE_KURZ } from './datum.js';

export function ansichtGleich(a, b) {
  return !!a && !!b && a.typ === b.typ && (a.wert || '') === (b.wert || '');
}

export function ansichtName(a) {
  if (!a) return '';
  return a.typ === 'alle' ? 'Alle Märkte' : a.wert;
}

/** "für Wagen 2" / "für alle Märkte" */
export function ansichtFuer(a) {
  return a && a.typ === 'alle' ? 'für alle Märkte' : 'für ' + ansichtName(a);
}

export function ansichtSymbol(a) {
  if (!a) return '';
  if (a.typ === 'alle') return '🗺️';
  if (a.typ === 'markt') return '📍';
  return '🚚';
}

export function marktFinden(konfig, name) {
  return konfig.maerkte.find((m) => m.name === name) || null;
}

export function marktnamenDerAnsicht(konfig, a) {
  if (!a || a.typ === 'alle') return konfig.maerkte.map((m) => m.name);
  if (a.typ === 'fahrzeug') return konfig.maerkte.filter((m) => m.fahrzeug === a.wert).map((m) => m.name);
  return konfig.maerkte.some((m) => m.name === a.wert) ? [a.wert] : [];
}

/** Märkte der Ansicht, die an diesem Tag stattfinden. */
export function maerkteAmTag(konfig, a, tag) {
  const namen = new Set(marktnamenDerAnsicht(konfig, a));
  const wt = wochentag(tag);
  return konfig.maerkte.filter((m) => namen.has(m.name) && m.tage.includes(wt));
}

/** Alle Markttage eines Markts zwischen zwei Tagen (jeweils einschließlich). */
export function termine(markt, von, bis) {
  const liste = [];
  for (let t = von; t <= bis; t = plusTage(t, 1)) {
    if (markt.tage.includes(wochentag(t))) liste.push(t);
  }
  return liste;
}

/** Erster Tag ab `ab`, an dem ein Markt der Ansicht stattfindet. */
export function naechsterMarkttag(konfig, a, ab, bis) {
  for (let t = ab; t <= bis; t = plusTage(t, 1)) {
    if (maerkteAmTag(konfig, a, t).length) return t;
  }
  return null;
}

/** Letzter Tag vor `vor` (aber nicht vor `min`), an dem ein Markt der Ansicht stattfindet. */
export function vorherigerMarkttag(konfig, a, vor, min) {
  for (let t = plusTage(vor, -1); t >= min; t = plusTage(t, -1)) {
    if (maerkteAmTag(konfig, a, t).length) return t;
  }
  return null;
}

/** Markt-Vorbelegung für eine neue Bestellung: der heutige bzw. nächste Markt der Ansicht. */
export function vorbelegterMarkt(konfig, a) {
  if (!a || a.typ === 'alle') return null;
  const h = heuteIso();
  for (let i = 0; i < 7; i++) {
    const m = maerkteAmTag(konfig, a, plusTage(h, i));
    if (m.length) return m[0].name;
  }
  return null;
}

/** "Mi" oder "Mi, Sa" (Montag zuerst). */
export function tageText(markt) {
  return [1, 2, 3, 4, 5, 6, 0].filter((t) => markt.tage.includes(t)).map((t) => TAGE_KURZ[t]).join(', ');
}

/** Märkte nach Fahrzeug gruppiert, in der Reihenfolge der Fahrzeuge: [[fahrzeug, [märkte]], …] */
export function maerkteNachFahrzeug(konfig, maerkte = konfig.maerkte) {
  const ohne = 'Ohne Fahrzeug';
  const namen = konfig.fahrzeuge.concat(maerkte.some((m) => !konfig.fahrzeuge.includes(m.fahrzeug)) ? [ohne] : []);
  return namen
    .map((f) => [f, maerkte.filter((m) => (konfig.fahrzeuge.includes(m.fahrzeug) ? m.fahrzeug : ohne) === f)])
    .filter(([, liste]) => liste.length);
}

/** Gibt es irgendeinen Markt am Sonntag? Sonst zeigen Woche und Kalender nur Mo–Sa. */
export function mitSonntag(konfig) {
  return konfig.maerkte.some((m) => m.tage.includes(0));
}

export function fuerAnsicht(liste, konfig, a) {
  if (!a || a.typ === 'alle') return liste;
  const namen = new Set(marktnamenDerAnsicht(konfig, a));
  return liste.filter((b) => namen.has(b.markt));
}

export function istErledigt(b) {
  return b.status === 'abgeholt' || b.status === 'storniert';
}

/** Nach Tag, dann Markt (Reihenfolge wie in der Tabelle), dann Kunde. */
export function sortieren(liste, konfig) {
  const reihenfolge = new Map(konfig.maerkte.map((m, i) => [m.name, i]));
  const rang = (b) => (reihenfolge.has(b.markt) ? reihenfolge.get(b.markt) : 999);
  return [...liste].sort((x, y) =>
    (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0) ||
    rang(x) - rang(y) ||
    x.kunde.localeCompare(y.kunde, 'de'));
}

export function suchen(liste, text) {
  const t = text.trim().toLowerCase();
  if (!t) return liste;
  return liste.filter((b) => [b.kunde, b.bestellung, b.kontakt, b.kommentar, b.markt].join(' ').toLowerCase().includes(t));
}
