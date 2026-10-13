// Beispieldaten für den Prototyp. Märkte, Markttage und Fahrzeuge wie im Blatt
// „Konfiguration" (Stand 13.10.2026). Die Mitarbeiter sind bewusst erfunden – das Repo ist
// öffentlich; die echten Namen kommen in Schritt 2 direkt aus der Tabelle.

import { plusTage, wochentag } from '../datum.js';

export const DEMO_KONFIG = {
  fahrzeuge: ['Seico', 'Borco Neu', 'Borco Alt'],
  maerkte: [
    { name: 'REWE Groß Ilsede', tage: [2], fahrzeug: 'Seico' },
    { name: 'Stadtmarkt Celle', tage: [3, 6], fahrzeug: 'Borco Neu' },
    { name: 'Stadtmarkt Wolfsburg', tage: [3, 6], fahrzeug: 'Seico' },
    { name: 'Ölsburg E-Center', tage: [4], fahrzeug: 'Borco Alt' },
    { name: 'Uetze', tage: [4], fahrzeug: 'Seico' },
    { name: 'Stederdorf', tage: [4], fahrzeug: 'Borco Neu' },
    { name: 'Vorsfelde Wolfsburg', tage: [5], fahrzeug: 'Borco Alt' },
    { name: 'Celle Weststadt', tage: [5], fahrzeug: 'Seico' },
    { name: 'Groß Schwülper', tage: [5], fahrzeug: 'Borco Neu' },
    { name: 'Isenbüttel', tage: [5], fahrzeug: 'Seico' },
    { name: 'Hildesheim', tage: [6], fahrzeug: 'Borco Alt' },
  ],
  mitarbeiter: ['Anna', 'Ben', 'Clara', 'Dirk', 'Eva', 'Finn', 'Gabi'],
};

const KUNDEN = [
  'Herr Schmidt', 'Familie Becker', 'Herr Krüger', 'Frau Hoffmann', 'Restaurant Seeblick',
  'Herr Wagner', 'Frau Schulz', 'Herr Koch', 'Frau Bauer', 'Herr Richter', 'Frau Klein',
  'Herr Wolf', 'Frau Neumann', 'Herr Schwarz', 'Frau Zimmermann', 'Herr Braun',
  'Frau Hartmann', 'Herr Lange', 'Frau Werner', 'Herr Krause', 'Frau Lehmann',
  'Herr Peters', 'Frau Fuchs', 'Herr Vogel', 'Frau Keller',
];

const WAREN = [
  '1 Räucheraal, ca. 500 g', '6 Matjesfilets', '1 ganzer Zander, ca. 1,5 kg, geschuppt',
  '500 g Nordseekrabben', '1 kg Garnelen, roh, geschält', '4 Forellen, geräuchert',
  '800 g Heilbutt in Scheiben', '1,2 kg Kabeljau-Rückenfilet', '3 Schillerlocken',
  '4 Thunfischsteaks à 200 g', '1 kg Miesmuscheln', '2 Gläser Bismarckheringe',
  'Räucherlachs 400 g, geschnitten', '1 Karpfen, ca. 2 kg, küchenfertig',
  'Fischplatte für 6 Personen', '2 Makrelen, geräuchert', '500 g Krabbensalat',
  '1 kg Seelachsfilet', '600 g Rotbarschfilet', '1 kg Lachsfilet mit Haut, 2 Stücke',
  '2 Forellen geräuchert\n250 g Nordseekrabben', '4 Bismarckheringe\n1 Glas Sahnehering\n2 Brötchen-Fischplatten',
  'Räucherlachs 300 g\nMeerrettich-Sahne',
];

// Die vier Bestellungen aus der Designvorlage (heute, erster Markt). „Frau Müller" für den Aufgabentest.
const VORLAGE = [
  { kunde: 'Frau Fuchs', bestellung: '1 Räucheraal, ca. 500 g\n2 Makrelen geräuchert\n200 g Krabbensalat', kontakt: '05141 12345', kommentar: 'bitte vorher anrufen' },
  { kunde: 'Frau Müller', bestellung: 'Lachsfilet ohne Haut, ca. 2 kg', kontakt: '', kommentar: '' },
  { kunde: 'Herr Krüger', bestellung: '6 Matjesfilets', status: 'abgeholt' },
  { kunde: 'Herr Wolf', bestellung: 'Heilbutt in Scheiben, 800 g', status: 'storniert' },
];

const KONTAKTE = [
  '0171 2345678', '0152 3456789', '05141 12345', '0160 9876543', 'krueger@example.com',
  '05361 23456', '0176 5551234', 'becker@example.com',
];

const KOMMENTARE = [
  'kommt gegen 11 Uhr', 'bitte in Scheiben schneiden', 'ist schon bezahlt', 'Stammkunde',
  'Tochter holt ab', 'bitte vorher anrufen', 'möglichst ohne Gräten', 'kommt erst kurz vor Marktende',
];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Zufallszahlen, die für denselben Tag immer gleich ausfallen (stabile Testdaten). */
function zufallsgenerator(text) {
  let s = 0;
  for (let i = 0; i < text.length; i++) s = (Math.imul(s, 31) + text.charCodeAt(i)) | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Erzeugt Bestellungen für die nächsten 14 Tage. Normal ca. 10 pro Woche (heute je Markt
 * 2–3, damit es etwas zu sehen gibt), mit `weihnachten` ca. 60 pro Woche.
 */
export function beispielBestellungen(konfig, heute, weihnachten) {
  const rnd = zufallsgenerator('seefisch|' + heute + '|' + (weihnachten ? 'w' : 'n'));
  const nimm = (liste) => liste[Math.floor(rnd() * liste.length)];
  const id = () => 'B-' + Array.from({ length: 8 }, () => ALPHABET[Math.floor(rnd() * ALPHABET.length)]).join('');
  const zeitVor = (tageVorher, stunde) => {
    const d = new Date();
    d.setDate(d.getDate() - tageVorher);
    d.setHours(stunde, Math.floor(rnd() * 60), 0, 0);
    return d.toISOString();
  };

  const liste = [];
  for (let i = 0; i < 14; i++) {
    const tag = plusTage(heute, i);
    const maerkte = konfig.maerkte.filter((m) => m.tage.includes(wochentag(tag)));
    maerkte.forEach((m, mi) => {
      // Erster Markt heute: wie die Designvorlage – 2 offen, 1 abgeholt, 1 storniert.
      const vorlage = i === 0 && mi === 0 && !weihnachten;
      let n;
      if (vorlage) n = 4;
      else if (weihnachten) n = 3 + Math.floor(rnd() * 5);
      else if (i === 0) n = 2 + Math.floor(rnd() * 2);
      else {
        const r = rnd();
        n = r < 0.35 ? 0 : r < 0.8 ? 1 : 2;
      }
      for (let k = 0; k < n; k++) {
        const fest = vorlage ? VORLAGE[k] : (i === 0 && mi === 0 && k === 0 ? VORLAGE[1] : {});
        const b = {
          id: id(),
          datum: tag,
          markt: m.name,
          kunde: nimm(KUNDEN),
          bestellung: nimm(WAREN),
          kontakt: rnd() < 0.45 ? nimm(KONTAKTE) : '',
          kommentar: rnd() < 0.35 ? nimm(KOMMENTARE) : '',
          status: 'offen',
          erfasstVon: nimm(konfig.mitarbeiter),
          erfasstAm: zeitVor(1 + Math.floor(rnd() * 9), 8 + Math.floor(rnd() * 6)),
          erfasstUeber: m.fahrzeug,
          geaendertVon: '', geaendertAm: '',
          abgeholtAm: '',
          storniertVon: '', storniertAm: '',
          ...fest,
        };
        if (b.status === 'abgeholt') b.abgeholtAm = zeitVor(0, 10);
        if (b.status === 'storniert') { b.storniertVon = 'Ben'; b.storniertAm = zeitVor(1, 15); }
        liste.push(b);
      }
    });
  }

  // Damit „Storniert" auch an späteren Tagen vorkommt:
  const spaetere = liste.filter((b) => b.datum > heute);
  if (spaetere.length >= 3) {
    const b = spaetere[2];
    b.status = 'storniert';
    b.storniertVon = nimm(konfig.mitarbeiter);
    b.storniertAm = zeitVor(1, 15);
  }
  return liste;
}
