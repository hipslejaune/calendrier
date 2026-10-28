(function () {
  "use strict";
  var CAL = window.CALENDRIER;
    var carte = document.getElementById("carte");
  var toast = document.getElementById("toast");
  var boutonSon = document.getElementById("son");

  /* ---------- Date du jour (le paramètre ?date=2026-12-05 sert aux essais) ---------- */
  var params = new URLSearchParams(location.search);
  var essai = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : null;
  function maintenant() {
    if (essai) { var p = essai.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
    return new Date();
  }
  // Dernier jour ouvrable : 0 avant le 1er décembre, 1..24 en décembre, 24 ensuite.
  function jourCourant() {
    var d = maintenant(), a = d.getFullYear(), m = d.getMonth();
    if (a < CAL.annee || (a === CAL.annee && m < 11)) return 0;
    if (a > CAL.annee || (a === CAL.annee && d.getDate() >= 24)) return 24;
    return d.getDate();
  }
  var AUJ = CAL.debloquerTout ? 24 : jourCourant();
  var jourRef = Math.max(1, Math.min(24, AUJ));        // jour qui décide du fond et de la musique
  function dateTexte(n) { return (n === 1 ? "1er" : n) + " décembre"; }

  /* ---------- Stockage léger (fenêtres déjà ouvertes, son) ---------- */
  var cleOuvertes = "calendrier" + CAL.annee + (essai ? "-essai" : "") + "-ouvertes";
  var cleSon = "calendrier" + CAL.annee + "-son";
  function lire(cle, defaut) { try { var v = localStorage.getItem(cle); return v === null ? defaut : JSON.parse(v); } catch (e) { return defaut; } }
  function ecrire(cle, val) { try { localStorage.setItem(cle, JSON.stringify(val)); } catch (e) {} }
  var ouvertes = lire(cleOuvertes, []);
  if (!Array.isArray(ouvertes)) ouvertes = [];
  ouvertes = ouvertes.filter(function (n) { return n <= AUJ; });
  var muet = lire(cleSon, false) === true;

  /* ---------- Hasard reproductible ---------- */
  function graine(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Portes du chalet (zones issues de chalet.js) ---------- */
  var CH = window.CHALET, RATIO = CH.ratio;
  var FENETRES_DOUBLES = [4, 5, 7, 8, 9, 10, 18];          // deux battants (le reste : une seule porte)
  var CHARNIERE_DROITE = [1, 14];                           // porte qui s'ouvre côté droit
  var ARCHE = [1, 2, 10], ROND = [9];
  var CHEMINEE = 3, PETIT_DOUZE = 12;                       // cases ajoutées (voir chalet.js)
  var portes = document.getElementById("portes");
  var boutons = {};

  function fond(fx, fy, fw, fh) {
    return "background-size:" + (100 / fw).toFixed(3) + "% " + (100 / fh).toFixed(3) + "%;" +
           "background-position:" + (fx / (1 - fw) * 100).toFixed(3) + "% " + (fy / (1 - fh) * 100).toFixed(3) + "%;";
  }
  /* Décors vus par les fenêtres (img/fenetres/fNN.webp, largeur/hauteur ci-dessous) : on attribue à chaque fenêtre celui dont les proportions
     lui vont le mieux, en répartissant pour limiter les doublons. */
  var DECORS_FEN = [[1, 1.29], [2, 1.16], [3, .66], [4, 2.11], [5, .61], [6, 1.46], [7, 1.37], [8, 1.27], [9, .61], [10, .47], [11, .85], [12, .94], [13, 1.35], [14, .58], [15, .91], [16, 1.04], [17, .95], [18, 1.12], [19, 1.29], [20, .63], [21, 1.71], [22, 1.77]];
  // L'image 23 (le Père Noël et ses lutins) est partagée par les cases 13 et 14, qui donnent sur la même pièce.
  var IMG_COMMUNE = { n: 23, asp: 1.42, cases: [13, 14] };
  var AVEC_BARREAUX = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 18, 19];       // images qui ont déjà leurs croisillons : on n'en rajoute pas
  var decorDe = {}, decorNum = {}, decorPos = {};
  (function () {
    var emploi = DECORS_FEN.map(function () { return 0; });
    for (var n = 1; n <= 24; n++) {
      var bx = CH.boxes[n]; if (!bx || n === CHEMINEE || IMG_COMMUNE.cases.indexOf(n) >= 0) continue;
      var asp = bx[2] * RATIO / bx[3], best = 0, bc = 1e9;
      DECORS_FEN.forEach(function (d, i) {
        var c = Math.abs(Math.log(asp / d[1])) + 1.6 * emploi[i];
        if (c < bc) { bc = c; best = i; }
      });
      emploi[best]++;
      decorNum[n] = DECORS_FEN[best][0];
      decorDe[n] = "img/fenetres/f" + (DECORS_FEN[best][0] < 10 ? "0" : "") + DECORS_FEN[best][0] + ".webp";
    }
    // image commune : on l'étale sur le rectangle qui réunit les deux ouvertures, chacune en montre sa part
    var bs = IMG_COMMUNE.cases.map(function (n) { return CH.boxes[n]; });
    var ux = Math.min.apply(null, bs.map(function (b) { return b[0]; })), uy = Math.min.apply(null, bs.map(function (b) { return b[1]; }));
    var ux2 = Math.max.apply(null, bs.map(function (b) { return b[0] + b[2]; })), uy2 = Math.max.apply(null, bs.map(function (b) { return b[1] + b[3]; }));
    var Uw = ux2 - ux, Uh = (uy2 - uy) / RATIO, iw, ih;                       // hauteurs exprimées en « largeurs de chalet »
    if (Uw / Uh > IMG_COMMUNE.asp) { iw = Uw; ih = Uw / IMG_COMMUNE.asp; } else { ih = Uh; iw = Uh * IMG_COMMUNE.asp; }
    var ix = ux + (Uw - iw) / 2, iy = uy / RATIO + (Uh - ih) / 2;
    IMG_COMMUNE.cases.forEach(function (n, k) {
      var b = CH.boxes[n], bh = b[3] / RATIO, by = b[1] / RATIO;
      var px = iw - b[2] > 1e-6 ? (b[0] - ix) / (iw - b[2]) * 100 : 50, py = ih - bh > 1e-6 ? (by - iy) / (ih - bh) * 100 : 50;
      decorNum[n] = IMG_COMMUNE.n;
      decorDe[n] = "img/fenetres/f" + IMG_COMMUNE.n + ".webp";
      decorPos[n] = "--bs:" + (iw / b[2] * 100).toFixed(2) + "% " + (ih / bh * 100).toFixed(2) + "%;--bp:" + px.toFixed(2) + "% " + py.toFixed(2) + "%";
    });
  })();
  // Luminosité moyenne de chaque décor : les lutins sont « multipliés » par la scène (ils passent derrière les barreaux et prennent la
  // lumière de la pièce), donc on les éclaircit d'autant plus que le décor est sombre.
  var decorLum = {};
  (function () {
    var cache = {};
    Object.keys(decorDe).forEach(function (n) {
      var src = decorDe[n];
      if (cache[src] !== undefined) { decorLum[n] = cache[src]; return; }
      cache[src] = .4; decorLum[n] = .4;
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = c.height = 24; var x = c.getContext("2d"); x.drawImage(im, 0, 0, 24, 24);
          var d = x.getImageData(0, 0, 24, 24).data, s = 0, k = 0;
          for (var i = 0; i < d.length; i += 4) { s += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; k++; }
          cache[src] = s / k;
          Object.keys(decorDe).forEach(function (m) { if (decorDe[m] === src) decorLum[m] = cache[src]; });
        } catch (e) {}
      };
      im.src = src;
    });
  })();
  function construire() {
    portes.textContent = "";
    for (var n = 1; n <= 24; n++) {
      var bx = CH.boxes[n]; if (!bx) continue;
      var x = bx[0], y = bx[1], w = bx[2], h = bx[3];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "porte" + (n === CHEMINEE ? " cheminee" : "") + (n > AUJ ? " futur" : "") +
                    (n === AUJ ? " aujourdhui" : "") + (ouvertes.indexOf(n) >= 0 ? " ouverte" : "");
      b.dataset.jour = n;
      b.setAttribute("aria-label", n > AUJ ? "Case du " + dateTexte(n) + " (pas encore ouvrable)" : "Ouvrir la case du " + dateTexte(n));

      var rv = (50 * w * RATIO / h).toFixed(2);              // rayon vertical d'une arche, en % de la hauteur
      var rad = ARCHE.indexOf(n) >= 0 ? "50% 50% 0 0 / " + rv + "% " + rv + "% 0 0"
              : ROND.indexOf(n) >= 0 ? "50%" : ".3cqw";
      b.style.cssText = "left:" + (x * 100).toFixed(3) + "%;top:" + (y * 100).toFixed(3) + "%;width:" +
                        (w * 100).toFixed(3) + "%;height:" + (h * 100).toFixed(3) + "%;--rad:" + rad;

      var fs = Math.min(bx[2] * 0.7, bx[3] / RATIO * 0.5) * 100;        // taille du chiffre « revu » au survol (en % de la largeur du chalet)
      var html = '<span class="interieur"' + (decorDe[n] ? ' style="--img:url(' + decorDe[n] + ');' + (decorPos[n] || "") + '"' : "") + '></span><span class="halo"></span>' + (n === CHEMINEE ? "" : '<span class="revoir" style="font-size:' + fs.toFixed(2) + 'cqw">' + n + '</span>');
      if (n === CHEMINEE) {
        html += '<span class="fumee"><i></i><i></i><i></i></span><span class="chiffre">3</span>';
      } else if (FENETRES_DOUBLES.indexOf(n) >= 0) {
        var rg, rd;
        if (ROND.indexOf(n) >= 0) { rg = "100% 0 0 100% / 50% 0 0 50%"; rd = "0 100% 100% 0 / 0 50% 50% 0"; }
        else if (ARCHE.indexOf(n) >= 0) { rg = "100% 0 0 0 / " + rv + "% 0 0 0"; rd = "0 100% 0 0 / 0 " + rv + "% 0 0"; }
        else { rg = rd = ".3cqw"; }
        html += '<span class="vantail g" style="border-radius:' + rg + '"><span class="face" style="' + fond(x, y, w / 2, h) + '"></span><span class="dos"></span></span>' +
                '<span class="vantail d" style="border-radius:' + rd + '"><span class="face" style="' + fond(x + w / 2, y, w / 2, h) + '"></span><span class="dos"></span></span>';
      } else {
        var cote = CHARNIERE_DROITE.indexOf(n) >= 0 ? "r" : "l";
        var plus = n === PETIT_DOUZE ? '<span class="rustine"><span class="chiffre">12</span></span>' : "";
        html += '<span class="vantail ' + cote + '" style="border-radius:' + rad + '"><span class="face" style="' + fond(x, y, w, h) + '">' + plus + '</span><span class="dos"></span></span>';
      }
      b.innerHTML = html;
      portes.appendChild(b);
      boutons[n] = b;
    }
  }
  construire();

  /* ---------- Sons : grincement synthétisé + musique du jour ---------- */
  var ac = null;
  function contexte() {
    if (!ac) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
    if (ac && ac.state === "suspended") ac.resume();
    return ac;
  }
  var comp = null;
  function maitre(c) {                                   // limiteur : le grincement peut être fort sans saturer
    if (!comp) { comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8; comp.connect(c.destination); }
    return comp;
  }
  function grincement() {
    if (muet) return;
    var c = contexte(); if (!c) return;
    var t = c.currentTime, dur = 1.15;

    var osc = c.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.linearRampToValueAtTime(205, t + .3);
    osc.frequency.linearRampToValueAtTime(165, t + .62);
    osc.frequency.linearRampToValueAtTime(250, t + dur);
    var vib = c.createOscillator(), vibG = c.createGain();   // petit tremblement de hauteur
    vib.frequency.value = 9; vibG.gain.value = 14;
    vib.connect(vibG); vibG.connect(osc.frequency);

    var am = c.createGain(); am.gain.value = .5;             // saccades « frottement »
    var lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.type = "square"; lfo.frequency.setValueAtTime(23, t); lfo.frequency.linearRampToValueAtTime(41, t + dur);
    lfoG.gain.value = .5; lfo.connect(lfoG); lfoG.connect(am.gain);

    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 5;
    bp.frequency.setValueAtTime(850, t); bp.frequency.linearRampToValueAtTime(1500, t + dur);

    var env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1.1, t + .08);
    env.gain.setValueAtTime(1.1, t + dur - .25);
    env.gain.linearRampToValueAtTime(0, t + dur);

    osc.connect(am); am.connect(bp); bp.connect(env); env.connect(maitre(c));
    [osc, vib, lfo].forEach(function (o) { o.start(t); o.stop(t + dur + .05); });

    // petit « toc » du bois en fin de course
    var n = c.createBuffer(1, Math.floor(c.sampleRate * .12), c.sampleRate), d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    var src = c.createBufferSource(); src.buffer = n;
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    var g2 = c.createGain(); g2.gain.value = .9;
    src.connect(lp); lp.connect(g2); g2.connect(maitre(c)); src.start(t + dur - .02);
  }

  // Musique du jour : tirée au hasard (reproductible) dans la liste, jamais la même deux jours de suite.
  function musiqueDuJour(jour) {
    var l = CAL.musiques || [];
    if (!l.length) return null;
    var r = graine(7919), prec = -1, choix = 0;
    for (var d = 1; d <= jour; d++) {
      var idx;
      if (l.length === 1) idx = 0;
      else { do { idx = Math.floor(r() * l.length); } while (idx === prec); }
      choix = prec = idx;
    }
    return l[choix];
  }
  var piste = musiqueDuJour(jourRef), musique = null;
  if (piste) {
    musique = new Audio(piste);
    musique.loop = true; musique.volume = .16; musique.preload = "auto";
  }
  var demarre = false;
  function jouerMusique() {
    if (!musique || muet || document.hidden) return;
    var p = musique.play();
    if (p && p.then) p.then(function () { demarre = true; }, function () {});
  }
  function premierGeste() {                                   // si le navigateur a refusé le départ automatique, le 1er geste lance la musique
    if (demarre) return;
    contexte(); jouerMusique();
  }
  ["pointerdown", "touchend", "click", "keydown"].forEach(function (t) { window.addEventListener(t, premierGeste, { passive: true }); });
  jouerMusique();                                             // départ automatique dès le chargement (accepté selon le navigateur)
  setTimeout(jouerMusique, 600);
  document.addEventListener("visibilitychange", function () {
    if (!musique) return;
    if (document.hidden) musique.pause(); else if (demarre) jouerMusique();
  });

  function majBoutonSon() {
    boutonSon.classList.toggle("muet", muet);
    boutonSon.setAttribute("aria-label", muet ? "Activer le son" : "Couper le son");
  }
  boutonSon.addEventListener("click", function () {
    muet = !muet; ecrire(cleSon, muet); majBoutonSon();
    demarre = true;
    if (muet) { if (musique) musique.pause(); } else { contexte(); jouerMusique(); }
  });
  majBoutonSon();

  /* ---------- Fermer toutes les portes ---------- */
  var boutonFermer = document.getElementById("fermer");
  var boutonOuvrir = document.getElementById("ouvrir");
  function majFermer() {
    boutonFermer.disabled = ouvertes.length === 0;
    var reste = false;                                    // reste-t-il une case disponible (jusqu'à aujourd'hui) encore fermée ?
    for (var n = 1; n <= AUJ; n++) if (boutons[n] && ouvertes.indexOf(n) < 0) { reste = true; break; }
    boutonOuvrir.disabled = !reste;
  }
  boutonOuvrir.addEventListener("click", function () {
    premierGeste();
    fermerCarte();
    var aOuvrir = [];
    for (var n = 1; n <= AUJ; n++) if (boutons[n] && ouvertes.indexOf(n) < 0) aOuvrir.push(n);
    if (!aOuvrir.length) return;
    aOuvrir.forEach(function (n, i) {                       // elles s'ouvrent l'une après l'autre
      setTimeout(function () {
        if (!boutons[n] || boutons[n].classList.contains("ouverte")) return;
        boutons[n].classList.add("ouverte");
        if (ouvertes.indexOf(n) < 0) { ouvertes.push(n); ecrire(cleOuvertes, ouvertes); majFermer(); }
        ouvertA[n] = Date.now(); majVitres(); setTimeout(majMasqueLutins, 1350);
        if (i % 3 === 0) grincement();
      }, i * 170);
    });
    message("Toutes les portes disponibles s'ouvrent 🎄");
  });
  boutonFermer.addEventListener("click", function () {
    if (!ouvertes.length) return;
    premierGeste();
    fermerCarte();
    Object.keys(boutons).forEach(function (n) { boutons[n].classList.remove("ouverte"); });
    ouvertes = []; ecrire(cleOuvertes, ouvertes);
    majMasqueLutins();
    grincement();
    majFermer();
    message("Les portes sont refermées 🎄");
  });

  /* ---------- Message temporaire ---------- */
  window.MESSAGE = function (t) { message(t); };
  var minuteurToast = 0;
  function message(txt) {
    toast.textContent = txt; toast.classList.add("visible");
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function () { toast.classList.remove("visible"); }, 2600);
  }

  /* ---------- Carte du jour ---------- */
  var dernierFocus = null;
  function afficherCarte(n) {
    var c = (CAL.jours && CAL.jours[n]) || { titre: "Jour " + n, texte: "Le message de ce jour arrive bientôt…" };
    document.getElementById("carte-date").textContent = dateTexte(n);
    document.getElementById("carte-titre").textContent = c.titre || "Jour " + n;
    var corps = document.getElementById("carte-corps");
    corps.textContent = "";
    if (c.image) { var im = document.createElement("img"); im.src = c.image; im.alt = ""; im.draggable = false; corps.appendChild(im); }
    String(c.texte || "").split(/\n\s*\n/).forEach(function (par) {
      if (!par.trim()) return;
      var p = document.createElement("p"); p.textContent = par.trim(); corps.appendChild(p);
    });
    dernierFocus = document.activeElement;
    carte.hidden = false;
    document.getElementById("carte-fermer").focus({ preventScroll: true });
  }
  function fermerCarte() {
    if (carte.hidden) return;
    carte.hidden = true;
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus({ preventScroll: true });
  }
  document.getElementById("carte-fermer").addEventListener("click", fermerCarte);
  carte.querySelector(".carte-voile").addEventListener("click", fermerCarte);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerCarte(); });

  majFermer();

  /* ---------- Lutins : ils trottent À L'INTÉRIEUR de la maison, d'une fenêtre ouverte à l'autre ----------
     Ils ne sont visibles que dans les fenêtres ouvertes (le reste du trajet se fait « dans les murs »). */
  var lutins = document.createElement("div");
  lutins.id = "lutins";
  document.getElementById("chalet").appendChild(lutins);
  var vitres = document.createElement("div");               // les vitres, par-dessus les lutins : on les voit « derrière les carreaux »
  vitres.id = "vitres";
  document.getElementById("chalet").appendChild(vitres);

  /* Lutins en couleur, proportions humaines (SVG peint à plat avec ombrages). Vus de profil/trois-quarts, tournés vers la droite
     (retournés pour aller vers la gauche). Variantes : 4 qui portent des cadeaux, 3 qui fabriquent. */
  var PEAU = "#e3b38c", PEAU_O = "#c98f69", BOTTE = "#3a2315", CEINT = "#2b1a10", OR = "#e2b94b";
  var TENUES = [
    { t: "#2f6b3a", to: "#1f4a28", c: "#a8272f", p: "#4a3b2c" },        // vert / bonnet rouge
    { t: "#a8272f", to: "#7a1b21", c: "#2f6b3a", p: "#3d3a45" },        // rouge / bonnet vert
    { t: "#2c5a8f", to: "#1d3f66", c: "#c9a23a", p: "#3a3328" },        // bleu / bonnet or
    { t: "#7a4a8f", to: "#583468", c: "#e7e1d2", p: "#37323f" },        // prune / bonnet crème
    { t: "#b5651d", to: "#8a4b13", c: "#2f6b3a", p: "#403324" },        // roux / bonnet vert
    { t: "#2e7d7a", to: "#205754", c: "#a8272f", p: "#33383a" }         // sarcelle / bonnet rouge
  ];
  function corps(T, avecBras) {
    return '<g class="jb2"><path d="M20.5 47h5.5l-.8 12 2.8 2.4q1 1.7-1 2.2h-6.6q-1.4 0-1-1.6l.8-2.6z" fill="' + T.p + '"/><path d="M19.8 61.2h8.6l1.2 3.4h-10.4z" fill="' + BOTTE + '"/></g>' +
      '<g class="jb1"><path d="M13.5 47h5.8l.5 12-1.2 2.4q.4 1.9-1.2 2.4h-6.4q-1.7-.4-.8-2l3.4-1.6z" fill="' + T.p + '"/><path d="M11.4 61.6h8.8l.6 3h-10.4z" fill="' + BOTTE + '"/></g>' +
      '<path d="M12.5 30.5q7.5-3.2 15 0l2.2 18.5h-19.4z" fill="' + T.t + '"/><path d="M22 31q5 .5 5.5 1.5l2.2 16.5h-6z" fill="' + T.to + '" opacity=".55"/>' +
      '<rect x="10.3" y="42.6" width="19.4" height="3" fill="' + CEINT + '"/><rect x="18" y="42.2" width="4.2" height="3.8" rx=".6" fill="' + OR + '"/>' +
      '<path d="M10.3 49h19.4l1.6 4.4h-22.6z" fill="' + T.to + '"/>' +
      '<rect x="18" y="27" width="4.4" height="4.6" fill="' + PEAU_O + '"/>' +
      '<ellipse cx="20.2" cy="22.6" rx="5.6" ry="6.4" fill="' + PEAU + '"/><path d="M24.6 20.5q1.6 3.2-.6 7.2q3-1 3-5z" fill="' + PEAU_O + '" opacity=".5"/>' +
      '<path d="M14.8 22.5l-4.4-3.2 1.2 5.2zM25.6 22.5l4.4-3.2-1.2 5.2z" fill="' + PEAU + '"/>' +
      '<circle cx="17.8" cy="22.6" r=".75" fill="#2a1a10"/><circle cx="22.6" cy="22.6" r=".75" fill="#2a1a10"/>' +
      '<circle cx="16.8" cy="25" r="1.3" fill="#d9776a" opacity=".35"/><circle cx="23.6" cy="25" r="1.3" fill="#d9776a" opacity=".35"/>' +
      '<path d="M18.2 26.2q2 1.2 4 0" stroke="#8a4a3a" stroke-width=".6" fill="none"/>' +
      '<path d="M14 19q.5-9.5 7.5-17.5q3.6 8 4.6 17.5q-6 1.8-12.100 0z" fill="' + T.c + '"/>' +
      '<path d="M21.5 1.5q3.6 8 4.6 17.500q-2.300.5-3.600.5q.600-9-1-18z" fill="#000" opacity=".16"/>' +
      '<path d="M13.200 19.200q7.300 2.400 14.200 0l.5 2.400q-7.500 2.400-15.200 0z" fill="#f2ece2"/>' +
      '<circle cx="21.600" cy="1.700" r="2.200" fill="#f2ece2"/>' +
      (avecBras ? '<g class="br1"><path d="M14 31.500q-4.600 1.200-5.800 11.200l3 .8q1.800-6.400 4.200-8.400z" fill="' + T.t + '"/><circle cx="9.700" cy="43.800" r="1.800" fill="' + PEAU + '"/></g>' +
                  '<g class="br2"><path d="M26 31.500q4.600 1.200 5.800 11.200l-3 .8q-1.800-6.400-4.200-8.400z" fill="' + T.t + '"/><circle cx="30.300" cy="43.800" r="1.800" fill="' + PEAU + '"/></g>' : "");
  }
  function bras(T, d) { return '<path d="' + d + '" fill="' + T.t + '"/>'; }
  function main(x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="1.900" fill="' + PEAU + '"/>'; }
  function cadeau(x, y, w, h, papier, ruban) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx=".8" fill="' + papier + '"/>' +
      '<rect x="' + (x + w / 2 - 1) + '" y="' + y + '" width="2" height="' + h + '" fill="' + ruban + '"/>' +
      '<rect x="' + x + '" y="' + (y + h / 2 - 1) + '" width="' + w + '" height="2" fill="' + ruban + '"/>' +
      '<path d="M' + (x + w / 2) + ' ' + y + 'q-3.500-4-4.500-1.200q.800 2.200 4.500 1.200zM' + (x + w / 2) + ' ' + y + 'q3.500-4 4.500-1.200q-.800 2.200-4.500 1.200z" fill="' + ruban + '"/>';
  }
  // 0..3 : portent  |  4..6 : fabriquent (restent un moment au milieu de la fenêtre)
  var MODELES = [
    function (T) {   // un gros cadeau dans les bras
      return corps(T, false) + cadeau(22, 31, 13, 12, "#c8323b", OR) + bras(T, "M14 31.500q5 1 12 7l-2 2.600q-6-3.600-11-4.500z") + main(26.500, 41) +
             bras(T, "M26 31.500q4.500 3 8.500 7.500l-2.500 2q-3.500-3.500-8-5z") + main(33, 40);
    },
    function (T) {   // une pile de trois cadeaux
      return corps(T, false) + cadeau(23, 38, 13, 9, "#2f6b3a", OR) + cadeau(24, 30, 11, 8, "#d8c24a", "#a8272f") + cadeau(25, 23.500, 9, 6.500, "#ececec", "#2c5a8f") +
             bras(T, "M14 31.500q6 2 11 11l-2.500 2q-5-7-9.500-9z") + main(25, 45);
    },
    function (T) {   // un sac de jouets sur l'épaule
      return '<path d="M3 24q-2 12 3 20q7 3 11-3q2-9-2-16q-6-3-12-1z" fill="#8a6a45"/><path d="M3 24q5-3 12 1q1 .5 2 2q-6-3-14-3z" fill="#6c5033"/><path d="M6 20l-2.500-3.500M11 20l1-4" stroke="#8a6a45" stroke-width="1.800"/>' +
             corps(T, false) + bras(T, "M14 31.500q-4 3-3.500 8l3 .5q0-3.500 3-5.500z") + main(11, 40.500) +
             bras(T, "M26 31.500q4 4 2 12l-3-.5q.500-5-2.500-8z") + main(27.500, 44);
    },
    function (T) {   // un petit cadeau qu'il tient devant lui, qui marche en le balançant
      return corps(T, true) + cadeau(27.500, 40.500, 8, 7, "#7a4a8f", OR);
    },
    function (T) {   // marteau : il fabrique un cheval en bois
      return corps(T, false) + '<rect x="24" y="38" width="10" height="7" rx="1.500" fill="#b07a45"/><rect x="31.500" y="33.500" width="2.500" height="6" fill="#b07a45"/><rect x="25" y="44.500" width="1.600" height="4" fill="#8a5a30"/><rect x="31.500" y="44.500" width="1.600" height="4" fill="#8a5a30"/>' +
             bras(T, "M14 31.500q-3 5-1 11l3-.5q-1-4 .5-8z") + main(14.500, 42) +
             '<g class="marteau"><path d="M26 31.500q5 1 7 6l-2.500 1.500q-1.500-3.500-5-4.500z" fill="' + T.t + '"/>' + main(32.500, 38) + '<rect x="32" y="26" width="1.800" height="12" fill="#7a5530"/><rect x="29.500" y="24.500" width="7" height="4.200" rx=".8" fill="#6b6f76"/></g>';
    },
    function (T) {   // il emballe un cadeau et noue le ruban
      return corps(T, false) + cadeau(20, 38, 14, 10, "#2c5a8f", "#e2b94b") + bras(T, "M14 31.500q6 3 9 8l-2.500 1.500q-3-4.500-8-6z") + main(22.500, 40) +
             '<g class="noeud">' + bras(T, "M26 31.500q5 3 6 8l-3 1q-1-4-4-6z") + main(31, 40.500) + '</g>';
    },
    function (T) {   // il peint un petit ours
      return corps(T, false) + '<circle cx="29" cy="43" r="4.500" fill="#a9703a"/><circle cx="25.500" cy="38.500" r="1.800" fill="#a9703a"/><circle cx="32.500" cy="38.500" r="1.800" fill="#a9703a"/><circle cx="29" cy="40" r="1.600" fill="#e8d3a8"/>' +
             bras(T, "M14 31.500q5 3 8 8l-2.500 1.500q-3-4.500-7.500-6z") + main(21.500, 41) +
             '<g class="pinceau"><path d="M26 31.500q5 1 8 6l-2.500 1.500q-2-3.500-6-4.500z" fill="' + T.t + '"/>' + main(33, 37.500) + '<rect x="33.200" y="26" width="1.300" height="11" fill="#7a5530" transform="rotate(14 33.800 37)"/><rect x="34.800" y="24" width="2" height="3" fill="#c8323b" transform="rotate(14 33.800 37)"/></g>';
    }
  ];
  var NB_PORTE = 4;
  /* Lutins photo : planches de 6 images (150x220 chacune) dans img/lutins/. Celles qui se chargent remplacent les porteurs dessinés. */
  var PHOTOS = ["img/lutins/marche1.webp", "img/lutins/marche2.webp", "img/lutins/marche3.webp", "img/lutins/marche4.webp"], photosOK = [];
  // Lutins qui fabriquent : ils arrivent en marchant (planche "marche" de tenue proche), s'arrêtent, puis passent à la planche "travail".
  var TRAVAUX = [{ src: "img/lutins/travail1.webp", marche: "img/lutins/marche2.webp" }, { src: "img/lutins/travail2.webp", marche: "img/lutins/marche1.webp" },
    { src: "img/lutins/travail3.webp", marche: "img/lutins/marche3.webp" }, { src: "img/lutins/travail4.webp", marche: "img/lutins/marche4.webp" }], travauxOK = [];
  function precharge(src, ok) { var im = new Image(); im.onload = function () { ok(src); }; im.src = src; }
  PHOTOS.forEach(function (src) { precharge(src, function (s) { photosOK.push(s); }); });
  TRAVAUX.forEach(function (t) { precharge(t.src, function () { if (photosOK.indexOf(t.marche) >= 0 || true) travauxOK.push(t); }); });
  function svgLutin(v, T) {
    return '<svg viewBox="0 0 40 66" aria-hidden="true">' + MODELES[v % MODELES.length](T) + "</svg>";
  }


  /* ---------- Tableau à craie (mur sous la fenêtre aux rideaux) : un jour ouvert = une ligne écrite à la craie ---------- */
  var COURT = ["Un compliment à une maman","Un petit plaisir rien que pour toi","15 min de gym ou de yoga","La phrase qui remonte le moral","Danse de Noël en famille","Balade avec les enfants + photo","Selfie de maman en pyjama","Un café ou goûter entre mamans","Un moment drôle ou raté","Portrait robot de la maman parfaite","Le trophée du fail de la semaine","Ton sapin et ta déco de Noël","Photo avant / après le café","Un livre ou une série à partager","Défi gainage : la planche","Lettre à toi-même d’il y a 5 ans","Recette chocolat chaud ou gâteaux","Défi imitation : ta voix qui gronde","Le CV improbable de maman","Défi grimace ou fou rire","Une chose gourmande pour toi","La phrase la plus drôle des enfants","Une carte postale à une maman","Photo de famille en pulls de Noël"];
  var tabC = document.createElement("canvas"); tabC.width = 1800; tabC.height = 1385;
  function dessinerTableau(cv, cols) {
    cv = cv || tabC; cols = cols || 2;
    var c = cv.getContext("2d"), W, H, m = 38, f, y0 = 200, pol = '"Segoe Print","Bradley Hand","Chalkduster","Comic Sans MS","Marker Felt",cursive';
    function texteDe(n) { var j = CAL.jours[n]; return (j && j.texte ? j.texte : "").replace(/\s+/g, " "); }
    function ouvert(n) { return boutons[n] && boutons[n].classList.contains("ouverte"); }
    var tw0, par = cols === 1 ? 24 : 12;
    function lignes(t, f) {
      c.font = f + "px " + pol; var mots = t.split(" "), L = [], cur = "";
      mots.forEach(function (w) { var essai = cur ? cur + " " + w : w; if (c.measureText(essai).width > tw0 && cur) { L.push(cur); cur = w; } else cur = essai; });
      if (cur) L.push(cur); return L;
    }
    function hauteur(col, f) { var h = 0; for (var k = 1; k <= par; k++) { var n = col * par + k; h += ouvert(n) ? lignes(texteDe(n), f).length * f * 1.18 + f * .45 : f * 1.5; } return h; }
    var colW;
    if (cols === 1) {                                                        // téléphone : une seule colonne, en hauteur
      W = 1000; m = 30; f = 40; colW = W - 2 * m - 60; tw0 = colW - 80;
      c = document.createElement("canvas").getContext("2d");               // mesure
      H = y0 + hauteur(0, f) + 110;
      cv.width = W; cv.height = H; c = cv.getContext("2d");
    } else {
      W = cv.width; H = cv.height; colW = (W - 2 * m - 90) / 2; tw0 = colW - 80;
      f = 34; while (f > 12 && (hauteur(0, f) > H - 95 - y0 || hauteur(1, f) > H - 95 - y0)) f--;
    }
    c.clearRect(0, 0, W, H);
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#7a5230"); g.addColorStop(.5, "#5b3a20"); g.addColorStop(1, "#6d4627");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var rg = c.createRadialGradient(W / 2, H / 2, H * .15, W / 2, H / 2, Math.max(W, H) * .65);
    rg.addColorStop(0, "#35433f"); rg.addColorStop(1, "#1f2926");
    c.fillStyle = rg; c.fillRect(m, m, W - 2 * m, H - 2 * m);
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 6; c.strokeRect(m, m, W - 2 * m, H - 2 * m);
    for (var i = 0; i < 260; i++) {                                         // traces de chiffon
      c.fillStyle = "rgba(235,240,235," + (Math.random() * .035) + ")";
      c.beginPath(); c.ellipse(m + Math.random() * (W - 2 * m), m + Math.random() * (H - 2 * m), 30 + Math.random() * 120, 6 + Math.random() * 20, Math.random() * 3, 0, 7); c.fill();
    }
    c.textBaseline = "middle"; c.fillStyle = "rgba(255,243,200,.95)";
    c.font = "bold " + (cols === 1 ? 62 : 78) + "px " + pol; c.textAlign = "center";
    c.fillText("✦ Les défis de l’Avent ✦", W / 2, 110);
    c.strokeStyle = "rgba(255,243,200,.6)"; c.lineWidth = 3; c.beginPath(); c.moveTo(W * .2, 158); c.quadraticCurveTo(W / 2, 170, W * .8, 156); c.stroke();
    c.textAlign = "left";
    for (var col = 0; col < cols; col++) {
      var y = y0, x = m + 45 + col * colW;
      for (var k = 1; k <= par; k++) {
        var n = col * par + k;
        c.save(); c.translate(x, y); c.rotate((((n * 37) % 7) - 3) * .003);
        if (ouvert(n)) {
          var L = lignes(texteDe(n), f);
          c.font = "bold " + f + "px " + pol; c.fillStyle = "rgba(255,226,140,.98)"; c.fillText(n + ".", 0, f * .6);
          c.font = f + "px " + pol; c.fillStyle = "rgba(255,243,210,.95)";
          L.forEach(function (l, i) { c.fillText(l, 62, f * .6 + i * f * 1.18); });
          y += L.length * f * 1.18 + f * .45;
        } else {
          c.fillStyle = "rgba(255,243,200,.22)"; c.font = f + "px " + pol; c.fillText(n + ".", 0, f * .6);
          c.fillRect(62, f * .6 + 4, 150 + ((n * 53) % 90), 2); y += f * 1.5;
        }
        c.restore();
      }
    }
    c.fillStyle = "rgba(255,243,200,.5)"; c.font = "26px " + pol; c.textAlign = "center";
    c.fillText("Une case de plus chaque jour…", W / 2, H - 45);
    if (cv === tabC && window.VUE && VUE.tableau) VUE.tableau(tabC);
  }
  window.dessinerTableau = function () { dessinerTableau(); };
  var grand = document.createElement("div"); grand.id = "tableau-grand"; grand.hidden = true;
  grand.innerHTML = '<canvas width="1800" height="1385"></canvas>'; document.body.appendChild(grand);
  var fermerTg = document.createElement("button"); fermerTg.type = "button"; fermerTg.id = "tg-fermer"; fermerTg.hidden = true;
  fermerTg.innerHTML = "✕ Fermer"; document.body.appendChild(fermerTg);
  function fermerTableau() { grand.hidden = true; fermerTg.hidden = true; }
  fermerTg.addEventListener("click", fermerTableau);
  grand.addEventListener("click", fermerTableau);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerTableau(); });
  window.OUVRIR_TABLEAU = function () {
    var cv = grand.querySelector("canvas"), vertical = window.innerHeight > window.innerWidth * 0.9 || window.innerWidth < 700;
    cv.width = 1800; cv.height = 1385;
    dessinerTableau(cv, vertical ? 1 : 2);
    grand.classList.toggle("vertical", vertical); grand.scrollTop = 0; grand.hidden = false; fermerTg.hidden = false;
  };
  setTimeout(dessinerTableau, 300); setTimeout(dessinerTableau, 1500);
  var nLutins = 0, tLutin = 0, ouvertA = {};
  var sansAnim = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fenetresVisibles() {                               // fenêtres ouvertes (cheminée exclue) et déjà bien ouvertes
    var maintenant = Date.now();
    return ouvertes.filter(function (n) {
      return n !== CHEMINEE && CH.boxes[n] && boutons[n] && boutons[n].classList.contains("ouverte") &&
             maintenant - (ouvertA[n] || 0) > 1300;
    });
  }
  /* Vitres : par-dessus les lutins, avec les barreaux (croisillons) de chaque fenêtre ouverte. Les lutins passent donc DERRIÈRE. */
  function majVitres() {
    if (window.dessinerTableau) window.dessinerTableau();
    var p = function (v) { return (v * 100).toFixed(3) + "%"; };       // positions en % du chalet : ne dépendent pas de sa taille en pixels
    Array.prototype.slice.call(vitres.children).forEach(function (el) {            // fenêtres refermées
      var n = +el.dataset.n; if (!boutons[n] || !boutons[n].classList.contains("ouverte")) el.remove();
    });
    ouvertes.forEach(function (n) {
      var b = CH.boxes[n]; if (n === CHEMINEE || !b || !boutons[n] || !boutons[n].classList.contains("ouverte")) return;
      if (vitres.querySelector('[data-n="' + n + '"]')) return;
      var ix = 0.03, x = b[0] + b[2] * ix, y = b[1] + b[3] * ix, w = b[2] * (1 - 2 * ix), h = b[3] * (1 - 2 * ix);
      var asp = w * RATIO / h, nv = asp > 1.25 ? 2 : 1, nh = asp < 0.75 ? 2 : 1, i, html = "";
      if (AVEC_BARREAUX.indexOf(decorNum[n]) >= 0) nv = nh = 0;
      for (i = 1; i <= nv; i++) html += '<i class="bv" style="left:' + (i * 100 / (nv + 1)).toFixed(2) + '%"></i>';
      for (i = 1; i <= nh; i++) html += '<i class="bh" style="top:' + (i * 100 / (nh + 1)).toFixed(2) + '%"></i>';
      var vt = document.createElement("div");
      vt.className = "vitre"; vt.dataset.n = n; vt.innerHTML = html;
      vt.style.cssText = "left:" + p(x) + ";top:" + p(y) + ";width:" + p(w) + ";height:" + p(h) + ";border-radius:" +
        (ROND.indexOf(n) >= 0 ? "50%" : ARCHE.indexOf(n) >= 0 ? "50% 50% 0 0 / " + (50 / asp).toFixed(2) + "% " + (50 / asp).toFixed(2) + "% 0 0" : ".3cqw");
      vitres.appendChild(vt);
    });
  }
  // Les lutins ne sont visibles que dans les fenêtres ouvertes : on découpe leur calque selon ces fenêtres.
  function cheminFenetre(n, W, H) {                         // contour d'une fenêtre (px du chalet), pour découper un lutin
    var b = CH.boxes[n], ix = 0.03, x = (b[0] + b[2] * ix) * W, y = (b[1] + b[3] * ix) * H, w = b[2] * (1 - 2 * ix) * W, h = b[3] * (1 - 2 * ix) * H;
    var f = function (v) { return v.toFixed(1); };
    if (ROND.indexOf(n) >= 0) {
      var r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
      return "M" + f(cx - r) + " " + f(cy) + "a" + f(r) + " " + f(r) + " 0 1 0 " + f(2 * r) + " 0a" + f(r) + " " + f(r) + " 0 1 0 " + f(-2 * r) + " 0z";
    }
    if (ARCHE.indexOf(n) >= 0) {
      var ra = w / 2;
      return "M" + f(x) + " " + f(y + ra) + "a" + f(ra) + " " + f(ra) + " 0 0 1 " + f(w) + " 0V" + f(y + h) + "H" + f(x) + "z";
    }
    return "M" + f(x) + " " + f(y) + "h" + f(w) + "v" + f(h) + "h" + f(-w) + "z";
  }
  // Chaque lutin vit dans UNE seule fenêtre (son cadre le découpe) ; si elle se referme, il disparaît avec elle.
  function majMasqueLutins() {
    var W = lutins.offsetWidth, H = lutins.offsetHeight;
    if (!W || !H) return;
    majVitres();
    Array.prototype.slice.call(lutins.children).forEach(function (c) {
      var n = +c.dataset.n;
      if (!boutons[n] || !boutons[n].classList.contains("ouverte")) { c.querySelectorAll(".lutin").forEach(function () { nLutins--; }); c.remove(); }
    });
  }
  window.addEventListener("resize", majMasqueLutins);
  setTimeout(majMasqueLutins, 700); setTimeout(majMasqueLutins, 2500);     // une fois la taille du chalet définie par la vue

  function lancerLutin() {
    if (sansAnim || document.hidden || nLutins >= 3) return;
    var ouv = fenetresVisibles();
    if (ouv.length < 1) return;
    var a = ouv[Math.floor(Math.random() * ouv.length)];
    var W = lutins.offsetWidth, H = lutins.offsetHeight; if (!W || !H) return;
    var ba = CH.boxes[a], groupe = [a];
    if (IMG_COMMUNE.cases.indexOf(a) >= 0) {                  // 13 et 14 ne forment qu'une image : le lutin peut passer de l'une à l'autre
      groupe = IMG_COMMUNE.cases.filter(function (n) { return ouv.indexOf(n) >= 0; });
      var x0 = Math.min.apply(null, groupe.map(function (n) { return CH.boxes[n][0]; })), x1 = Math.max.apply(null, groupe.map(function (n) { return CH.boxes[n][0] + CH.boxes[n][2]; }));
      ba = [x0, CH.boxes[a][1], x1 - x0, CH.boxes[a][3]];
    }
    var fa = (ba[1] + ba[3] * 1.13) * H;                       // « sol » légèrement sous la fenêtre : on ne voit pas leurs pieds
    var xa = (ba[0] + ba[2] / 2) * W;
    var hauteur = Math.max(0.07 * W, Math.min(0.14 * W, ba[3] * H * 0.92));
    var largeur = hauteur * 40 / 66;
    var photo = null, v, tphoto = null;
    if (photosOK.length) {
      if (travauxOK.length && Math.random() < 0.4) { tphoto = travauxOK[Math.floor(Math.random() * travauxOK.length)]; photo = tphoto.marche; }
      else photo = photosOK[Math.floor(Math.random() * photosOK.length)];
    }
    if (photo && photosOK.indexOf(photo) < 0) { photo = photosOK[0]; tphoto = null; }
    if (photo) v = 0;
    else {
      do { v = Math.floor(Math.random() * MODELES.length); } while (photosOK.length && v < NB_PORTE);   // photos dispo : plus de porteurs dessinés
    }
    var travail = !!tphoto || (!photo && v >= NB_PORTE && v < 7);
    // il entre par un bord de sa fenêtre (gauche ou droite au hasard), marche à hauteur constante et sort par l'autre bord
    var dir = Math.random() < 0.5 ? 1 : -1, demi = (photo ? hauteur * 220 / 208 * 150 / 220 : largeur) / 2;
    var gauche = ba[0] * W - demi - 2, droite = (ba[0] + ba[2]) * W + demi + 2;
    var xs = dir > 0 ? gauche : droite, xe = dir > 0 ? droite : gauche;
    var pts = [[xs, fa]];
    if (travail) pts.push([xa, fa], [xa, fa]);                      // il s'arrête au milieu de sa fenêtre pour travailler
    pts.push([xe, fa]);
    var lg = [], tot = 0, i;
    for (i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lg.push(l); tot += l; }
    if (tot < 8) return;
    var vitesse = photo ? hauteur * 1.25 : W * 0.1, pause = travail ? 5200 : 0;
    var marche = tot / vitesse * 1000, duree = marche + pause;
    var T = TENUES[Math.floor(Math.random() * TENUES.length)];
    var lum = (decorLum[a] || .4), eclat = Math.max(1.7, Math.min(3.8, 0.72 / Math.max(.1, lum)));
    var el = document.createElement("div");
    el.className = "lutin" + (v === 3 ? "" : v < NB_PORTE ? " porte-cadeau" : "");
    if (photo) {                                              // planche de 6 images : 150x220, pieds à 98,5 % de la hauteur
      var hp = hauteur * 220 / 208, wp = hp * 150 / 220;
      el.className = "lutin photo";
      el.style.cssText = "width:" + wp.toFixed(1) + "px;height:" + hp.toFixed(1) + "px;margin-left:" + (-wp / 2).toFixed(1) +
                         "px;margin-top:" + (-hp * 0.985).toFixed(1) + "px";
      el.innerHTML = '<div class="lutin-in"><div class="img" style="background-image:url(' + photo + ')"></div></div>';
      var im = el.querySelector(".img");
      if (dir < 0) im.style.transform = "scaleX(-1)";
      var jouerPlanche = function (src, duree) {
        if (im._a) im._a.cancel();
        im.style.backgroundImage = "url(" + src + ")";
        im._a = im.animate([{ backgroundPositionX: "0%" }, { backgroundPositionX: "120%" }], { duration: duree, iterations: Infinity, easing: "steps(6, end)" });
      };
      jouerPlanche(photo, 900);
    } else {
      el.style.cssText = "width:" + largeur.toFixed(1) + "px;height:" + hauteur.toFixed(1) + "px;margin-left:" + (-largeur / 2).toFixed(1) +
                         "px;margin-top:" + (-hauteur).toFixed(1) + "px";
      el.innerHTML = '<div class="lutin-in">' + svgLutin(v, T) + "</div>";
      if (dir < 0) el.querySelector("svg").style.transform = "scaleX(-1)";
    }
    el.style.filter = "brightness(" + eclat.toFixed(2) + ")";
    var cadre = document.createElement("div");                // le cadre découpe le lutin à sa fenêtre
    cadre.className = "cadre-lutin"; cadre.dataset.n = a; cadre.style.clipPath = 'path("' + groupe.map(function (n) { return cheminFenetre(n, W, H); }).join("") + '")';
    cadre.appendChild(el); lutins.appendChild(cadre); nLutins++;
    var kf = [], cum = 0, tPause0 = 0, tPause1 = 0;
    function pos(p, off) { return { transform: "translate(" + p[0].toFixed(1) + "px," + p[1].toFixed(1) + "px)", offset: Math.min(1, off) }; }
    kf.push(pos(pts[0], 0));
    for (i = 1; i < pts.length; i++) {
      var dm = lg[i - 1] / vitesse * 1000;
      if (travail && i === 2) { tPause0 = cum; cum += pause; tPause1 = cum; kf.push(pos(pts[i], cum / duree)); continue; }
      cum += dm; kf.push(pos(pts[i], cum / duree));
    }
    kf[kf.length - 1].offset = 1;
    var anim = el.animate(kf, { duration: duree, easing: "linear", fill: "forwards" });
    if (travail) {
      setTimeout(function () { el.classList.add("travaille"); if (tphoto) jouerPlanche(tphoto.src, 1200); }, tPause0);
      setTimeout(function () { el.classList.remove("travaille"); if (tphoto) jouerPlanche(photo, 900); }, tPause1);
    }
    anim.onfinish = function () { if (el.parentNode) el.parentNode.remove(); nLutins--; };
  }
  function planifierLutin() {
    clearTimeout(tLutin);
    tLutin = setTimeout(function () { try { lancerLutin(); } catch (e) {} planifierLutin(); }, 1800 + Math.random() * 3600);
  }
  planifierLutin();
  majMasqueLutins();

  /* ---------- Clic sur une fenêtre ---------- */
  var occupe = false;
  portes.addEventListener("click", function (e) {
    var b = e.target.closest(".porte"); if (!b || occupe) return;
    var n = +b.dataset.jour;

    if (n > AUJ) {                                         // jours futurs : impossible
      b.classList.remove("refus"); void b.offsetWidth; b.classList.add("refus");
      message("Patience… cette case s'ouvrira le " + dateTexte(n) + " 🎄");
      return;
    }
    if (b.classList.contains("ouverte")) { afficherCarte(n); return; }

    occupe = true;
    b.classList.add("ouverte");
    grincement();
    if (ouvertes.indexOf(n) < 0) { ouvertes.push(n); ecrire(cleOuvertes, ouvertes); majFermer(); }
    ouvertA[n] = Date.now(); majVitres(); setTimeout(majMasqueLutins, 1350);
    setTimeout(function () { occupe = false; afficherCarte(n); }, 1300);
  });

  /* ---------- Pas de zoom, pas de clic droit ---------- */
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); });
  });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });
  window.addEventListener("wheel", function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0"].indexOf(e.key) >= 0) e.preventDefault();
  });
  document.addEventListener("selectstart", function (e) { if (!carte.contains(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
})();
