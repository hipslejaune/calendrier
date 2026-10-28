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

      var html = '<span class="interieur"></span><span class="halo"></span>';
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
    env.gain.linearRampToValueAtTime(.3, t + .08);
    env.gain.setValueAtTime(.3, t + dur - .25);
    env.gain.linearRampToValueAtTime(0, t + dur);

    osc.connect(am); am.connect(bp); bp.connect(env); env.connect(c.destination);
    [osc, vib, lfo].forEach(function (o) { o.start(t); o.stop(t + dur + .05); });

    // petit « toc » du bois en fin de course
    var n = c.createBuffer(1, Math.floor(c.sampleRate * .12), c.sampleRate), d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    var src = c.createBufferSource(); src.buffer = n;
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    var g2 = c.createGain(); g2.gain.value = .35;
    src.connect(lp); lp.connect(g2); g2.connect(c.destination); src.start(t + dur - .02);
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
    musique.loop = true; musique.volume = .4; musique.preload = "auto";
  }
  function jouerMusique() {
    if (!musique || muet || document.hidden) return;
    var p = musique.play(); if (p && p.catch) p.catch(function () {});
  }
  var demarre = false;
  function premierGeste() {
    if (demarre) return; demarre = true;
    contexte(); jouerMusique();
  }
  window.addEventListener("pointerdown", premierGeste, { passive: true });
  window.addEventListener("keydown", premierGeste);
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
  function majFermer() { boutonFermer.disabled = ouvertes.length === 0; }
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

  var JAMBES = '<g class="jb1"><path d="M13 45h6l-1 14 3 2.5q1 1.5-1 2h-8q-1.5 0-1-1.5L12 59z"/></g>' +
               '<g class="jb2"><path d="M21 45h6l1 14 3 2.5q1 1.5-1 2h-8q-2 0-1-1.5L24 59z"/></g>';
  var BRAS = '<g class="br1"><path d="M14 30l-8 11 3 2.5 8-8z"/></g><g class="br2"><path d="M26 30l8 11-3 2.5-8-8z"/></g>';
  var TETE = '<path d="M12 31q8-3 16 0l3 16H9z"/><circle cx="20" cy="24" r="6"/><path d="M14 22l-6-3 5 7zM26 22l6-3-5 7z"/>';
  var VARIANTES = [
    // 1. bonnet pointu à pompon
    '<path d="M11 21q1-9 7-14t14-4q-6 3-6 7 0 4 4 11z"/><circle cx="32" cy="3" r="2.6"/>',
    // 2. bonnet recourbé avec grelot
    '<path d="M11 21q0-9 6-12t13 1q3 1 4 4-2-2-6-2-5 0-6 4l4 9z"/><circle cx="34" cy="15" r="2.6"/>',
    // 3. bonnet rond, pompon et écharpe au vent
    '<path d="M12 22q0-11 8-11t8 11z"/><circle cx="20" cy="9" r="3.2"/><path d="M14 29q-9 0-12 6 7-3 13 0z"/><path d="M14 29l-3 10 4 1 2-9z"/>',
    // 4. grand bonnet droit et sac sur le dos
    '<path d="M14 21l6-19 6 19z"/><circle cx="8" cy="38" r="8"/><path d="M12 31l4-1-2 8z"/>',
    // 5. chapeau mou et cadeau dans les bras
    '<path d="M9 21q11-3 22 0l-3-8q-3-9-9-9t-7 9z"/><circle cx="26" cy="5" r="2.4"/><rect x="22" y="37" width="12" height="11" rx="1"/><path d="M27 33h2v4h-2zM24 34l3 3 3-3-3-2z"/>',
    // 6. bonnet pointu et canne à sucre
    '<path d="M12 21q0-10 8-19 8 9 8 19z"/><path d="M33 33h3.2v21q0 7-7 7v-3q3.8 0 3.8-4z"/>'
  ];
  function svgLutin(v) {
    return '<svg viewBox="0 0 40 64" aria-hidden="true">' + JAMBES + BRAS + TETE + VARIANTES[v % VARIANTES.length] + "</svg>";
  }

  var nLutins = 0, tLutin = 0, ouvertA = {};
  var sansAnim = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fenetresVisibles() {                               // fenêtres ouvertes (cheminée exclue) et déjà bien ouvertes
    var maintenant = Date.now();
    return ouvertes.filter(function (n) {
      return n !== CHEMINEE && CH.boxes[n] && boutons[n] && boutons[n].classList.contains("ouverte") &&
             maintenant - (ouvertA[n] || 0) > 1300;
    });
  }
  // Les lutins ne sont visibles que dans les fenêtres ouvertes : on découpe leur calque selon ces fenêtres.
  function majMasqueLutins() {
    var W = lutins.offsetWidth, H = lutins.offsetHeight, d = "";
    if (!W || !H) return;
    fenetresVisibles().forEach(function (n) {
      var b = CH.boxes[n], ix = 0.03, x = (b[0] + b[2] * ix) * W, y = (b[1] + b[3] * ix) * H, w = b[2] * (1 - 2 * ix) * W, h = b[3] * (1 - 2 * ix) * H;
      var f = function (v) { return v.toFixed(1); };
      if (ROND.indexOf(n) >= 0) {
        var r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
        d += "M" + f(cx - r) + " " + f(cy) + "a" + f(r) + " " + f(r) + " 0 1 0 " + f(2 * r) + " 0a" + f(r) + " " + f(r) + " 0 1 0 " + f(-2 * r) + " 0z";
      } else if (ARCHE.indexOf(n) >= 0) {
        var ra = w / 2;
        d += "M" + f(x) + " " + f(y + ra) + "a" + f(ra) + " " + f(ra) + " 0 0 1 " + f(w) + " 0V" + f(y + h) + "H" + f(x) + "z";
      } else {
        d += "M" + f(x) + " " + f(y) + "h" + f(w) + "v" + f(h) + "h" + f(-w) + "z";
      }
    });
    lutins.style.clipPath = d ? 'path("' + d + '")' : 'path("M0 0")';
  }
  window.addEventListener("resize", majMasqueLutins);

  function lancerLutin() {
    if (sansAnim || document.hidden || nLutins >= 3) return;
    var ouv = fenetresVisibles();
    if (ouv.length < 2) return;
    var a = ouv[Math.floor(Math.random() * ouv.length)], b;
    do { b = ouv[Math.floor(Math.random() * ouv.length)]; } while (b === a);
    var W = lutins.offsetWidth, H = lutins.offsetHeight; if (!W || !H) return;
    var ba = CH.boxes[a], bb = CH.boxes[b];
    function sol(bx) { return (bx[1] + bx[3] * 0.9) * H; }           // le sol de la fenêtre (en px)
    var xa = (ba[0] + ba[2] / 2) * W, xb = (bb[0] + bb[2] / 2) * W, fa = sol(ba), fb = sol(bb);
    var dir = xb >= xa ? 1 : -1;
    var xe = dir > 0 ? (ba[0] + ba[2]) * W : ba[0] * W;                // il sort de sa fenêtre côté destination
    var xn = dir > 0 ? bb[0] * W : (bb[0] + bb[2]) * W;                // et entre dans l'autre par le côté proche
    if ((xn - xe) * dir < 0) xn = xe;
    var pts = [[xa, fa], [xe, fa], [xn, fb], [xb, fb]], lg = [], tot = 0, i;
    for (i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lg.push(l); tot += l; }
    if (tot < 8) return;
    var hauteur = Math.max(0.06 * W, Math.min(0.13 * W, Math.min(ba[3], bb[3]) * H * 0.78));
    var largeur = hauteur * 0.625;
    var duree = Math.max(2400, Math.min(11000, tot / (W * 0.11) * 1000));
    var el = document.createElement("div");
    el.className = "lutin";
    el.style.cssText = "width:" + largeur.toFixed(1) + "px;height:" + hauteur.toFixed(1) + "px;margin-left:" + (-largeur / 2).toFixed(1) +
                       "px;margin-top:" + (-hauteur).toFixed(1) + "px";
    el.innerHTML = '<div class="lutin-in">' + svgLutin(Math.floor(Math.random() * VARIANTES.length)) + "</div>";
    if (dir < 0) el.querySelector("svg").style.transform = "scaleX(-1)";
    lutins.appendChild(el); nLutins++;
    var kf = [], cum = 0;
    function pos(p, off, o) { return { transform: "translate(" + p[0].toFixed(1) + "px," + p[1].toFixed(1) + "px)", opacity: o, offset: off }; }
    kf.push(pos(pts[0], 0, 0)); kf.push(pos(pts[0], 0.02, 1));
    for (i = 1; i < pts.length; i++) { cum += lg[i - 1]; kf.push(pos(pts[i], Math.min(0.98, cum / tot), 1)); }
    kf[kf.length - 1].offset = 0.98; kf.push(pos(pts[3], 1, 0));
    var anim = el.animate(kf, { duration: duree, easing: "linear", fill: "forwards" });
    anim.onfinish = function () { el.remove(); nLutins--; };
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
    ouvertA[n] = Date.now(); setTimeout(majMasqueLutins, 1350);
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
