/* Flammes qui vacillent : on déforme les vrais pixels de l'image de fond (bougies, feu de cheminée)
   et on fait pulser un halo chaud. Réglages par fond dans jours.js (CALENDRIER.flammes). */
(function () {
  "use strict";
  var CAL = window.CALENDRIER, A = window.FOND_ACTIF;
  var cv = document.getElementById("flammes"), stage = document.getElementById("stage");
  if (!CAL || !CAL.flammes || !A || !cv || !stage) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var ctx = cv.getContext("2d");
  var img = null, imgSrc = "", cfg = null, regs = [], lueurs = [], dpr = 1, S = 1, vivant = false;

  function pret() { return img && img.complete && img.naturalWidth; }

  function construire() {
    var portrait = false;
    var jour = CAL.flammes[A.n];
    cfg = jour ? (portrait ? jour.mobile : jour.desktop) : null;
    regs = []; lueurs = [];
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!cfg) return;
    var src = portrait ? A.mobile : A.desktop;
    if (src !== imgSrc) { imgSrc = src; img = new Image(); img.onload = construire; img.src = src; return; }
    if (!pret()) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var sw = stage.offsetWidth, sh = stage.offsetHeight;
    cv.width = Math.round(sw * dpr); cv.height = Math.round(sh * dpr);
    S = sw / cfg.w;
    regs = cfg.regions.map(function (r) {
      var pw = Math.max(2, Math.ceil(r.sw * S * dpr)), ph = Math.max(2, Math.ceil(r.sh * S * dpr));
      var oc = document.createElement("canvas"); oc.width = pw; oc.height = ph;
      var mk = document.createElement("canvas"); mk.width = pw; mk.height = ph;
      var g = mk.getContext("2d");
      g.translate(pw / 2, ph / 2); g.scale(1, ph / pw);
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, pw / 2);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(-pw / 2, -pw / 2 * (pw / ph), pw, pw * (pw / ph));
      return { r: r, oc: oc, octx: oc.getContext("2d"), mk: mk, pw: pw, ph: ph, seed: Math.random() * 20 };
    });
    lueurs = cfg.lueurs || [];
    if (!vivant) { vivant = true; requestAnimationFrame(image); }
  }

  function bruit(t, s) {                              // valeur lisse entre 0 et 1
    return 0.5 + 0.5 * (Math.sin(t * 7.3 + s) + Math.sin(t * 11.7 + s * 2.1) + Math.sin(t * 3.9 + s * 3.3)) / 3;
  }

  function image(now) {
    requestAnimationFrame(image);
    if (!regs.length || !pret() || document.hidden) return;
    var t = now / 1000, k = S * dpr;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < regs.length; i++) {
      var R = regs[i], r = R.r, o = R.octx, vit = r.vit || 1, p = r.p || 1.2;
      o.clearRect(0, 0, R.pw, R.ph);
      for (var y = 0; y < r.sh; y++) {
        var w = Math.pow(1 - y / r.sh, p);
        var d = r.amp * w * (0.55 * Math.sin(t * 9 * vit + y * 0.34 + R.seed) + 0.3 * Math.sin(t * 5.3 * vit + y * 0.15 + R.seed * 2) +
                              0.35 * Math.sin(t * 2.1 * vit + R.seed * 3)) * k;
        o.drawImage(img, r.sx, r.sy + y, r.sw, 1, d, y * k, R.pw, k + 0.8);
      }
      o.globalCompositeOperation = "destination-in"; o.drawImage(R.mk, 0, 0); o.globalCompositeOperation = "source-over";
      ctx.drawImage(R.oc, r.sx * k, r.sy * k);
    }
    ctx.globalCompositeOperation = "lighter";
    for (var j = 0; j < lueurs.length; j++) {
      var L = lueurs[j], a = L.a * (0.35 + 0.9 * bruit(t, j * 1.7 + 0.5)), rad = L.r * k * (0.92 + 0.16 * bruit(t * 0.8, j * 2.3));
      var gr = ctx.createRadialGradient(L.x * k, L.y * k, 0, L.x * k, L.y * k, rad);
      gr.addColorStop(0, "rgba(255,190,90," + a.toFixed(3) + ")"); gr.addColorStop(0.5, "rgba(255,150,50," + (a * 0.4).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = gr; ctx.fillRect(L.x * k - rad, L.y * k - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  var tm = 0;
  window.addEventListener("resize", function () { clearTimeout(tm); tm = setTimeout(construire, 120); });
  construire();
})();
