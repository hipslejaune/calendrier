/* Neige sur toute la page.
   - Les flocons s'écartent du curseur ou du doigt et sont emportés dans le sens du geste.
   - Ceux qui touchent le toit du chalet s'y amassent ; le curseur les chasse au passage. */
(function () {
  "use strict";
  var canvas = document.getElementById("neige");
  var ctx = canvas.getContext("2d");
  var reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1, flocons = [], sprites = [], nTemp = 0;
  var RAYON = 200;                 // zone d'influence du curseur / doigt (px)
  var MAX_TEMP = 320;              // flocons projetés depuis le toit, en même temps
  var ptr = { x: -9999, y: -9999, actif: false, vx: 0, vy: 0, t: 0 };

  /* ---------- Toit du chalet : profil de l'image, neige accumulée par colonne ---------- */
  var toit = {
    ok: false, pas: 3, n: 0, x0: 0, w: 0, top: 0, k: 1,
    profil: null,          // pour chaque colonne de l'image : hauteur du sommet (0..1), -1 si vide
    surf: null,            // y écran de la surface du toit, par colonne
    cap: null,             // épaisseur maximale de neige, par colonne
    h: null,               // épaisseur actuelle de neige, par colonne
    acc: 0                 // neige chassée pas encore transformée en flocons
  };
  var poids = [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05];

  function chargeProfil() {
    var el = document.getElementById("chalet-img");
    if (!el) return;
    var img = new Image();
    img.onload = function () {
      var cw = 400, ch = Math.max(1, Math.round(img.naturalHeight * cw / img.naturalWidth));
      var c = document.createElement("canvas"); c.width = cw; c.height = ch;
      var g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, cw, ch);
      var d;
      try { d = g.getImageData(0, 0, cw, ch).data; } catch (e) { return; }
      var p = new Float32Array(cw);
      for (var x = 0; x < cw; x++) {
        p[x] = -1;
        for (var y = 0; y < ch; y++) { if (d[(y * cw + x) * 4 + 3] > 128) { p[x] = y / ch; break; } }
      }
      toit.profil = p;
      miseEnPlaceToit();
    };
    img.src = el.currentSrc || el.src;
  }

  function miseEnPlaceToit() {
    var r = window.VUE && VUE.rect;
    if (!r || !toit.profil) return;
    if (!r.width || !r.height) return;
    var pas = toit.pas, n = Math.ceil(r.width / pas), premiere = !toit.h || toit.n !== n;
    var surf = new Float32Array(n), cap = new Float32Array(n), cw = toit.profil.length;
    var k = r.width / 576;
    for (var i = 0; i < n; i++) {
      var idx = Math.min(cw - 1, Math.floor(((i + 0.5) * pas / r.width) * cw)), t = toit.profil[idx];
      surf[i] = t < 0 ? NaN : r.top + t * r.height;
    }
    for (i = 0; i < n; i++) {                       // pente locale → épaisseur que la neige peut tenir
      var a = surf[Math.max(0, i - 3)], b = surf[Math.min(n - 1, i + 3)];
      if (surf[i] !== surf[i] || a !== a || b !== b) { cap[i] = 0; continue; }
      var pente = Math.abs(b - a) / (Math.min(n - 1, i + 3) - Math.max(0, i - 3)) / pas;
      cap[i] = k * (18 * (1 - Math.min(1, pente * 0.6)) + 8);
    }
    var h = new Float32Array(n);
    if (premiere) { for (i = 0; i < n; i++) h[i] = cap[i] * 0.2; }     // un peu de neige dès l'arrivée
    else { for (i = 0; i < n; i++) h[i] = Math.min(toit.h[i], cap[i]); }
    toit.surf = surf; toit.cap = cap; toit.h = h; toit.n = n;
    toit.x0 = r.left; toit.top = r.top; toit.w = r.width; toit.k = k; toit.ok = true;
  }
  function verifieToit() {                           // le chalet suit le décor : on déplace la neige du toit avec lui
    var r = VUE.rect;
    if (!r.width) { toit.ok = false; return; }
    if (!toit.ok || Math.abs(r.width - toit.w) > 0.15 * toit.w) { miseEnPlaceToit(); return; }
    var dx = r.left - toit.x0, dy = r.top - toit.top;
    if (dx || dy) {
      if (dy) { var s = toit.surf; for (var i = 0; i < s.length; i++) s[i] += dy; }
      toit.x0 = r.left; toit.top = r.top;
    }
  }

  function poser(ci, f) {                            // un flocon se pose sur le toit
    var apport = (26 + f.s * 7) * toit.k, h = toit.h, cap = toit.cap, n = toit.n;
    for (var j = -3; j <= 3; j++) {
      var c = ci + j; if (c < 0 || c >= n || !(cap[c] > 0)) continue;
      h[c] = Math.min(cap[c], h[c] + apport * poids[j + 3] / toit.pas);
    }
  }
  function lisse() {                                 // la neige s'étale un peu, sans dépasser ce que la pente permet
    var h = toit.h, cap = toit.cap, n = toit.n, p = 0, c;
    for (var i = 0; i < n; i++) {
      c = h[i];
      if (i > 0 && i < n - 1) h[i] = c + 0.12 * ((p + h[i + 1]) / 2 - c);
      if (h[i] > cap[i]) h[i] = cap[i];
      p = c;
    }
  }
  function dessinToit() {
    var n = toit.n, pas = toit.pas, x0 = toit.x0, h = toit.h, surf = toit.surf, k = toit.k;
    var bas = 2.5 * k, sous = [], i, run = false, debut = 0;
    ctx.beginPath();
    function fermer(fin) {
      for (var j = fin; j >= debut; j--) ctx.lineTo(x0 + (j + 0.5) * pas, surf[j] + bas);
      ctx.closePath();
    }
    for (i = 0; i < n; i++) {
      var ok = surf[i] === surf[i] && h[i] > 0.4;
      if (ok) {
        var x = x0 + (i + 0.5) * pas, y = surf[i] - h[i];
        if (!run) { run = true; debut = i; ctx.moveTo(x, surf[i] + bas); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
      } else if (run) { run = false; fermer(i - 1); }
    }
    if (run) fermer(n - 1);
    ctx.save();
    ctx.shadowColor = "rgba(140,170,215,.65)"; ctx.shadowBlur = 5 * k;
    ctx.fillStyle = "rgba(249,252,255,.98)";
    ctx.fill();
    ctx.restore();
  }

  function chasseToit(dt, vxp, vyp) {                // le curseur balaie la neige du toit
    var n = toit.n, pas = toit.pas, x0 = toit.x0, h = toit.h, surf = toit.surf, R = RAYON * 0.9;
    var vit = Math.sqrt(vxp * vxp + vyp * vyp);
    for (var i = 0; i < n; i++) {
      if (!(h[i] > 0.05)) continue;
      var px = x0 + (i + 0.5) * pas, dx = px - ptr.x;
      if (dx > R || dx < -R) continue;
      var py = surf[i] - h[i], dy = py - ptr.y;
      if (dy > R || dy < -R) continue;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d >= R) continue;
      var q = 1 - d / R;
      var enleve = Math.min(h[i], (50 * q * q + vit * 0.035 * q) * dt * Math.max(0.6, toit.k));
      h[i] -= enleve; toit.acc += enleve * pas;
      while (toit.acc >= 9 && nTemp < MAX_TEMP) {
        toit.acc -= 9;
        var dd = d || 1, s = Math.floor(Math.random() * 3);
        flocons.push({
          x: px + (Math.random() - 0.5) * pas, y: py - 1, s: s, temp: true,
          vy: 26 + Math.random() * 20, amp: 3 + Math.random() * 6,
          freq: 0.6 + Math.random() * 0.9, ph: Math.random() * 6.283, alpha: 0.95,
          ox: (dx / dd) * (140 + Math.random() * 260) + vxp * 0.35,
          oy: (dy / dd) * 80 - 60 - Math.random() * 170 + vyp * 0.2
        });
        nTemp++;
      }
      if (toit.acc > 40) toit.acc = 40;
    }
  }


  /* ---------- Meuble et petits sapins : neige dans le repère du décor 360° ----------
     Les zones et le calque `tas` sont en pixels du décor (u - U0, v - V0) : ils suivent l'image quand on tourne. */
  var DEC = window.DECOR, REG = DEC.region, CELL = 8, SC = 0.6;
  var tas = document.createElement("canvas"), tg = tas.getContext("2d");
  var zones = [], cov = null, covZ = null, covW = 0, covH = 0, accTas = 0, spriteBlob = null;

  function faitBlob() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(250,252,255,.85)");
    gr.addColorStop(1, "rgba(250,252,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  spriteBlob = faitBlob();

  function tranche(pts, x) {                          // y mini et maxi du polygone à la verticale de x
    var lo = Infinity, hi = -Infinity, n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) {
        var y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
        if (y < lo) lo = y; if (y > hi) hi = y;
      }
    }
    return lo === Infinity ? null : [lo, hi];
  }
  function reg(a, b) { return ((a % b) + b) % b; }
  function monde(x, y) {                               // écran -> (colonne du calque, ligne du décor)
    var p = VUE.inv(x, y); return [reg(p[0] - REG.U0, DEC.w), p[1]];
  }

  function placerZones() {
    zones = [];
    tas.width = REG.RW; tas.height = REG.RH;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    covW = Math.ceil(REG.RW / CELL); covH = Math.ceil(REG.RH / CELL);
    cov = new Float32Array(covW * covH); covZ = new Uint8Array(covW * covH); accTas = 0;
    var ch = DEC.chalet, cx = reg(ch.u - REG.U0, DEC.w), demi = ch.larg / 360 * DEC.w / 2;
    DEC.zones.forEach(function (zc) {
      var pts = zc.pts, pas = 4, xs = pts.map(function (q) { return q[0]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var n = Math.ceil((x1 - x0) / pas), top = new Float32Array(n), bot = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var xx = x0 + (i + 0.5) * pas, t = tranche(pts, xx);
        if (!t) { top[i] = NaN; bot[i] = NaN; continue; }
        top[i] = t[0]; bot[i] = t[1];
        if (zc.chalet && Math.abs(xx - cx) < demi + 4) top[i] = Math.max(top[i], ch.vBase - 2);   // le chalet cache ce qui est derrière lui
        if (bot[i] - top[i] < 3) { top[i] = NaN; bot[i] = NaN; }
      }
      var rBase = 3.6 * SC, moyen = Math.PI * zc.rx * zc.ry * rBase * rBase;
      var surface = 0; for (i = 0; i < n; i++) if (top[i] === top[i]) surface += (bot[i] - top[i]) * pas;
      zones.push({ nom: zc.nom, x0: x0, pas: pas, n: n, top: top, bot: bot, rx: zc.rx, ry: zc.ry, a: zc.a,
                   sc: SC, nb: 0, max: Math.max(10, zc.budget * surface / moyen), moyenBlob: moyen });
    });
    zones.forEach(function (z, zi) {                   // un peu de neige dès l'arrivée
      var k = Math.floor(z.max * 0.3);
      for (var j = 0; j < k; j++) {
        var i = Math.floor(Math.random() * z.n); if (!(z.top[i] === z.top[i])) continue;
        poserTas(zi, z.x0 + (i + 0.5) * z.pas + (Math.random() - 0.5) * z.pas,
                 z.top[i] + Math.random() * (z.bot[i] - z.top[i]), 1 + Math.floor(Math.random() * 4));
      }
    });
    VUE.neige(tas);
  }

  function poserTas(zi, x, v, s) {                     // un flocon s'ajoute au tas de neige (x, v : repère du décor)
    var z = zones[zi]; if (z.nb >= z.max) return;
    var y = v - REG.V0;
    var r = (2 + s * 0.8) * z.sc, rx = r * z.rx, ry = r * z.ry;
    tg.globalAlpha = z.a[0] + Math.random() * (z.a[1] - z.a[0]);
    tg.drawImage(spriteBlob, x - rx, y - ry, rx * 2, ry * 2);
    tg.globalAlpha = 1;
    z.nb++; VUE.sale();
    var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx >= 0 && cx < covW && cy >= 0 && cy < covH) { cov[cy * covW + cx] += 1; covZ[cy * covW + cx] = zi; }
  }

  function chasseTas(dt, vit, vxp, vyp) {              // le curseur balaie la neige du meuble et des sapins
    var m0 = monde(ptr.x, ptr.y), k = VUE.echelle();
    var px = m0[0], py = m0[1] - REG.V0;
    var R = RAYON * 0.6 / k, ry = R * 0.8;
    if (px < -R || px > REG.RW + R || py < -ry || py > REG.RH + ry) return;
    tg.globalCompositeOperation = "destination-out";
    tg.globalAlpha = Math.min(0.9, 0.14 + vit * 0.0007);
    tg.drawImage(spriteBlob, px - R, py - ry, R * 2, ry * 2);
    tg.globalCompositeOperation = "source-over"; tg.globalAlpha = 1;
    VUE.sale();
    var cx0 = Math.max(0, Math.floor((px - R) / CELL)), cx1 = Math.min(covW - 1, Math.floor((px + R) / CELL));
    var cy0 = Math.max(0, Math.floor((py - ry) / CELL)), cy1 = Math.min(covH - 1, Math.floor((py + ry) / CELL));
    for (var cy = cy0; cy <= cy1; cy++) for (var cx = cx0; cx <= cx1; cx++) {
      var c = cy * covW + cx, v = cov[c]; if (v <= 0) continue;
      var mx = (cx + 0.5) * CELL - px, my = ((cy + 0.5) * CELL - py) / 0.8, d = Math.sqrt(mx * mx + my * my);
      if (d > R) continue;
      var pris = Math.min(v, v * 0.3 + 0.06);
      cov[c] -= pris; accTas += pris;
      var z = zones[covZ[c]]; if (z) z.nb = Math.max(0, z.nb - pris);
      while (accTas >= 1) {
        accTas -= 1;
        if (nTemp >= MAX_TEMP) continue;
        var sp = VUE.proj(REG.U0 + (cx + Math.random()) * CELL, REG.V0 + (cy + Math.random()) * CELL);
        if (!sp) continue;
        var dd = d || 1;
        flocons.push({
          x: sp[0], y: sp[1], s: Math.floor(Math.random() * 3), temp: true,
          vy: 26 + Math.random() * 20, amp: 3 + Math.random() * 6, freq: 0.6 + Math.random() * 0.9, ph: Math.random() * 6.283,
          alpha: 0.95, ox: (mx / dd) * (110 + Math.random() * 240) + vxp * 0.35,
          oy: (my / dd) * 60 - 50 - Math.random() * 160 + vyp * 0.2
        });
        nTemp++;
      }
    }
  }

  /* ---------- Flocons ---------- */
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
    var base = flocons.filter(function (f) { return !f.temp; });
    while (base.length < n) base.push(nouveau(true));
    base.length = n;
    flocons = base; nTemp = 0;
    miseEnPlaceToit();
  }

  function pointeur(e) {
    var t = e.timeStamp || performance.now();
    if (ptr.actif && ptr.t && t > ptr.t) {            // vitesse du curseur : il « souffle » les flocons
      var d = Math.max(8, t - ptr.t) / 1000;
      ptr.vx = ptr.vx * 0.5 + ((e.clientX - ptr.x) / d) * 0.5;
      ptr.vy = ptr.vy * 0.5 + ((e.clientY - ptr.y) / d) * 0.5;
    }
    ptr.t = t; ptr.x = e.clientX; ptr.y = e.clientY; ptr.actif = true;
  }
  window.addEventListener("pointermove", pointeur, { passive: true });
  window.addEventListener("pointerdown", pointeur, { passive: true });
  function fin() { ptr.actif = false; ptr.x = ptr.y = -9999; ptr.vx = ptr.vy = 0; ptr.t = 0; }
  window.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") fin(); }, { passive: true });
  window.addEventListener("pointercancel", fin, { passive: true });
  document.addEventListener("mouseleave", fin);
  window.addEventListener("blur", fin);

  var t0 = performance.now(), dernier = t0, prochaineVerif = 0;
  function image(now) {
    var dt = Math.min(0.05, (now - dernier) / 1000);
    dernier = now;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    var amort = Math.exp(-1.5 * dt);
    var vd = Math.exp(-6 * dt); ptr.vx *= vd; ptr.vy *= vd;
    var vmax = 1400, vxp = Math.max(-vmax, Math.min(vmax, ptr.vx)), vyp = Math.max(-vmax, Math.min(vmax, ptr.vy));

    verifieToit();
    var vit = Math.sqrt(vxp * vxp + vyp * vyp);
    if (zones.length && ptr.actif) chasseTas(dt, vit, vxp, vyp);
    if (toit.ok) {
      if (ptr.actif) chasseToit(dt, vxp, vyp);
      lisse();
      dessinToit();
    }

    for (var i = 0; i < flocons.length; i++) {
      var f = flocons[i];

      if (ptr.actif) {
        var ex = f.x - ptr.x, ey = f.y - ptr.y;
        if (ex < RAYON && ex > -RAYON && ey < RAYON && ey > -RAYON) {
          var d2 = ex * ex + ey * ey;
          if (d2 < RAYON * RAYON) {
            var d = Math.sqrt(d2) || 0.001;
            var k = 1 - d / RAYON;
            var force = k * k * 6500 * dt;        // plus c'est près, plus ça repousse
            f.ox += (ex / d) * force + vxp * k * 7 * dt;   // + entraînement dans le sens du geste
            f.oy += (ey / d) * force + vyp * k * 7 * dt;
          }
        }
      }
      f.ox *= amort; f.oy *= amort;

      var yPrec = f.y;
      f.x += f.ox * dt;
      f.y += (f.vy + f.oy) * dt;
      var x = f.x + Math.sin(t * f.freq + f.ph) * f.amp;

      if (f.y > H + 12 || x < -60 || x > W + 60) {
        if (f.temp) { flocons.splice(i, 1); i--; nTemp--; continue; }
        var n = nouveau(false);
        n.x = Math.random() * W;
        flocons[i] = n;
        continue;
      }

      if (toit.ok && f.y > yPrec) {                // un flocon qui tombe rencontre-t-il le toit ?
        var ci = Math.floor((x - toit.x0) / toit.pas);
        if (ci >= 0 && ci < toit.n && toit.surf[ci] === toit.surf[ci]) {
          var sommet = toit.surf[ci] - toit.h[ci];
          if (yPrec < sommet && f.y >= sommet) {
            poser(ci, f);
            if (f.temp) { flocons.splice(i, 1); i--; nTemp--; }
            else { var m = nouveau(false); m.x = Math.random() * W; flocons[i] = m; }
            continue;
          }
        }
      }

      if (zones.length) {                          // le flocon se pose-t-il sur le meuble ou un sapin ?
        var zi, z, zc, pose = false, w1 = null;
        if (f.yl !== undefined) {
          w1 = monde(x, f.y); z = zones[f.zi]; zc = Math.floor((w1[0] - z.x0) / z.pas);
          if (zc < 0 || zc >= z.n || !(z.top[zc] === z.top[zc])) f.yl = undefined;
          else if (w1[1] >= f.yl) pose = true;
        } else if (f.y > yPrec) {
          w1 = monde(x, f.y);
          var w0 = monde(x, yPrec);
          for (zi = 0; zi < zones.length; zi++) {
            z = zones[zi]; zc = Math.floor((w1[0] - z.x0) / z.pas);
            if (zc < 0 || zc >= z.n || !(z.top[zc] === z.top[zc])) continue;
            if (w0[1] < z.top[zc] && w1[1] >= z.top[zc]) {
              f.zi = zi; f.yl = z.top[zc] + (z.bot[zc] - z.top[zc]) * Math.random();
              if (w1[1] >= f.yl) pose = true;
              break;
            }
          }
        }
        if (pose) {
          poserTas(f.zi, w1[0], f.yl, f.s);
          if (f.temp) { flocons.splice(i, 1); i--; nTemp--; }
          else { var m2 = nouveau(false); m2.x = Math.random() * W; flocons[i] = m2; }
          continue;
        }
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
  placerZones();
  chargeProfil();
  requestAnimationFrame(function (n) { dernier = n; image(n); });
})();
