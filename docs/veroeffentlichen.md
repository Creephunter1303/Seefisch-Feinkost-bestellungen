# App veröffentlichen (kostenlos)

Die App besteht nur aus Dateien im Ordner `app/`. Sie muss unter einer **https-Adresse**
erreichbar sein, damit sie sich auf dem Tablet installieren lässt. Es stehen weder Kundendaten
noch Zugangsschlüssel im Code – die Dateien selbst sind bei jedem Anbieter öffentlich abrufbar
(sonst könnte das Tablet sie nicht laden).

Das Repo liegt auf GitHub: `Creephunter1303/Seefisch-Feinkost-bestellungen` (privat).

## Variante A – Cloudflare Pages (Repo bleibt privat) · empfohlen

Kostenlos, auch für Firmen. Jedes Hochladen ins Repo veröffentlicht die App automatisch.

1. Auf **dash.cloudflare.com** ein kostenloses Konto anlegen (E-Mail bestätigen).
2. Links **„Workers & Pages"** → **„Erstellen"** / **„Create"**.
   Falls zuerst „Worker" angeboten wird: auf den Reiter bzw. Link **„Pages"** wechseln.
3. **„Mit Git verbinden"** / **„Connect to Git"** / **„Import an existing Git repository"** → GitHub wählen
   → Cloudflare den Zugriff erlauben, dabei **nur** das Repo `Seefisch-Feinkost-bestellungen` freigeben.
4. Einstellungen:
   - Projektname: `seefisch-bestellungen` (wird Teil der Adresse)
   - Produktionszweig: `main`
   - Framework-Voreinstellung: **Keine / None**
   - Build-Befehl: **leer lassen**
   - Build-Ausgabeverzeichnis: **`app`**
5. **„Speichern und bereitstellen"** / **„Save and Deploy"**.
6. Nach ca. 1 Minute ist die App erreichbar unter **`https://seefisch-bestellungen.pages.dev`**
   (die genaue Adresse zeigt Cloudflare an).

## Variante B – GitHub Pages (Repo wird öffentlich)

1. Repo auf github.com öffnen → **Settings** → ganz unten **„Change visibility"** → **Public**.
2. **Settings → Pages → Source: „GitHub Actions"**.
3. Mir Bescheid geben – ich lege dann die kleine Veröffentlichungs-Datei an.
   Adresse danach: `https://creephunter1303.github.io/Seefisch-Feinkost-bestellungen/`

## Updates

Neue Versionen lade ich ins Repo hoch; der Anbieter veröffentlicht sie automatisch.
Die Tablets holen sich die neue Version beim nächsten Öffnen der App von selbst.
