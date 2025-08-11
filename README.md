# LCHM Fitness (GitHub Pages)

Dit is een **volledig client-side** versie van de app die **rechtstreeks op GitHub Pages** draait.
Er is **geen server** nodig: de Excel wordt in de browser ingelezen met SheetJS.

## Gebruik
1. Plaats alle bestanden in de root van je `milmas1.github.io` repo **of** in een submap (en pas links aan).
2. Zorg dat `data/BlokPeriodisering.xlsx` aanwezig is (meegeleverd).
3. Ga naar `https://<jouw-account>.github.io/` (of naar de submap).

## Local testen
Open `index.html` via een simpele webserver (vanwege fetch):
```bash
python -m http.server 8080
# open http://localhost:8080
```

## Belangrijk
- Door browser-beperkingen moet `index.html` via HTTP geladen worden (niet via `file://`), daarom GitHub Pages of een simpele lokale server.
- Alles wordt opgeslagen in `localStorage` (1RM’s en geschiedenis).
