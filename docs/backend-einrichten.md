# Backend einrichten – Klick für Klick (ca. 15 Minuten)

Das Backend ist ein Google-Apps-Script, das direkt an der Tabelle „Fisch-Bestellungen" hängt.
Es liefert der Tablet-App die Daten und schreibt Bestellungen, Protokoll und Kalendertermine.

Alles mit **dem Google-Konto** machen, dem die Tabelle und der Kalender „Bestellungen" gehören.

## 0. Vorher (falls noch nicht erledigt)

- Tabelle → **Teilen** → Allgemeiner Zugriff → **Eingeschränkt**.
- Alte v3-Web-App abschalten: im **alten** Apps-Script-Projekt (v3) → **Bereitstellen** →
  **Bereitstellungen verwalten** → Bereitstellung auswählen → **Archivieren**.

## 1. Skript in die Tabelle einfügen

1. Tabelle „Fisch-Bestellungen" öffnen → Menü **Erweiterungen → Apps Script**.
   Es öffnet sich ein neuer Tab mit dem Skript-Editor.
   ⚠ Meldung **„Datei kann derzeit nicht geöffnet werden"**? Das passiert, wenn im Browser mehrere
   Google-Konten angemeldet sind. Dann: **Inkognito-Fenster** öffnen, nur mit dem Konto anmelden,
   dem die Tabelle gehört, Tabelle öffnen und noch einmal **Erweiterungen → Apps Script**.
   (Ein „normal" unter script.google.com angelegtes Projekt lässt sich nicht nachträglich an die
   Tabelle hängen – das Skript muss über dieses Menü entstehen.)
2. Oben links auf „Unbenanntes Projekt" klicken → Namen **Bestell-App 2.0** eingeben → Umbenennen.
3. Links die Datei **Code.gs** anklicken, den gesamten Inhalt löschen und durch diesen Code ersetzen:
   https://raw.githubusercontent.com/Creephunter1303/Seefisch-Feinkost-bestellungen/main/backend/Code.gs
   (Link öffnen → alles markieren → kopieren → im Editor einfügen).
4. Links auf das **Zahnrad (Projekteinstellungen)** → Haken bei
   **„Manifestdatei appsscript.json im Editor anzeigen"**.
5. Zurück zum Editor (links „< >"), Datei **appsscript.json** öffnen, Inhalt ersetzen durch:
   https://raw.githubusercontent.com/Creephunter1303/Seefisch-Feinkost-bestellungen/main/backend/appsscript.json
6. Oben auf **Speichern** (Disketten-Symbol).

## 2. Einrichten und Berechtigungen erteilen

1. Zum Tab mit der **Tabelle** wechseln und die Seite **neu laden**.
   Nach ein paar Sekunden erscheint oben das Menü **„Bestell-App"**.
2. **Bestell-App → Einrichten / prüfen**.
3. Google fragt nach Berechtigungen: **Fortfahren** → Konto wählen → bei „Google hat diese App
   nicht überprüft" auf **Erweitert** → **„Zu Bestell-App 2.0 (unsicher) wechseln"** → **Zulassen**.
   (Das ist normal bei eigenen Skripten – es ist dein eigenes Skript.)
4. Danach noch einmal **Bestell-App → Einrichten / prüfen**. Ein Fenster zeigt die Prüfung,
   im Blatt **„Tablets"** stehen jetzt Schlüssel für jedes Tablet.
5. Im Blatt **„Einstellungen"** bei **Admin-PIN** (Spalte B) eine 4-stellige PIN eintragen.

## 3. Als Web-App bereitstellen

1. Im Skript-Editor oben rechts **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad neben „Typ auswählen" → **Web-App**.
3. Beschreibung: `Bestell-App` · **Ausführen als: Ich** · **Zugriff: Jeder**
   (⚠ nicht „Jeder mit Google-Konto" – sonst müssten die Tablets sich bei Google anmelden).
4. **Bereitstellen** → ggf. Berechtigungen wie oben bestätigen.
5. Die **Web-App-URL** kopieren (endet auf `/exec`).
6. In der Tabelle, Blatt **„Einstellungen"**, bei **Web-App-Adresse** (Spalte B) einfügen.
7. **Bestell-App → Einrichten / prüfen** – jetzt sollte überall ✓ stehen.

## 4. Erstes Tablet einrichten

1. Blatt **„Tablets"**, Spalte **D**: Der Einrichtungs-Link für das Tablet (z. B. Seico).
2. Den Link aufs Tablet bringen (z. B. per E-Mail an dich selbst) und **in Chrome** öffnen.
3. Die App meldet „Verbunden mit der Google-Tabelle" → Fahrzeug antippen.
   Der gelbe Prototyp-Streifen ist weg – ab jetzt sind es echte Daten.
4. War die App schon auf dem Startbildschirm installiert: danach einfach wieder von dort öffnen.
5. **iPhone/iPad mit App auf dem Home-Bildschirm:** Die Home-Bildschirm-App hat einen eigenen
   Speicher und übernimmt die Verbindung aus Safari **nicht**. Dann: Link kopieren → App vom
   Home-Bildschirm öffnen → Zahnrad (Einstellungen) → **Einrichtungs-Link einfügen** →
   „Aus Zwischenablage einfügen" → **Verbinden**. (Geht auch direkt auf dem Willkommen-Bildschirm.)

## Tablets verwalten

| Aufgabe | So geht's |
|---|---|
| Tablet sperren (verloren/gestohlen) | Blatt „Tablets" → Spalte **Aktiv** auf **Nein**. Wirkt sofort. |
| Neuen Schlüssel vergeben | In die Zeile des Tablets klicken → **Bestell-App → Neuen Schlüssel für markiertes Tablet**. Danach Tablet mit dem neuen Link (Spalte D) neu einrichten. |
| Weiteres Tablet | Neue Zeile mit Namen → **Einrichten / prüfen** erzeugt Schlüssel und Link. |
| Wann war ein Tablet zuletzt online? | Spalte **Zuletzt gesehen**. |
| Kalender aus-/einschalten | Blatt „Einstellungen" → Kalender-Spiegelung **Ja/Nein**. |
| Märkte, Fahrzeuge, Mitarbeiter | Blatt „Konfiguration" wie bisher – die Tablets übernehmen es beim nächsten Aktualisieren. |

## Wenn ich später neuen Code schicke

Code wie in Schritt 1 ersetzen und speichern → **Bereitstellen → Bereitstellungen verwalten** →
Stift-Symbol → Version: **Neue Version** → **Bereitstellen**. Die Web-App-Adresse bleibt gleich.

⚠ **Nicht** „Neue Bereitstellung" wählen und die alte archivieren: Das ergibt eine **neue Adresse**,
und alle Tablets verlieren die Verbindung. Dann neue Adresse ins Blatt „Einstellungen" und jedes
Gerät noch einmal über seinen Link (Spalte D) einrichten.
