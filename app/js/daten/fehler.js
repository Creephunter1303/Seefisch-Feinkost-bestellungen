/** Server nicht erreichbar oder keine Antwort – es wurde NICHTS gespeichert, erneut versuchen. */
export class Verbindungsfehler extends Error {
  constructor(text) {
    super(text || 'Keine Verbindung zum Server.');
    this.name = 'Verbindungsfehler';
  }
}

/** Der Server hat geantwortet, aber abgelehnt (z. B. Bestellung inzwischen storniert). */
export class Serverfehler extends Error {
  constructor(text) {
    super(text || 'Der Server hat die Anfrage abgelehnt.');
    this.name = 'Serverfehler';
  }
}

/** Bricht nach `ms` mit einem Verbindungsfehler ab, statt ewig „Wird gespeichert …" zu zeigen. */
export function mitZeitlimit(versprechen, ms) {
  let timer;
  const zeitlimit = new Promise((_, ablehnen) => {
    timer = setTimeout(() => ablehnen(new Verbindungsfehler(
      'Keine Antwort vom Server (nach ' + Math.round(ms / 1000) + ' Sekunden).')), ms);
  });
  return Promise.race([versprechen, zeitlimit]).finally(() => clearTimeout(timer));
}
