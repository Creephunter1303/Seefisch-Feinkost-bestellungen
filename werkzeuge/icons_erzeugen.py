#!/usr/bin/env python3
"""Erzeugt die App-Symbole (weißer Fisch auf Meeresblau) ohne Zusatzbibliotheken.

Aufruf aus dem Projektordner:  python3 werkzeuge/icons_erzeugen.py
"""
import math
import os
import struct
import zlib

BLAU = (0x0B, 0x4A, 0x7A)
WEISS = (255, 255, 255)
ZIEL = os.path.join(os.path.dirname(__file__), "..", "app", "icons")


def im_fisch(x, y, s):
    """Liegt der Punkt (0..1 Koordinaten) im Fisch? s = Skalierung um die Mitte."""
    x = 0.5 + (x - 0.5) / s
    y = 0.5 + (y - 0.5) / s
    # Körper: Ellipse
    kx, ky, rx, ry = 0.44, 0.5, 0.27, 0.165
    im_koerper = ((x - kx) / rx) ** 2 + ((y - ky) / ry) ** 2 <= 1
    # Schwanzflosse: Dreieck
    ax, ay, bx, by, cx, cy = 0.64, 0.5, 0.83, 0.34, 0.83, 0.66

    def seite(px, py, qx, qy, rx_, ry_):
        return (px - rx_) * (qy - ry_) - (qx - rx_) * (py - ry_)

    d1 = seite(x, y, ax, ay, bx, by)
    d2 = seite(x, y, bx, by, cx, cy)
    d3 = seite(x, y, cx, cy, ax, ay)
    im_schwanz = not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    # Auge (wird ausgespart)
    im_auge = math.hypot(x - 0.31, y - 0.465) <= 0.03
    return (im_koerper or im_schwanz) and not im_auge


def im_hintergrund(x, y, gerundet):
    if not gerundet:
        return True
    r = 0.2  # Eckenradius
    cx = min(max(x, r), 1 - r)
    cy = min(max(y, r), 1 - r)
    return math.hypot(x - cx, y - cy) <= r


def zeichnen(groesse, gerundet, skalierung, unter=4):
    zeilen = []
    for py in range(groesse):
        zeile = bytearray([0])  # PNG-Filter „none"
        for px in range(groesse):
            hg = fisch = 0
            for sy in range(unter):
                for sx in range(unter):
                    x = (px + (sx + 0.5) / unter) / groesse
                    y = (py + (sy + 0.5) / unter) / groesse
                    if im_hintergrund(x, y, gerundet):
                        hg += 1
                        if im_fisch(x, y, skalierung):
                            fisch += 1
            n = unter * unter
            if hg == 0:
                zeile += bytes((0, 0, 0, 0))
                continue
            anteil = fisch / hg
            farbe = [round(BLAU[i] * (1 - anteil) + WEISS[i] * anteil) for i in range(3)]
            zeile += bytes((*farbe, round(255 * hg / n)))
        zeilen.append(bytes(zeile))
    return zeilen


def png_schreiben(pfad, groesse, zeilen):
    def block(typ, daten):
        return struct.pack(">I", len(daten)) + typ + daten + struct.pack(">I", zlib.crc32(typ + daten) & 0xFFFFFFFF)

    roh = b"".join(zeilen)
    with open(pfad, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(block(b"IHDR", struct.pack(">IIBBBBB", groesse, groesse, 8, 6, 0, 0, 0)))
        f.write(block(b"IDAT", zlib.compress(roh, 9)))
        f.write(block(b"IEND", b""))


def main():
    os.makedirs(ZIEL, exist_ok=True)
    for name, groesse, gerundet, skalierung in [
        ("icon-192.png", 192, True, 1.0),
        ("icon-512.png", 512, True, 1.0),
        # „maskable": Android schneidet selbst rund zu – Fisch kleiner, im sicheren Bereich
        ("icon-maskable-512.png", 512, False, 0.8),
    ]:
        png_schreiben(os.path.join(ZIEL, name), groesse, zeichnen(groesse, gerundet, skalierung))
        print("erzeugt:", name)


if __name__ == "__main__":
    main()
