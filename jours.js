// Contenu du calendrier. Les textes sont à remplacer par les vrais messages.
window.CALENDRIER = {
  annee: 2026,

  // MODE TEST : true = toutes les cases s'ouvrent, comme si on était le 24 décembre.
  // À remettre à false avant d'envoyer le lien aux invitées.
  debloquerTout: false,

  // Décors 360° : un par jour (clé = numéro du jour où il apparaît). Image équirectangulaire 2:1 dans img/.
  // Ajouter le numéro du jour dans "fonds" dès que son décor est configuré ci-dessous.
  fonds: [1],
  decors: {
    1: {
      img: "img/fond-360.webp", w: 2912, h: 1440,
      // vue au départ (radians) et limites ; champ de vision vertical (degrés)
      vue: { yaw: 0, pitch: 0, pitchMin: -0.87, pitchMax: 0.75, fovPortrait: 88, fovPaysage: 80 },
      // chalet posé sur le meuble : u = colonne (pixels du décor), vBase = ligne du bas du chalet, larg = largeur angulaire (degrés)
      chalet: { u: 0, vBase: 1030, larg: 50 },
      // calque de neige : rectangle du décor couvert (u0 + largeur, avec raccord par le bord), v0 + hauteur
      region: { U0: 2000, V0: 560, RW: 1712, RH: 520 },
      // zones où la neige se dépose : polygones en (colonne - U0, ligne). chalet:true = le chalet masque le dessus
      // (désactivé : la neige ne se dépose plus que sur le toit du chalet) — remettre dans "zones" pour la réactiver
      zones: [],
      zonesDesactivees: [
        { nom: "meuble", chalet: true, budget: 3.2, rx: 1.9, ry: 0.85, a: [0.45, 0.75],
          pts: [[265,840],[340,812],[470,792],[620,795],[720,820],[800,845],[1040,845],[1080,815],[1180,790],[1300,788],[1420,805],[1500,848],
                [1460,900],[1400,935],[1300,970],[1200,998],[1100,1018],[1000,1030],[900,1036],[800,1030],[700,1018],[600,998],[500,975],[400,945],[330,915],[275,875]] },
        { nom: "sapin-gauche", budget: 1.1, rx: 1.3, ry: 1.1, a: [0.55, 0.85],
          pts: [[511,588],[520,615],[530,640],[545,670],[560,700],[568,725],[566,750],[560,768],[538,785],[520,798],[480,798],[455,770],[448,745],[455,720],[465,690],[478,660],[490,625],[505,600]] },
        { nom: "sapin-droit", budget: 1.1, rx: 1.3, ry: 1.1, a: [0.55, 0.85],
          pts: [[1250,598],[1260,630],[1270,650],[1284,680],[1300,705],[1307,730],[1310,760],[1292,785],[1270,798],[1212,798],[1202,770],[1195,745],[1204,720],[1222,690],[1237,660],[1244,630],[1248,605]] }
      ],
      // petits sapins des pots : guirlandes scintillantes + étoile (u, haut, bas, demi-largeur en pixels du décor)
      sapins: [
        { u: 2510, haut: 592, bas: 800, demi: 60, etoile: { R: 12, n: 5, rat: 0.46, coul: [1.0, 0.78, 0.28] } },     // à gauche : étoile dorée à 5 branches
        { u: 340,  haut: 614, bas: 800, demi: 50, etoile: { R: 13, n: 8, rat: 0.5,  coul: [0.88, 0.93, 1.0] } }     // à droite : étoile argentée à 8 branches
      ],
      // lumières déjà présentes dans la photo qui scintillent : grand sapin (axe u, haut v, bas v, demi-largeur max), guirlande de la cheminée
      // (rectangle u0, v0, u1, v1) et zone exclue (la fenêtre voisine du sapin)
      scintillements: { arbre: [1130, 560, 900, 140], guirlande: [1320, 625, 1710, 750], exclu: [1196, 500, 1330, 770] },
      // flammes qui vacillent : [u, v, demi-largeur, demi-hauteur] en pixels du décor
      flammes: [
        [1520, 822, 62, 42],                                   // feu de cheminée
        [1391, 612, 9, 15], [1416, 619, 8, 13], [1611, 609, 9, 15], [1631, 599, 9, 15],   // bougies de la cheminée
        [1366, 872, 9, 12], [1380, 858, 9, 12],                // bougies de l'âtre
        [2395, 764, 10, 20], [446, 764, 10, 20],               // bougies longues
        [2650, 886, 14, 14], [2692, 862, 14, 14], [203, 882, 14, 14], [266, 908, 14, 14]   // photophores
      ]
    }
  },

  // Musique : une seule pour l'instant (elle tourne en boucle). Pour en remettre plusieurs : déposer les .mp3
  // dans audio/ et les lister ici ; une sera alors tirée au hasard chaque jour, jamais la même deux jours de suite.
  musiques: [
    "audio/musique-noel-2.mp3"
  ],

  // Contenu derrière chaque fenêtre (clé = numéro du jour).
  // Champs : titre, texte (paragraphes séparés par une ligne vide), image (optionnel, ex. "img/surprise-01.webp")
  jours: {
    1: { titre: "Jour 1", texte: "Un compliment à écrire à une autre maman du groupe." },
    2: { titre: "Jour 2", texte: "Un petit plaisir à t’offrir cette semaine, rien que pour toi, pas de scrupule !" },
    3: { titre: "Jour 3", texte: "Une séance de gym ou de yoga de 15 minutes en vidéo à faire chez soi." },
    4: { titre: "Jour 4", texte: "La phrase qui te remonte le moral les mauvais jours." },
    5: { titre: "Jour 5", texte: "Une danse en famille sur une chanson de Noël, avec les enfants." },
    6: { titre: "Jour 6", texte: "Une balade en poussette ou à vélo avec les enfants, photo du trajet." },
    7: { titre: "Jour 7", texte: "Un selfie de maman en pyjama, sans filtre." },
    8: { titre: "Jour 8", texte: "Un café ou un goûter entre mamans à caler dans le mois." },
    9: { titre: "Jour 9", texte: "Une photo d’un moment drôle ou raté de la maison." },
    10: { titre: "Jour 10", texte: "Le portrait robot de la maman parfaite : chacune écrit en une phrase le superpouvoir qu’elle aimerait avoir (se dédoubler, dormir 8 heures, retrouver une chaussette en 2 secondes…), puis le groupe vote pour le plus utile." },
    11: { titre: "Jour 11", texte: "Le trophée du fail de la semaine : chacune raconte son plus beau ratage (lessive oubliée, gâteau cramé, rendez-vous manqué) et le groupe décerne un trophée imaginaire." },
    12: { titre: "Jour 12", texte: "Montrer à quoi ressemble ton sapin et ta décoration de Noël." },
    13: { titre: "Jour 13", texte: "La photo « avant / après » : poster la photo de la tête qu’on a le matin avant le café, et celle d’après. On vote pour la plus transformée." },
    14: { titre: "Jour 14", texte: "Partages un livre ou une série que tu recommandes aux autres." },
    15: { titre: "Jour 15", texte: "Défi gainage : tenir la planche le plus longtemps possible, avec le record de chacune." },
    16: { titre: "Jour 16", texte: "Écrire une lettre à toi-même d’il y a 5 ans, avec un ou deux conseils." },
    17: { titre: "Jour 17", texte: "Une recette de chocolat chaud, boisson d’hiver ou de gâteaux de Noël à partager." },
    18: { titre: "Jour 18", texte: "Le défi imitation : chacune imite en vidéo ou en message vocal la voix qu’elle prend quand elle gronde ses enfants (ou son mari), et les autres devinent qui c’est." },
    19: { titre: "Jour 19", texte: "Le CV improbable de maman : chacune écrit 3 « compétences » complètement absurdes et vraies de son quotidien (négociatrice professionnelle de brocolis, détective de doudous perdus, chauffeur VTC non rémunéré)." },
    20: { titre: "Jour 20", texte: "Un défi grimace ou fou rire avec ses enfants." },
    21: { titre: "Jour 21", texte: "Une chose gourmande à t’offrir cette semaine, sans culpabiliser." },
    22: { titre: "Jour 22", texte: "La phrase la plus drôle dite par tes enfants cette semaine." },
    23: { titre: "Jour 23", texte: "Une carte postale ou un petit mot manuscrit à envoyer à la maman de ton choix avant la fin de l'année." },
    24: { titre: "Jour 24", texte: "Votre meilleure photo en famille avec les pulls de Noël et la totale devant les cadeaux et le sapin." }
  }
};
