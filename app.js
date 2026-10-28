(function () {
  "use strict";
  var CAL = window.CALENDRIER;
  var mur = document.getElementById("mur");
  var chalet = document.getElementById("chalet");
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
  var AUJ = jourCourant();
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

  /* ---------- Fond du jour ---------- */
  (function () {
    var dispo = (CAL.fonds || []).filter(function (n) { return n <= jourRef; });
    var n = dispo.length ? Math.max.apply(null, dispo) : (CAL.fonds && CAL.fonds[0]) || 1;
    var nn = (n < 10 ? "0" : "") + n;
    var st = document.getElementById("stage").style;
    st.setProperty("--img-d", 'url("img/jour-' + nn + '-desktop.webp")');
    st.setProperty("--img-m", 'url("img/jour-' + nn + '-mobile.webp")');
  })();

  /* ---------- Hasard reproductible ---------- */
  function graine(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Fenêtres : tailles et couleurs différentes, un numéro par jour, ordre mélangé ---------- */
  var COULEURS = ["#c0392b", "#2e7d5b", "#2f6db5", "#d99a1e", "#8e44ad", "#e0702a",
                  "#13919b", "#c2548a", "#5f8f3a", "#3a55b8", "#a8432f", "#7a5a2e"];
  var alea = graine(2026);
  var jours = [];
  for (var i = 1; i <= 24; i++) jours.push(i);
  for (var k = jours.length - 1; k > 0; k--) {             // mélange (Fisher-Yates)
    var j = Math.floor(alea() * (k + 1)), tmp = jours[k]; jours[k] = jours[j]; jours[j] = tmp;
  }
  var perso = {};                                          // propriétés fixes de chaque jour
  var cps = COULEURS.slice();
  jours.forEach(function (n, idx) {
    perso[n] = { fw: alea(), fh: alea(), jx: alea() - .5, jy: alea() - .5, c: COULEURS[(idx * 5 + 3) % COULEURS.length] };
  });

  var boutons = {};
  function construire() {
    var portrait = matchMedia("(orientation: portrait)").matches;
    var cols = portrait ? 4 : 6, rows = portrait ? 6 : 4;
    var wallh = portrait ? 108 : 58;
    var pitchX = 92 / cols, pitchY = (wallh - 3) / rows;
    var wMin = portrait ? 14 : 8.4, wMax = portrait ? 19 : 12.4;
    var hMin = portrait ? 11.5 : 8, hMax = portrait ? 15.5 : 11.2;
    mur.textContent = "";
    boutons = {};

    jours.forEach(function (n, idx) {
      var col = idx % cols, row = Math.floor(idx / cols), p = perso[n];
      var w = wMin + p.fw * (wMax - wMin), h = hMin + p.fh * (hMax - hMin);
      var x = col * pitchX + (pitchX - w) / 2 + p.jx * (pitchX - w) * .55;
      var y = 1.6 + row * pitchY + (pitchY - h) / 2 + p.jy * (pitchY - h) * .55;

      var b = document.createElement("button");
      b.type = "button";
      b.className = "fenetre" + (n > AUJ ? " futur" : "") + (n === AUJ ? " aujourdhui" : "") +
                    (ouvertes.indexOf(n) >= 0 ? " ouverte" : "");
      b.dataset.jour = n;
      b.setAttribute("aria-label", n > AUJ ? "Fenêtre du " + dateTexte(n) + " (pas encore ouvrable)" : "Ouvrir la fenêtre du " + dateTexte(n));
      b.style.cssText = "left:" + x.toFixed(2) + "cqw;top:" + y.toFixed(2) + "cqw;width:" + w.toFixed(2) +
                        "cqw;height:" + h.toFixed(2) + "cqw;font-size:" + (Math.min(w, h) * .26).toFixed(2) +
                        "cqw;--c:" + p.c;
      b.innerHTML = '<span class="interieur"></span><span class="halo"></span>' +
        '<span class="vantail g"><i class="poignee"></i></span><span class="vantail d"><i class="poignee"></i></span>' +
        '<span class="cadre"></span><span class="num">' + n + "</span>";
      mur.appendChild(b);
      boutons[n] = b;
    });
  }
  construire();
  var mq = matchMedia("(orientation: portrait)");
  (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(construire);

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

  /* ---------- Message temporaire ---------- */
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

  /* ---------- Clic sur une fenêtre ---------- */
  var occupe = false;
  mur.addEventListener("click", function (e) {
    var b = e.target.closest(".fenetre"); if (!b || occupe) return;
    var n = +b.dataset.jour;

    if (n > AUJ) {                                         // jours futurs : impossible
      b.classList.remove("refus"); void b.offsetWidth; b.classList.add("refus");
      message("Patience… cette fenêtre s'ouvrira le " + dateTexte(n) + " 🎄");
      return;
    }
    if (b.classList.contains("ouverte")) { afficherCarte(n); return; }

    occupe = true;
    b.classList.add("ouverte");
    grincement();
    if (ouvertes.indexOf(n) < 0) { ouvertes.push(n); ecrire(cleOuvertes, ouvertes); }
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
