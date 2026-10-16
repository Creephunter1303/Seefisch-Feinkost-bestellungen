# Bestell Software 2.0 – Seefisch-Feinkost

Tablet-App (PWA) für Kundenbestellungen der Verkaufswagen. Löst v3 ab
(Handy-Web-App in `../Bestell Software/` – **nur lesen, nie ändern**).

- `app/` – Oberfläche: reines HTML/CSS/JS (ES-Module), kein Framework, kein Build.
  Lokal starten: `python3 werkzeuge/server.py` → http://localhost:8765 (ohne Zwischenspeicher).
- `app/js/daten/` – austauschbare Datenanbindung (Interface in `index.js`). Schritt 1: `demo.js`
  (Beispieldaten im Browser). Schritt 2: Apps Script.
- `backend/` – Google Apps Script (an die Tabelle gebunden) als JSON-Schnittstelle. Google-Tabelle
  „Fisch-Bestellungen" bleibt Quelle der Wahrheit. Ein Schlüssel **pro Tablet** im Blatt „Tablets"
  (vom Skript erzeugt, Spalte „Aktiv" sperrt); Einstellungen (Kalender „Bestellungen", Admin-PIN,
  Web-App-Adresse) im Blatt „Einstellungen". Anleitung: `docs/backend-einrichten.md`.
- Einrichtungs-Link `…/#api=<…/exec>&k=<Schlüssel>` → App speichert ihn (`sf_verbindung`) und
  nutzt `daten/appsscript.js`; ohne Einrichtung läuft der Prototyp (`daten/demo.js`). Im Prototyp-Modus
  lässt sich der Link auch einfügen (Willkommen + Einstellungen, `ansichten/link-einfuegen.js`) –
  nötig für die iPhone-Home-Bildschirm-App (eigener Speicher).
- Test ohne Google: `python3 werkzeuge/test_backend.py` (bildet die Schnittstelle nach, Port 8766).
- `docs/` – Anleitungen für Max, Deutsch, Klick für Klick.
- Veröffentlichung: GitHub Pages per Actions (`.github/workflows/pages.yml`, Ordner `app/`).
  **Repo ist öffentlich** → keine echten Mitarbeiternamen, keine Tabellen-ID, keine Schlüssel ins Repo.

## Feste Entscheidungen
- UI/Doku Deutsch, Begriffe wie am Wagen (Abholung, Kunde, Markt). UX-Regeln „Ein Blick, ein Tipp":
  Tippflächen ≥ 56 px, Kontraste nach UX-Regeln, Status immer Wort + Zeichen + Farbe.
- Design: **Designvorlage F6 v3 „Schlicht"** (`design-vorlage/`, PNGs + `vorlage.css` inkl. Abschnitte
  v2 und v3) ist verbindlich; Werte 1:1 in `app/app.css` (`alt-v1/`, `alt-v2/` nur zum Vergleich).
  Schriften Barlow / Barlow Condensed (selbst gehostet, `app/schriften/`). Bernstein (`--hinweis-*`,
  `--offline`) nur für Hinweise (fremde Ansicht, offline).
  Farbregel: Dunkelblau gefüllt NUR „Neue Bestellung". Blau = offen / aktive Auswahl,
  Grün = abgeholt (und der Kopf „Bestellung gespeichert"), Rot = storniert und Fehlermeldungen
  (z. B. „Nicht gespeichert – keine Verbindung"). Fehlende Pflichtfelder: roter Rahmen
  (`--rot-punkt`), Hinweis darunter rot + ⚠.
- Startseite (v3): Sync normal nur grüner Punkt (Tippen = aktualisieren), Text nur bei Problemen
  („Offline · Stand 6:42 · 1 wartet", orange). Tagesleiste „HEUTE · DI" … „WOCHE · KW 42";
  Woche zeigt Sa/So schon die nächste Woche.
- Waagerecht wischen auf der Startseite: links = nächster Tag mit Markt/Bestellung in der Ansicht,
  rechts = vorheriger (nicht vor heute); in „Woche" ganze Wochen.
- Markt ohne Bestellungen: nur der Markt-Kopf, kein graues „Keine Bestellungen"-Feld.
- Markt-Kopf ohne Zähler; Fahrzeug dezent (`.fz`, Lkw + Name, grau): in „Alle Märkte" immer,
  sonst nur bei fremdem Fahrzeug.
- Fremde Ansicht (≠ Standard-Ansicht): gelbes Hinweisband im klebenden Kopf (keine temp-leiste mehr),
  „Du siehst gerade … · <Tag>", Knopf „Zurück zu <Standard> · Heute" setzt Ansicht UND Tag zurück.
  Bloßer Tageswechsel zeigt kein Band.
- Offener Zettel auf der Startseite = `zettelSchlicht` (`.zettel-s`): Bestellung, darunter Kunde
  (+ `.kontakt-icon` Hörer bzw. Brief bei „@", wenn Kontakt hinterlegt), Kommentar fett mit Sprechblase,
  „⏳ wird gesendet", rechts `.haken` „Abgeholt?". Kontakt-Text nur in der Detailansicht.
  `.kontakt-icon` fehlt in vorlage.css → Maße aus F6-hochformat.png (Kreis 30 px).
- Erledigtes pro Markt: Einstellung „Erledigte Bestellungen einklappen" (Einstellungen → Anzeige,
  `sf_erledigte_einklappen`, Standard AN, pro Tablet, ohne PIN). AN → eine Zeile `.eingeklappt`
  „● 1 abgeholt ● 1 storniert anzeigen", Aufklappen pro Markt+Tag bis Neuladen/Tageswechsel.
  In der Suche immer ausgeklappt. Unterseiten (Formular, Detail, Bestätigung) noch im alten Zettel-Stil.
- Zettel-Typen: offen (weiß, blauer Rahmen), abgeholt (grün), storniert (rot, durchgestrichen,
  bleibt sichtbar). Reihenfolge: offen, abgeholt, storniert. Bestellung ist Freitext (Zeilenumbrüche bleiben).
- Status: offen → abgeholt, dazu storniert. „Abgeholt" = **zwei Tipps** (1. Tipp: Knopf 4 s „Nochmal tippen",
  gedämpftes Grün, gleiche Größe – Startseite `.haken.scharf`; 2. Tipp bestätigt), danach „Rückgängig" auf dem Zettel – ebenfalls
  zwei Tipps – plus 6 s Einblendung (wegwischbar, Rückgängig dort mit einem Tipp), ohne Mitarbeiter (Protokoll: Tablet). „Rückgängig" auf einem
  stornierten Zettel hebt das Storno auf. Neu/Bearbeiten/Stornieren: Mitarbeiter-Auswahl Pflicht.
- Tablet zeigt nur heute + Zukunft (62 Tage). Nicht Abgeholtes bleibt „offen" in der Tabelle.
- „Tablet abmelden" nur mit Admin-PIN (Ausnahme: Tablet gesperrt → zwei Tipps, PIN nicht prüfbar).
  Gesperrt: Start-Fehlerseite und Einstellungen bieten das Feld „Einrichtungs-Link einfügen".
- Alle Tablets haben dieselbe App. Standard-Ansicht beim ersten Start, Ändern nur mit Admin-PIN;
  vorübergehende Ansicht springt am nächsten Tag zurück.
- Kalender-Spiegelung bleibt, per Schalter in der Tabelle abschaltbar.
- Keine Geheimnisse im Repo: Server-Adresse + Zugangsschlüssel kommen per Einrichtungs-Link (#-Teil).

## Beim Ändern beachten
- Bei jeder Änderung an `app/`: `VERSION` in `app/sw.js` und `APP_VERSION` in `app/js/version.js`
  erhöhen; neue Dateien in die Liste in `sw.js` eintragen.
- Texte aus Eingaben nie als HTML einfügen – immer `h()` aus `js/ui.js`.
- Formulare nie komplett neu zeichnen (Tastatur/Fokus) – nur Abschnitte (`abschnittNeu`).
