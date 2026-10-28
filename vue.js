/* Décor 360° : image équirectangulaire affichée en WebGL.
   - Téléphone : on pivote le téléphone (gyroscope) pour regarder autour de soi. Le doigt ne déplace pas l'image.
   - PC : on regarde autour en cliquant-glissant (souris) ou avec les flèches du clavier.
   - Le chalet est une « étiquette » qui suit le point du décor où il est posé (sur le meuble).
   - La neige du meuble est une calque dans le repère de l'image 360° (elle suit le décor).
   - Les flammes (cheminée, bougies) vacillent dans le shader. */
(function () {
  "use strict";
  var CAL = window.CALENDRIER;
  var scene = document.getElementById("scene");
  var cv = document.getElementById("vue");
  var chaletEl = document.getElementById("chalet");
  var gl = cv.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  var PI = Math.PI, TAU = 2 * PI;

  /* ---------- Décor du jour ---------- */
  var pr = new URLSearchParams(location.search), es = /^\d{4}-\d{2}-\d{2}$/.test(pr.get("date") || "") ? pr.get("date") : null;
  var dn = new Date(); if (es) { var pp = es.split("-"); dn = new Date(+pp[0], +pp[1] - 1, +pp[2]); }
  var jc = (dn.getFullYear() < CAL.annee || (dn.getFullYear() === CAL.annee && dn.getMonth() < 11)) ? 0
         : (dn.getFullYear() > CAL.annee || dn.getDate() >= 24) ? 24 : dn.getDate();
  var jourRef = Math.max(1, Math.min(24, CAL.debloquerTout ? 24 : jc));
  var dispo = (CAL.fonds || []).filter(function (n) { return n <= jourRef; });
  var nFond = dispo.length ? Math.max.apply(null, dispo) : (CAL.fonds && CAL.fonds[0]) || 1;
  var D = CAL.decors[nFond];
  window.DECOR = D;

  /* ---------- Vue (caméra) ---------- */
  var tactile = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  var V = {
    yaw: D.vue.yaw, pitch: D.vue.pitch, cYaw: D.vue.yaw, cPitch: D.vue.pitch,       // courant / cible
    w: 1, h: 1, f: 500, minP: D.vue.pitchMin, maxP: D.vue.pitchMax,
    rect: { left: 0, top: 0, width: 0, height: 0 }, chaletS: 1, vu: 0
  };
  var DEG = PI / 180;
  function reg(a, b) { return ((a % b) + b) % b; }

  function base(yaw, pitch) {                            // vecteurs de la caméra
    if (yaw === undefined) { yaw = V.yaw; pitch = V.pitch; }
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { f: [sy * cp, sp, cy * cp], r: [cy, 0, -sy], u: [-sy * sp, cp, -cy * sp] };
  }
  var B = base();
  // pixel du décor (u, v en pixels de l'image) -> écran
  function proj(u, v) {
    var lon = u / D.w * TAU, lat = (0.5 - v / D.h) * PI, cl = Math.cos(lat);
    var dx = Math.sin(lon) * cl, dy = Math.sin(lat), dz = Math.cos(lon) * cl;
    var z = dx * B.f[0] + dy * B.f[1] + dz * B.f[2];
    if (z < 0.05) return null;
    return [V.w / 2 + V.f * (dx * B.r[0] + dy * B.r[1] + dz * B.r[2]) / z,
            V.h / 2 - V.f * (dx * B.u[0] + dy * B.u[1] + dz * B.u[2]) / z];
  }
  // écran -> pixel du décor
  function inv(x, y) {
    var a = (x - V.w / 2) / V.f, b = -(y - V.h / 2) / V.f;
    var dx = B.f[0] + a * B.r[0] + b * B.u[0], dy = B.f[1] + a * B.r[1] + b * B.u[1], dz = B.f[2] + a * B.r[2] + b * B.u[2];
    var lon = Math.atan2(dx, dz), lat = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    return [reg(lon / TAU, 1) * D.w, (0.5 - lat / PI) * D.h];
  }

  /* ---------- Chalet : posé sur le meuble ---------- */
  var HA = 1541 / 1200;                                  // hauteur / largeur du chalet
  // Le chalet est un plan vertical posé sur le meuble, tourné vers le point de départ. On projette ses 4 coins avec la
  // même caméra que le décor (homographie CSS) : il est donc ancré au meuble et se déforme comme un vrai objet.
  var plan = null;
  function calculPlan() {
    var c = D.chalet, w = 2 * Math.tan(c.larg * DEG / 2), yb = Math.tan((0.5 - c.vBase / D.h) * PI);
    var lon = c.u / D.w * TAU, sl = Math.sin(lon), cl = Math.cos(lon);
    // repère du plan : origine au pied, x vers la droite, y vers le haut ; il regarde l'observateur (au centre)
    var ox = sl, oz = cl, rx = cl, rz = -sl;
    function pt(x, y) { return [ox + rx * x, yb + y, oz + rz * x]; }
    plan = { w: w, h: w * HA, P: [pt(-w / 2, w * HA), pt(w / 2, w * HA), pt(w / 2, 0), pt(-w / 2, 0)] };   // HG, HD, BD, BG
    plan.Wpx = 2 * V.f * Math.tan(c.larg * DEG / 2);
    chaletEl.style.width = plan.Wpx.toFixed(1) + "px";
    chaletEl.style.transformOrigin = "0 0";
  }
  function ecran(P) {
    var z = P[0] * B.f[0] + P[1] * B.f[1] + P[2] * B.f[2];
    if (z < 0.05) return null;
    return [V.w / 2 + V.f * (P[0] * B.r[0] + P[1] * B.r[1] + P[2] * B.r[2]) / z, V.h / 2 - V.f * (P[0] * B.u[0] + P[1] * B.u[1] + P[2] * B.u[2]) / z];
  }
  function placerChalet() {
    if (!plan) calculPlan();
    var q = [ecran(plan.P[0]), ecran(plan.P[1]), ecran(plan.P[2]), ecran(plan.P[3])];
    if (!q[0] || !q[1] || !q[2] || !q[3]) { chaletEl.style.visibility = "hidden"; V.rect.width = 0; return; }
    chaletEl.style.visibility = "";
    var W = plan.Wpx, H = W * HA;
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dy1 * dx2, g = (dx3 * dy2 - dy3 * dx2) / den, h = (dx1 * dy3 - dy1 * dx3) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
    chaletEl.style.transform = "matrix3d(" + [a / W, d / W, 0, g / W, b / H, e / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1].map(function (n) { return n.toFixed(6); }).join(",") + ")";
    var r = V.rect;                                       // rectangle équivalent (pour la neige du toit)
    r.left = (x0 + x3) / 2; r.width = ((x1 - x0) + (x2 - x3)) / 2; r.top = (y0 + y1) / 2; r.height = ((y3 + y2) / 2) - r.top;
  }

  /* ---------- WebGL ---------- */
  var prog, loc = {}, texBg, texSnow, snowCanvas = null, snowSale = false, pret = false;
  var VS = "#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}";
  var FS = "#version 300 es\nprecision highp float;\n" +
    "uniform sampler2D uBg;uniform sampler2D uSnow;uniform vec3 uF,uR,uU;uniform vec2 uRes,uTex;uniform float uFoc,uT,uFlN;\n" +
    "uniform vec4 uFl[16];uniform vec4 uReg;uniform float uSnowOn;out vec4 o;const float PI=3.14159265;\n" +
    "void main(){\n" +
    " vec2 p=gl_FragCoord.xy-.5*uRes;\n" +
    " vec3 d=normalize(uF+(p.x/uFoc)*uR+(p.y/uFoc)*uU);\n" +
    " float u=atan(d.x,d.z)/(2.*PI);float u2=fract(u);float v=.5-asin(clamp(d.y,-1.,1.))/PI;\n" +
    " float gx=abs(dFdx(u2))>.5?dFdx(u):dFdx(u2);float gy=abs(dFdy(u2))>.5?dFdy(u):dFdy(u2);\n" +
    " vec2 dX=vec2(gx,dFdx(v)),dY=vec2(gy,dFdy(v));\n" +
    " vec2 px=vec2(u2*uTex.x,v*uTex.y);\n" +
    " float glow=0.;vec2 sh=vec2(0.);\n" +
    " for(int i=0;i<16;i++){if(float(i)>=uFlN)break;vec4 f=uFl[i];\n" +
    "  float dx=px.x-f.x;dx-=uTex.x*floor(dx/uTex.x+.5);\n" +
    "  vec2 q=vec2(dx/f.z,(px.y-f.y)/f.w);float m=1.-smoothstep(.3,1.,length(q));\n" +
    "  if(m<=0.)continue;\n" +
    "  float h=clamp((f.y+f.w-px.y)/(2.*f.w),0.,1.);\n" +
    "  float w=.55*sin(uT*9.+px.y*.34+f.x)+.3*sin(uT*5.3+px.y*.15+f.x*2.)+.35*sin(uT*2.1+f.x*3.);\n" +
    "  sh.x+=m*f.z*.17*h*w;sh.y+=m*f.w*.05*h*sin(uT*7.+f.x);\n" +
    "  glow+=m*m*(.16+.08*sin(uT*6.3+f.x)+.05*sin(uT*13.1+f.x*2.));}\n" +
    " vec2 uv=vec2((px.x+sh.x)/uTex.x,(px.y+sh.y)/uTex.y);\n" +
    " vec3 c=textureGrad(uBg,uv,dX,dY).rgb;\n" +
    " c+=vec3(1.,.58,.2)*glow;\n" +
    " if(uSnowOn>.5){vec2 rp=vec2(mod(px.x-uReg.x,uTex.x),px.y-uReg.y)/uReg.zw;\n" +
    "  if(rp.x>=0.&&rp.x<=1.&&rp.y>=0.&&rp.y<=1.){vec4 s=texture(uSnow,rp);c=c*(1.-s.a)+s.rgb*vec3(1.,.97,.93);}}\n" +
    " o=vec4(c,1.);}";

  function shader(t, src) {
    var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function tex(img, mips) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mips ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (img) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); if (mips) gl.generateMipmap(gl.TEXTURE_2D); }
    return t;
  }
  function initGL() {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ["uBg", "uSnow", "uF", "uR", "uU", "uRes", "uTex", "uFoc", "uT", "uFlN", "uFl", "uReg", "uSnowOn"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(loc.uBg, 0); gl.uniform1i(loc.uSnow, 1);
    gl.uniform2f(loc.uTex, D.w, D.h);
    var fl = D.flammes || [], arr = new Float32Array(64);
    fl.slice(0, 16).forEach(function (q, i) { arr[i * 4] = q[0]; arr[i * 4 + 1] = q[1]; arr[i * 4 + 2] = q[2]; arr[i * 4 + 3] = q[3]; });
    gl.uniform4fv(loc.uFl, arr); gl.uniform1f(loc.uFlN, Math.min(16, fl.length));
    gl.uniform4f(loc.uReg, D.region.U0, D.region.V0, D.region.RW, D.region.RH);
    gl.activeTexture(gl.TEXTURE1); texSnow = tex(null, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.activeTexture(gl.TEXTURE0);
  }

  function taille() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    V.w = window.innerWidth; V.h = window.innerHeight;
    var rs = Math.min(1, 2400 / Math.max(V.w * dpr, V.h * dpr));          // pas plus de ~2400 px de large
    cv.width = Math.round(V.w * dpr * rs); cv.height = Math.round(V.h * dpr * rs);
    var vfov = (V.h > V.w ? D.vue.fovPortrait : D.vue.fovPaysage) * DEG;
    V.f = (V.h / 2) / Math.tan(vfov / 2);
    if (gl) gl.viewport(0, 0, cv.width, cv.height);
    plan = null; V.vu++;
  }
  window.addEventListener("resize", taille);

  /* ---------- Commandes ---------- */
  function borne() {
    V.cPitch = Math.max(V.minP, Math.min(V.maxP, V.cPitch));
  }
  var dec = { yaw: 0, pitch: 0 }, gyro = { actif: false, ref: null, refP: 0 }, gyroRefuse = false, essais = 0;
  function msg(t) { if (window.MESSAGE) window.MESSAGE(t); }

  // souris (et doigt seulement si le gyroscope est refusé)
  var glisse = null, dernierGlisse = 0;
  window.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest("#carte,#son,#fermer,#pano")) return;
    if (e.pointerType !== "mouse" && !gyroRefuse) return;                  // le doigt ne déplace pas l'image
    if (e.pointerType === "mouse" && e.button !== 0) return;
    glisse = { x: e.clientX, y: e.clientY, yaw: V.cYaw, pitch: V.cPitch, actif: false };
  }, { passive: true });
  window.addEventListener("pointermove", function (e) {
    if (!glisse) return;
    var dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
    if (!glisse.actif && Math.hypot(dx, dy) > 8) { glisse.actif = true; document.body.classList.add("glisse"); }
    if (glisse.actif) {
      V.cYaw = glisse.yaw - dx / V.f; V.cPitch = glisse.pitch + dy / V.f; borne(); dernierGlisse = Date.now();
    }
  }, { passive: true });
  function finGlisse() {
    if (glisse && glisse.actif && gyro.actif) { gyro.ref = null; dec.yaw = V.cYaw; dec.pitch = V.cPitch; }
    glisse = null; document.body.classList.remove("glisse");
  }
  window.addEventListener("pointerup", finGlisse, { passive: true });
  window.addEventListener("pointercancel", finGlisse, { passive: true });
  document.addEventListener("click", function (e) {                        // un glissement n'ouvre pas une porte
    if (Date.now() - dernierGlisse < 350) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  var touches = {};
  window.addEventListener("keydown", function (e) {
    if (document.getElementById("carte") && !document.getElementById("carte").hidden) return;
    var k = e.key, p = 8 * DEG;
    if (k === "ArrowLeft") V.cYaw -= p; else if (k === "ArrowRight") V.cYaw += p;
    else if (k === "ArrowUp") V.cPitch += p * 0.6; else if (k === "ArrowDown") V.cPitch -= p * 0.6; else return;
    borne();
  });

  // gyroscope : on calcule la direction vers laquelle pointe l'arrière du téléphone
  function surOrientation(e) {
    if (e.alpha == null || e.beta == null) return;
    var a = e.alpha * DEG, b = e.beta * DEG, g = (e.gamma || 0) * DEG;
    var X = -Math.sin(g) * Math.cos(a) - Math.cos(g) * Math.sin(b) * Math.sin(a);
    var Y = -Math.sin(g) * Math.sin(a) + Math.cos(g) * Math.sin(b) * Math.cos(a);
    var Z = -Math.cos(g) * Math.cos(b);
    var yaw = Math.atan2(X, Y), pit = Math.asin(Math.max(-1, Math.min(1, Z)));
    if (!gyro.actif) { gyro.actif = true; document.getElementById("pano").classList.add("actif"); }
    if (gyro.ref == null) { gyro.ref = yaw; gyro.refP = pit; gyro.base = { yaw: dec.yaw || D.vue.yaw, pitch: dec.pitch || D.vue.pitch }; }
    var dy = yaw - gyro.ref; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    V.cYaw = gyro.base.yaw + dy; V.cPitch = gyro.base.pitch + (pit - gyro.refP); borne();
  }
  function activerGyro(geste) {
    window.addEventListener("deviceorientation", surOrientation);           // Android : pas de permission
    var DOE = window.DeviceOrientationEvent;
    if (geste && !gyro.actif && !gyroRefuse && essais < 3 && DOE && typeof DOE.requestPermission === "function") {
      essais++;                                                             // iOS : la permission se demande sur un geste
      DOE.requestPermission().then(function (r) {
        if (r === "granted") { window.addEventListener("deviceorientation", surOrientation); if (geste === "bouton") msg("Tourne ton téléphone pour regarder autour de toi"); }
        else { gyroRefuse = true; msg("Gyroscope refusé : glisse le doigt sur l'image"); }
      }).catch(function () {});
    }
  }
  var bouton = document.getElementById("pano");
  bouton.addEventListener("click", function () {
    if (gyro.actif) { gyro.ref = null; dec.yaw = D.vue.yaw; dec.pitch = D.vue.pitch; msg("Vue recentrée sur le chalet"); }
    else activerGyro("bouton");
  });
  if (tactile) document.addEventListener("click", function () { activerGyro(true); });

  /* ---------- Neige du meuble : calque dans le repère du décor ---------- */
  var dirtyT = 0;
  window.VUE = {
    D: D, V: V, proj: proj, inv: inv,
    echelle: function () { return V.f * TAU / D.w; },                      // pixels d'écran par pixel du décor
    rect: V.rect,
    neige: function (canvas) { snowCanvas = canvas; snowSale = true; },
    sale: function () { snowSale = true; }
  };

  /* ---------- Boucle ---------- */
  var t0 = performance.now(), dernierUp = 0, prec = 0;
  function image(now) {
    requestAnimationFrame(image);
    if (!pret) return;
    var k = 1 - Math.exp(-(window.__dt || 0.016) * 10);
    var dy = V.cYaw - V.yaw, dp = V.cPitch - V.pitch;
    if (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5) { V.yaw += dy * k; V.pitch += dp * k; B = base(); V.vu++; }
    placerChalet();
    gl.uniform3f(loc.uF, B.f[0], B.f[1], B.f[2]); gl.uniform3f(loc.uR, B.r[0], B.r[1], B.r[2]); gl.uniform3f(loc.uU, B.u[0], B.u[1], B.u[2]);
    gl.uniform2f(loc.uRes, cv.width, cv.height); gl.uniform1f(loc.uFoc, V.f * cv.width / V.w);
    gl.uniform1f(loc.uT, (now - t0) / 1000);
    if (snowCanvas && snowSale && now - dernierUp > 30) {
      dernierUp = now; snowSale = false;
      gl.activeTexture(gl.TEXTURE1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snowCanvas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(loc.uSnowOn, 1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  var dernierT = performance.now();
  (function horloge() { var n = performance.now(); window.__dt = Math.min(0.05, (n - dernierT) / 1000); dernierT = n; requestAnimationFrame(horloge); })();

  taille();
  B = base();
  if (!gl) { document.body.classList.add("sans-webgl"); return; }
  try { initGL(); } catch (err) { console.error(err); document.body.classList.add("sans-webgl"); return; }
  var img = new Image();
  img.onload = function () {
    gl.activeTexture(gl.TEXTURE0); texBg = tex(img, true);
    pret = true; document.body.classList.add("decor-pret");
    if (tactile) { activerGyro(false); setTimeout(function () { msg("Tourne ton téléphone pour regarder autour de toi"); }, 1500); }
    else setTimeout(function () { msg("Clique et glisse pour regarder autour de toi"); }, 1500);
  };
  img.src = D.img;
  requestAnimationFrame(image);
})();
