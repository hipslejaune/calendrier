// Contenu du calendrier. Les textes sont à remplacer par les vrais messages.
window.CALENDRIER = {
  annee: 2026,

  // MODE TEST : true = toutes les cases s'ouvrent, comme si on était le 24 décembre.
  // À remettre à false avant d'envoyer le lien aux invitées.
  debloquerTout: true,

  // Fonds : un jeu d'images par jour = img/jour-NN-desktop.webp et img/jour-NN-mobile.webp
  // Ajouter ici le numéro du jour dès que ses deux images sont dans img/.
  fonds: [1],

  // Musiques : une par jour, tirée au hasard dans cette liste (la même pour tout le monde
  // un jour donné, jamais deux jours de suite la même). Pour en ajouter : déposer le .mp3
  // dans audio/ et ajouter une ligne ici.
  musiques: [
    "audio/pizzicato-du-festival-dhiver.mp3",
    "audio/valse-de-la-bote-musique-enchante.mp3",
    "audio/voyage-pixlis.mp3"
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
