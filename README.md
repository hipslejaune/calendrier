# calendrier2026

Calendrier de l'Avent 2026 : un chalet en bois posé sur le meuble, 24 portes et fenêtres, neige qui s'écarte du curseur
ou du doigt, halo de lumière et grincement à l'ouverture, une musique en boucle.

## Règles
- Une case s'ouvre à partir de sa date (1er au 24 décembre 2026) ; les jours passés restent ouvrables, jamais les futurs.
- Pas de zoom, pas de clic droit.
- Essai : ajouter `?date=2026-12-05` à l'adresse pour simuler un jour.

## Fichiers
- `index.html`, `style.css`, `app.js` (portes, sons, cartes), `neige.js` (neige)
- `chalet.js` : zones cliquables du chalet (position de chaque porte sur l'image)
- `jours.js` : **contenu de chaque jour**, liste des fonds et des musiques
- `img/chalet-ferme.webp` : le chalet fermé (détouré)
- `img/jour-NN-desktop.webp` (2400 × 1350) et `img/jour-NN-mobile.webp` (1080 × 1920) : un fond par jour
- `audio/pizzicato-du-festival-dhiver.mp3` : la musique de fond (liste dans `jours.js`)

## Particularités du chalet
L'image n'a que 23 portes (deux « 18 », ni 3 ni 12) : la petite fenêtre carrée du bas porte le n° 12 (numéro recouvert)
et la cheminée sert de case n° 3.


## Décor 360° (depuis le 28/10)
- Chaque jour a un décor équirectangulaire 2:1 (ex. `img/fond-360.webp`), configuré dans `jours.js` → `decors[n]` (vue de départ, position du chalet, zones de neige, flammes).
- `vue.js` : affichage WebGL du 360°. Téléphone : gyroscope (le doigt ne déplace pas l'image). PC : clic-glisser ou flèches.
- La neige du meuble et des sapins est dessinée dans le repère de l'image 360° et suit le décor ; la neige du toit suit le chalet.
- Les flammes vacillent dans le shader (liste `flammes` : [u, v, demi-largeur, demi-hauteur] en pixels de l'image).
