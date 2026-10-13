// Datums-Helfer. Alle Tage werden als Text 'JJJJ-MM-TT' (lokale Zeit) geführt –
// so gibt es keine Zeitzonen-Überraschungen wie „Termin landet am Vortag".

export const TAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Wie weit im Voraus bestellt werden kann (wie v3: 2 Monate).
export const VORLAUF_TAGE = 62;

// Nur im Prototyp: „heute" kann zum Testen auf einen anderen Tag gestellt werden.
let simuliert = null;
export function heuteSimulieren(isoTag) { simuliert = isoTag || null; }
export function istSimuliert() { return !!simuliert; }

function p2(n) { return String(n).padStart(2, '0'); }

export function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }

export function ausIso(s) {
  const [j, m, t] = String(s).split('-').map(Number);
  return new Date(j, m - 1, t);
}

export function echtHeuteIso() { return iso(new Date()); }
export function heuteIso() { return simuliert || echtHeuteIso(); }

export function plusTage(s, n) {
  const d = ausIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function wochentag(s) { return ausIso(s).getDay(); }

/** "Di 13.10." */
export function datumKurz(s) {
  const d = ausIso(s);
  return TAGE_KURZ[d.getDay()] + ' ' + p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.';
}

/** "13.10." */
export function tagMonat(s) {
  const d = ausIso(s);
  return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.';
}

/** "Dienstag, 13. Oktober" */
export function datumLang(s) {
  const d = ausIso(s);
  return TAGE_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()];
}

/** "Dienstag, 13.10.2026" */
export function datumVoll(s) {
  const d = ausIso(s);
  return TAGE_LANG[d.getDay()] + ', ' + p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear();
}

/** "Heute" / "Morgen" / null */
export function relativerTag(s) {
  const h = heuteIso();
  if (s === h) return 'Heute';
  if (s === plusTage(h, 1)) return 'Morgen';
  return null;
}

/** Montag der Woche, in der der Tag liegt. */
export function wochenstart(s) {
  const d = ausIso(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

/** Kalenderwoche nach ISO 8601 (wie im deutschen Kalender). */
export function kalenderwoche(s) {
  const [j, m, t] = String(s).split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  const tagNr = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tagNr);
  const jahresbeginn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jahresbeginn) / 86400000 + 1) / 7);
}

/** "12.–17. Oktober" bzw. "28. September – 3. Oktober" (Montag bis Samstag) */
export function wochenText(startIso) {
  const a = ausIso(startIso);
  const e = ausIso(plusTage(startIso, 5));
  if (a.getMonth() === e.getMonth()) return a.getDate() + '.–' + e.getDate() + '. ' + MONATE[e.getMonth()];
  return a.getDate() + '. ' + MONATE[a.getMonth()] + ' – ' + e.getDate() + '. ' + MONATE[e.getMonth()];
}

export function monatKurz(s) { return MONATE[ausIso(s).getMonth()].slice(0, 3); }

/** "09:42" aus einem Zeitpunkt (Date oder ISO-Zeitstempel). */
export function uhrzeit(zeit) {
  const d = zeit instanceof Date ? zeit : new Date(zeit);
  if (isNaN(d)) return '';
  return p2(d.getHours()) + ':' + p2(d.getMinutes());
}

/** "13.10. um 09:42 Uhr" bzw. "heute um 09:42 Uhr" */
export function zeitpunktText(isoZeit) {
  if (!isoZeit) return '';
  const d = new Date(isoZeit);
  if (isNaN(d)) return '';
  const tag = iso(d) === echtHeuteIso() ? 'heute' : p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.';
  return tag + ' um ' + uhrzeit(d) + ' Uhr';
}
