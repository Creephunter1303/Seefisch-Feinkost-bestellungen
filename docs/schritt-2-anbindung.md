# Schritt 2: Anbindung an die Google-Tabelle – Ablauf

Ziel: Die App arbeitet mit den echten Daten aus der Tabelle „Fisch-Bestellungen" statt mit
Beispieldaten. Kalendertermine werden wie in v3 gespiegelt (abschaltbar).

Legende: **[Max]** = machst du (mit Klick-Anleitung von mir) · **[Claude]** = mache ich

## Stand (14.10.2026)

- ✅ A entschieden: Schlüssel **pro Tablet** (Blatt „Tablets"), direkt in der echten Tabelle,
  Code kopieren, Termine in den Kalender **„Bestellungen"** (nicht mehr Hauptkalender).
- ✅ C Tabelle vorbereitet (Spalten, Blätter „Einstellungen" und „Tablets", Sprache Deutsch).
- ✅ D Backend (`backend/Code.gs`) und ✅ E App-Anbindung gebaut, gegen einen Test-Server getestet.
- ⏳ B und F: deine Schritte – Anleitung: [backend-einrichten.md](backend-einrichten.md).

## A. Entscheidungen vorab

| # | Frage | Vorschlag |
|---|---|---|
| A1 | Ein Zugangsschlüssel für alle Tablets oder einer **pro Tablet**? | pro Tablet – ein verlorenes Tablet lässt sich einzeln sperren |
| A2 | Direkt in der echten Tabelle arbeiten oder erst in einer Kopie? | direkt in der echten – sie enthält nur eine Testbestellung, v3 wird nicht genutzt |
| A3 | Code per Kopieren in den Apps-Script-Editor oder per **clasp** (ich lade hoch)? | Kopieren reicht – es ist nur eine Datei; clasp bräuchte Node.js |
| A4 | In welchen Kalender sollen die Termine? | wie v3: Hauptkalender des Kontos, dem die Tabelle gehört |

## B. Vorbereitung

1. **[Max]** Tabelle → Teilen → allgemeiner Zugriff **„Eingeschränkt"** (Kundendaten!).
2. **[Max]** Alte v3-Web-App abschalten: im v3-Apps-Script-Projekt → Bereitstellen →
   Bereitstellungen verwalten → **Archivieren**. (Schreibt sonst weiter in dieselbe Tabelle.)

## C. Tabelle vorbereiten  **[Claude, nach deinem OK – über den Sheets-Zugang]**

- Blatt **Konfiguration**: Überschrift „Fahrzeug" in E1, Auswahlliste für die Fahrzeuge.
  (Spalte B „Code" aus v3 wird nicht mehr gebraucht und bleibt nur stehen.)
- Blatt **Bestellungen**: neue Spalten R–T „Abgeholt am", „Abgeholt über (Tablet)",
  „Erfasst über (Tablet)". Status-Werte künftig Offen / Abgeholt / Storniert
  (alter Wert „Aktiv" zählt als Offen). Die Testbestellung kann weg.
- Neues Blatt **Einstellungen**: Kalender-Spiegelung (Ja/Nein), Admin-PIN.
  **Die PIN trägst du selbst ein** – sie gehört nicht in den Chat und nicht ins Repo.
- Neues Blatt **Tablets** (bei A1 = pro Tablet): Name, Kennung, aktiv ja/nein.
- Tabellen-Sprache auf Deutsch (Datum als TT.MM.JJJJ).

## D. Backend bauen  **[Claude]**

`backend/Code.gs` + `appsscript.json` – Google Apps Script als reine Daten-Schnittstelle:

- Zugangsschlüssel prüfen (liegen in den Skript-Eigenschaften, nie im Code).
- Daten laden: Konfiguration + Bestellungen ab heute; antwortet „unverändert", wenn sich
  nichts geändert hat (spart Mobilfunk-Daten).
- Neu (kein doppeltes Anlegen bei erneutem Senden), Bearbeiten, Stornieren,
  Abgeholt / Rückgängig / Storno aufheben, Admin-PIN prüfen.
- Prüfung wie in v3 (Markt, Markttag, keine Vergangenheit, Pflichtfelder),
  Sperre gegen gleichzeitiges Schreiben, jede Aktion ins Blatt **Protokoll**.
- Kalender: anlegen, verschieben, „✓" bei Abgeholt, löschen bei Storno, neu bei Storno-Aufheben.
- Hilfsfunktion im Editor: erzeugt die Zugangsschlüssel und gibt die **Einrichtungs-Links** aus.

## E. App anbinden  **[Claude]**

- Datenquelle `app/js/daten/appsscript.js` (statt Beispieldaten).
- Einrichtungs-Link auswerten (Server-Adresse + Schlüssel im Teil hinter „#").
- Ohne Einrichtung: Hinweis „Dieses Tablet ist noch nicht eingerichtet".
- Prototyp-Streifen und Prototyp-Schalter nur noch im Beispiel-Modus.
- Mitarbeiter, Märkte, Fahrzeuge kommen live aus der Tabelle.

## F. Backend bereitstellen  **[Max, Klick für Klick]**

1. Tabelle öffnen → **Erweiterungen → Apps Script** (Skript direkt an der Tabelle).
2. `Code.gs` und `appsscript.json` einfügen, speichern.
3. Funktion **einrichten** einmal ausführen → Google fragt nach Berechtigungen → erlauben.
4. **Bereitstellen → Neue Bereitstellung → Web-App**: Ausführen als **Ich**, Zugriff **Jeder**.
5. Funktion **einrichtungsLinksAnzeigen** ausführen → Links aus dem Protokoll kopieren.

## G. Testen  **[gemeinsam]**

- Einrichtungs-Link auf **einem** Tablet öffnen → Fahrzeug wählen.
- Testliste: Neu · Bearbeiten (Markt/Tag) · Abgeholt · Rückgängig · Stornieren ·
  Storno aufheben · Kalendertermin prüfen · Protokoll prüfen · Flugmodus (Fehlermeldung,
  „Erneut senden", wartende Änderungen) · Änderung direkt in der Tabelle → erscheint nach
  spätestens 3 Minuten · zwei Tablets gleichzeitig.
- Admin-PIN ändern und prüfen.

## H. Umstieg

1. **[Max]** Testbestellungen in der Tabelle löschen.
2. **[Max]** Alle Tablets über ihren Einrichtungs-Link einrichten, App installieren.
3. **[Claude]** Einseitige Kurzanleitung für Mitarbeiter + Admin-Anleitung
   (Tablet sperren, neues Tablet einrichten, Märkte/Mitarbeiter pflegen, Schlüssel wechseln).
