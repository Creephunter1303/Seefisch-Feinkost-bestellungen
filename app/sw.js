// Service Worker: speichert nur die App selbst (schneller Start, installierbar).
// Bestelldaten gehen NIE über diesen Zwischenspeicher – sie kommen immer frisch vom Server.
//
// Bei jeder Änderung an der App VERSION erhöhen (und APP_VERSION in js/version.js),
// sonst bekommen die Tablets die neue Version nicht.

const VERSION = '0.1.0';
const CACHE = 'seefisch-app-' + VERSION;

const DATEIEN = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/main.js',
  './js/version.js',
  './js/speicher.js',
  './js/datum.js',
  './js/logik.js',
  './js/pruefung.js',
  './js/ui.js',
  './js/komponenten.js',
  './js/warteschlange.js',
  './js/daten/index.js',
  './js/daten/fehler.js',
  './js/daten/demo.js',
  './js/daten/beispieldaten.js',
  './js/ansichten/liste.js',
  './js/ansichten/formular.js',
  './js/ansichten/detail.js',
  './js/ansichten/bestaetigung.js',
  './js/ansichten/einstellungen.js',
  './js/ansichten/einrichtung.js',
  './js/ansichten/overlays.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('seefisch-app-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // Server-Anfragen nie anfassen
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((treffer) => treffer || fetch(e.request)));
});
