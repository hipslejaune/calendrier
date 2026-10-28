/* Neige sur toute la page : les flocons s'écartent du curseur ou du doigt. */
(function () {
  "use strict";
  var canvas = document.getElementById("neige");
  var ctx = canvas.getContext("2d");
  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1, flocons = [], sprites = [];
  var RAYON = 130;                 // zone d'influence du curseur / doigt (px)
  var ptr = { x: -9999, y: -9999, actif: false };

  // Sprites pré-dessinés (halo doux) : plus rapide que 700 gradients par image.
  function fabriqueSprites() {
    sprites = [];
    for (var i = 0; i < 6; i++) {
      var r = 1.2 + i * 0.85, taille = Math.ceil(r * 2 * 2.4 * dpr);
      var c = document.createElement("canvas");
      c.width = c.height = taille;
      var g = c.getContext("2d");
      var m = taille / 2;
      var gr = g.createRadialGradient(m, m, 0, m, m, m);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.35, "rgba(255,255,255,.85)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, taille, taille);
      sprites.push({ c: c, d: taille / dpr });
    }
  }

  function nouveau(initial) {
    var cl = Math.random();                       // profondeur : petits = loin, lents
    var s = Math.min(5, Math.floor(cl * cl * 6));
    var r = 1.2 + s * 0.85;
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : -10 - Math.random() * 40,
      s: s,
      vy: (22 + r * 13) * (reduit ? 0.5 : 1) * (0.8 + Math.random() * 0.4),
      amp: 8 + Math.random() * 22,
      freq: 0.4 + Math.random() * 0.9,
      ph: Math.random() * 6.283,
      alpha: 0.55 + Math.random() * 0.45,
      ox: 0, oy: 0                                // vitesse due au curseur
    };
  }

  function taille() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fabriqueSprites();
    var n = Math.round(Math.max(220, Math.min(750, (W * H) / 2600)));
    if (reduit) n = Math.round(n / 3);
    while (flocons.length < n) flocons.push(nouveau(true));
    flocons.length = n;
  }

  function pointeur(e) {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.actif = true;
  }
  window.addEventListener("pointermove", pointeur, { passive: true });
  window.addEventListener("pointerdown", pointeur, { passive: true });
  function fin() { ptr.actif = false; ptr.x = ptr.y = -9999; }
  window.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") fin(); }, { passive: true });
  window.addEventListener("pointercancel", fin, { passive: true });
  document.addEventListener("mouseleave", fin);
  window.addEventListener("blur", fin);

  var t0 = performance.now(), dernier = t0;
  function image(now) {
    var dt = Math.min(0.05, (now - dernier) / 1000);
    dernier = now;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    var amort = Math.exp(-2.4 * dt);
    for (var i = 0; i < flocons.length; i++) {
      var f = flocons[i];

      if (ptr.actif) {
        var ex = f.x - ptr.x, ey = f.y - ptr.y;
        if (ex < RAYON && ex > -RAYON && ey < RAYON && ey > -RAYON) {
          var d2 = ex * ex + ey * ey;
          if (d2 < RAYON * RAYON) {
            var d = Math.sqrt(d2) || 0.001;
            var k = 1 - d / RAYON;
            var force = k * k * 1500 * dt;        // plus c'est près, plus ça pousse
            f.ox += (ex / d) * force;
            f.oy += (ey / d) * force;
          }
        }
      }
      f.ox *= amort; f.oy *= amort;

      f.x += f.ox * dt;
      f.y += (f.vy + f.oy) * dt;
      var x = f.x + Math.sin(t * f.freq + f.ph) * f.amp;

      if (f.y > H + 12 || x < -60 || x > W + 60) {
        var n = nouveau(false);
        n.x = Math.random() * W;
        flocons[i] = n;
        continue;
      }
      var sp = sprites[f.s];
      ctx.globalAlpha = f.alpha;
      ctx.drawImage(sp.c, x - sp.d / 2, f.y - sp.d / 2, sp.d, sp.d);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(image);
  }

  window.addEventListener("resize", taille);
  taille();
  requestAnimationFrame(function (n) { dernier = n; image(n); });
})();
