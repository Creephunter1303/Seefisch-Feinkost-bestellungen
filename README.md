# Seefisch-Feinkost · Bestellungen (Tablet-App)

Übersicht der Kundenbestellungen für die Verkaufswagen: „Diese Bestellungen muss ich heute
zurücklegen" – auf einen Blick, jede häufige Aktion mit einem Tipp.

**Stand:** Schritt 2 – Anbindung an die Google-Tabelle ist gebaut; Bereitstellung siehe [Backend einrichten](docs/backend-einrichten.md). Ohne Einrichtungs-Link läuft die App als Prototyp mit Beispieldaten.

**App:** https://creephunter1303.github.io/Seefisch-Feinkost-bestellungen/

## Ordner

| Ordner | Inhalt |
|---|---|
| `app/` | Die App selbst (wird veröffentlicht) |
| `docs/` | Anleitungen: [Prototyp testen](docs/test-prototyp.md), [Veröffentlichen](docs/veroeffentlichen.md) |
| `werkzeuge/` | Hilfsprogramme: lokaler Test-Server, App-Symbole erzeugen |
| `backend/` | Google Apps Script für die Tabelle ([Anleitung](docs/backend-einrichten.md)) |

## Lokal ausprobieren (am Mac)

```bash
python3 werkzeuge/server.py
```

Dann im Browser http://localhost:8765 öffnen.

## Schritte

1. **Prototyp** mit Beispieldaten – testen mit Mitarbeitern (5-Sekunden-Test) ← jetzt
2. **Echte Anbindung** an die Google-Tabelle (Apps Script), Test mit einer Kopie der Tabelle
3. **Umstieg**: Tablets einrichten, v3 abschalten
