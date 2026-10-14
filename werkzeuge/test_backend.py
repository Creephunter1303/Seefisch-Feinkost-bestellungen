#!/usr/bin/env python3
"""Test-Server, der die Schnittstelle von backend/Code.gs nachbildet – nur zum Testen am Mac.

Aufruf:  python3 werkzeuge/test_backend.py     (läuft auf http://127.0.0.1:8766/)
Dann in der App (python3 werkzeuge/server.py) öffnen:
  http://127.0.0.1:8765/#api=http%3A%2F%2F127.0.0.1%3A8766%2F&k=TESTSCHLUESSEL-NUR-LOKAL
Daten liegen nur im Speicher. Admin-PIN: 4711. Tablet „Seico".
"""
import datetime as dt
import hashlib
import http.server
import json

SCHLUESSEL = {"TESTSCHLUESSEL-NUR-LOKAL": "Seico", "GESPERRT-TESTSCHLUESSEL": None}
PIN = "4711"
KONFIG = {
    "mitarbeiter": ["Test-Anna", "Test-Ben"],
    "fahrzeuge": ["Seico", "Borco Neu", "Borco Alt"],
    "maerkte": [
        {"name": "REWE Groß Ilsede", "tage": [2], "fahrzeug": "Seico"},
        {"name": "Stadtmarkt Celle", "tage": [3, 6], "fahrzeug": "Borco Neu"},
        {"name": "Stadtmarkt Wolfsburg", "tage": [3, 6], "fahrzeug": "Seico"},
        {"name": "Uetze", "tage": [4], "fahrzeug": "Seico"},
        {"name": "Hildesheim", "tage": [6], "fahrzeug": "Borco Alt"},
    ],
}
BESTELLUNGEN = {}
PROTOKOLL = []


def jetzt():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def heute():
    return dt.date.today().isoformat()


def leer(id_, **felder):
    b = {"id": id_, "datum": "", "markt": "", "kunde": "", "bestellung": "", "kontakt": "", "kommentar": "",
         "status": "offen", "erfasstVon": "", "erfasstAm": jetzt(), "erfasstUeber": "", "geaendertVon": "",
         "geaendertAm": "", "abgeholtAm": "", "storniertVon": "", "storniertAm": ""}
    b.update(felder)
    return b


def startdaten():
    t = dt.date.today()
    for i in range(1, 8):
        d = t + dt.timedelta(days=i - 1)
        wt = (d.weekday() + 1) % 7  # Python: Mo=0 → JS: So=0
        for m in KONFIG["maerkte"]:
            if wt in m["tage"]:
                id_ = "B-TEST%04d" % (len(BESTELLUNGEN) + 1)
                BESTELLUNGEN[id_] = leer(id_, datum=d.isoformat(), markt=m["name"], kunde="Testkunde %d" % (len(BESTELLUNGEN) + 1),
                                         bestellung="1 kg Testfisch\n2 Probe-Makrelen", erfasstVon="Test-Anna", erfasstUeber="Seico")


def pruefen(a):
    for f in ("markt", "datum", "kunde", "bestellung", "mitarbeiter"):
        if not str(a.get(f, "")).strip():
            raise ValueError("Bitte alle Pflichtangaben ausfüllen.")
    if a["mitarbeiter"] not in KONFIG["mitarbeiter"]:
        raise ValueError("Unbekannter Mitarbeiter: " + a["mitarbeiter"])
    m = next((x for x in KONFIG["maerkte"] if x["name"] == a["markt"]), None)
    if not m:
        raise ValueError("Unbekannter Markt: " + a["markt"])
    d = dt.date.fromisoformat(a["datum"])
    if (d.weekday() + 1) % 7 not in m["tage"]:
        raise ValueError("Das Datum passt nicht zu den Markttagen.")
    if d < dt.date.today():
        raise ValueError("Das Datum liegt in der Vergangenheit.")


def bearbeiten(a):
    if a.get("schluessel") not in SCHLUESSEL or SCHLUESSEL[a.get("schluessel")] is None:
        return {"ok": False, "code": "schluessel", "fehler": "Dieses Tablet ist nicht (mehr) freigeschaltet."}
    tablet = SCHLUESSEL[a["schluessel"]]
    aktion = a.get("aktion")
    try:
        if aktion == "laden":
            liste = sorted((b for b in BESTELLUNGEN.values() if b["datum"] >= heute()), key=lambda b: b["id"])
            stand = hashlib.md5(json.dumps([KONFIG, liste], sort_keys=True).encode()).hexdigest()
            antwort = {"ok": True, "stand": stand, "tablet": {"name": tablet}}
            if a.get("stand") == stand:
                antwort["unveraendert"] = True
            else:
                antwort.update(konfig=KONFIG, bestellungen=liste)
            return antwort
        if aktion == "neu":
            if a["id"] in BESTELLUNGEN:
                return {"ok": True, "bestellung": BESTELLUNGEN[a["id"]]}
            pruefen(a)
            b = leer(a["id"], **{k: str(a.get(k, "")).strip() for k in ("datum", "markt", "kunde", "bestellung", "kontakt", "kommentar")},
                     erfasstVon=a["mitarbeiter"], erfasstUeber=tablet)
            BESTELLUNGEN[b["id"]] = b
            PROTOKOLL.append(("Erstellt", b["id"], tablet))
            return {"ok": True, "bestellung": b, "warnung": "Test: So sähe eine Kalender-Warnung aus."}
        b = BESTELLUNGEN.get(a.get("id"))
        if not b:
            raise ValueError("Diese Bestellung wurde nicht gefunden.")
        if aktion == "aendern":
            if b["status"] == "storniert":
                raise ValueError("Diese Bestellung ist storniert.")
            pruefen(a)
            b.update({k: str(a.get(k, "")).strip() for k in ("datum", "markt", "kunde", "bestellung", "kontakt", "kommentar")})
            b.update(geaendertVon=a["mitarbeiter"], geaendertAm=jetzt())
        elif aktion == "stornieren":
            if a.get("mitarbeiter") not in KONFIG["mitarbeiter"]:
                raise ValueError("Bitte antippen, wer storniert.")
            b.update(status="storniert", storniertVon=a["mitarbeiter"], storniertAm=jetzt())
        elif aktion == "status":
            if b["status"] == "storniert" and a["status"] == "abgeholt":
                raise ValueError("Die Bestellung wurde inzwischen storniert.")
            if b["status"] == "storniert":
                b.update(storniertVon="", storniertAm="")
            b.update(status=a["status"], abgeholtAm=(a.get("zeit") or jetzt()) if a["status"] == "abgeholt" else "")
        elif aktion == "pin":
            return {"ok": True, "richtig": a.get("pin") == PIN}
        else:
            return {"ok": False, "fehler": "Unbekannte Aktion"}
        PROTOKOLL.append((aktion, b["id"], tablet))
        return {"ok": True, "bestellung": b}
    except ValueError as e:
        return {"ok": False, "fehler": str(e)}


class Handler(http.server.BaseHTTPRequestHandler):
    def _antworten(self, obj):
        daten = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def do_GET(self):
        self._antworten({"ok": True, "info": "Test-Backend läuft", "protokoll": PROTOKOLL[-20:]})

    def do_POST(self):
        laenge = int(self.headers.get("Content-Length", 0))
        anfrage = json.loads(self.rfile.read(laenge) or b"{}")
        self._antworten(bearbeiten(anfrage))


if __name__ == "__main__":
    startdaten()
    print("Test-Backend auf http://127.0.0.1:8766/  (%d Testbestellungen)" % len(BESTELLUNGEN))
    http.server.ThreadingHTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
