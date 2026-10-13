#!/usr/bin/env python3
"""Lokaler Test-Server für die App – ohne Zwischenspeicher, damit Änderungen sofort sichtbar sind.

Aufruf aus dem Projektordner:  python3 werkzeuge/server.py   → http://localhost:8765
Für einen Test am Tablet im selben WLAN:  python3 werkzeuge/server.py --wlan
"""
import functools
import http.server
import os
import sys

ORDNER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")


class OhneCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".webmanifest": "application/manifest+json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # Die App lädt ~20 Dateien gleichzeitig; Standard (5) führt zu abgebrochenen Verbindungen.
    request_queue_size = 64


def main():
    adresse = "0.0.0.0" if "--wlan" in sys.argv else "127.0.0.1"
    handler = functools.partial(OhneCache, directory=ORDNER)
    with Server((adresse, 8765), handler) as server:
        print("App läuft auf http://localhost:8765  (Beenden mit Strg+C)")
        server.serve_forever()


if __name__ == "__main__":
    main()
