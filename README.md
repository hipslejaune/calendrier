# calendrier2026

Calendrier de l'Avent 2026 : un chalet en bois posé sur un meuble, 24 fenêtres de tailles et de couleurs différentes,
neige qui s'écarte du curseur ou du doigt, grincement et halo de lumière à l'ouverture, une musique différente par jour.

## Règles
- Une fenêtre s'ouvre à partir de sa date (1er au 24 décembre 2026) ; les jours passés restent ouvrables, jamais les futurs.
- Pas de zoom, pas de clic droit.
- Essai : ajouter `?date=2026-12-05` à l'adresse pour simuler un jour.

## Fichiers
- `index.html`, `style.css`, `app.js` (chalet, fenêtres, sons), `neige.js` (neige)
- `jours.js` : **contenu de chaque jour**, liste des fonds et des musiques
- `img/jour-NN-desktop.webp` (2400 × 1350) et `img/jour-NN-mobile.webp` (1080 × 1920) : un fond par jour
- `audio/*.mp3` : musiques (une tirée au hasard par jour parmi la liste de `jours.js`)
