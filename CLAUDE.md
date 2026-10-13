# Bestell Software 2.0 – Seefisch-Feinkost

Tablet-App (PWA) für Kundenbestellungen der Verkaufswagen. Löst v3 ab
(Handy-Web-App in `../Bestell Software/` – **nur lesen, nie ändern**).

- `app/` – Oberfläche: reines HTML/CSS/JS (ES-Module), kein Framework, kein Build.
  Lokal starten: `python3 werkzeuge/server.py` → http://localhost:8765 (ohne Zwischenspeicher).
- `app/js/daten/` – austauschbare Datenanbindung (Interface in `index.js`). Schritt 1: `demo.js`
  (Beispieldaten im Browser). Schritt 2: Apps Script.
- `backend/` – Google Apps Script als JSON-Schnittstelle (Schritt 2). Google-Tabelle
  „Fisch-Bestellungen" bleibt Quelle der Wahrheit.
- `docs/` – Anleitungen für Max, Deutsch, Klick für Klick.

## Feste Entscheidungen
- UI/Doku Deutsch, Begriffe wie am Wagen (Abholung, Kunde, Markt). UX-Regeln „Ein Blick, ein Tipp":
  Tippflächen ≥ 64 px, Kontrast ≥ 7:1, Status immer Wort + Zeichen + Farbe;
  Orange = offen, Grün = abgeholt, Grau = storniert, Rot nur für Fehler/Stornieren.
- Status: offen → abgeholt, dazu storniert. „Abgeholt" = 2 Tipps (scharf, bestätigen) + 6 s Rückgängig,
  ohne Mitarbeiter (Protokoll: Tablet). Neu/Bearbeiten/Stornieren: Mitarbeiter-Auswahl Pflicht.
- Tablet zeigt nur heute + Zukunft (62 Tage). Nicht Abgeholtes bleibt „offen" in der Tabelle.
- Alle Tablets haben dieselbe App. Standard-Ansicht beim ersten Start, Ändern nur mit Admin-PIN;
  vorübergehende Ansicht springt am nächsten Tag zurück.
- Kalender-Spiegelung bleibt, per Schalter in der Tabelle abschaltbar.
- Keine Geheimnisse im Repo: Server-Adresse + Zugangsschlüssel kommen per Einrichtungs-Link (#-Teil).

## Beim Ändern beachten
- Bei jeder Änderung an `app/`: `VERSION` in `app/sw.js` und `APP_VERSION` in `app/js/version.js`
  erhöhen; neue Dateien in die Liste in `sw.js` eintragen.
- Texte aus Eingaben nie als HTML einfügen – immer `h()` aus `js/ui.js`.
- Formulare nie komplett neu zeichnen (Tastatur/Fokus) – nur Abschnitte (`abschnittNeu`).
