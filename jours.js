// Contenu du calendrier. Les textes sont à remplacer par les vrais messages.
window.CALENDRIER = {
  annee: 2026,

  // MODE TEST : true = toutes les cases s'ouvrent, comme si on était le 24 décembre.
  // À remettre à false avant d'envoyer le lien aux invitées.
  debloquerTout: true,

  // Fonds : un jeu d'images par jour = img/jour-NN-desktop.webp et img/jour-NN-mobile.webp
  // Ajouter ici le numéro du jour dès que ses deux images sont dans img/.
  fonds: [1],

  // Flammes animées, par fond (clé = numéro du jour du fond). Coordonnées en pixels de l'image de fond.
  //  regions : zone de l'image à faire vaciller {sx, sy, sw, sh} (le haut de la zone = pointe de la flamme),
  //            amp = amplitude du frémissement (px image), vit = rapidité, p = concentration vers la pointe
  //  lueurs  : halo chaud qui pulse autour de la flamme {x, y, r, a}
  flammes: {
    1: {
      desktop: {
        w: 2400, h: 1350,
        regions: [
          { sx: 1921, sy: 799, sw: 32, sh: 30, amp: 1.1, vit: 1.0, p: 1.0 },     // bougie chauffe-plat 1
          { sx: 2039, sy: 820, sw: 32, sh: 30, amp: 1.1, vit: 1.15, p: 1.0 },    // bougie chauffe-plat 2
          { sx: 2252, sy: 590, sw: 42, sh: 48, amp: 2.2, vit: 0.9, p: 1.4 },     // grande bougie à droite
          { sx: 1869, sy: 192, sw: 42, sh: 38, amp: 1.6, vit: 1.0, p: 1.2 },     // bougie sur la cheminée
          { sx: 1826, sy: 225, sw: 42, sh: 36, amp: 1.6, vit: 1.1, p: 1.2 },     // bougie sur la cheminée
          { sx: 1630, sy: 645, sw: 150, sh: 118, amp: 5.5, vit: 1.0, p: 0.9 }    // feu de cheminée
        ],
        lueurs: [
          { x: 1937, y: 818, r: 30, a: 0.22 }, { x: 2055, y: 838, r: 30, a: 0.22 },
          { x: 2273, y: 618, r: 48, a: 0.26 }, { x: 1890, y: 212, r: 42, a: 0.2 }, { x: 1847, y: 244, r: 38, a: 0.2 },
          { x: 1708, y: 712, r: 120, a: 0.3 }, { x: 1755, y: 722, r: 60, a: 0.16 }
        ]
      },
      mobile: null
    }
  },

  // Musique : une seule pour l'instant (elle tourne en boucle). Pour en remettre plusieurs : déposer les .mp3
  // dans audio/ et les lister ici ; une sera alors tirée au hasard chaque jour, jamais la même deux jours de suite.
  musiques: [
    "audio/pizzicato-du-festival-dhiver.mp3"
  ],

  // Contenu derrière chaque fenêtre (clé = numéro du jour).
  // Champs : titre, texte (paragraphes séparés par une ligne vide), image (optionnel, ex. "img/surprise-01.webp")
  jours: {
    1: {
      titre: "Premier jour !",
      texte: "Bienvenue dans le calendrier de l'Avent 2026.\n\n(Texte du jour 1 à remplacer.)"
    }
  }
};
