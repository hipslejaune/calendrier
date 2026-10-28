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
    plan = { w: w, h: w * HA, ox: sl, oz: cl, rx: cl, rz: -sl, yb: yb };
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
    // Le chalet est un objet FIXE posé sur le meuble : plan vertical à sa place dans la pièce, projeté par la même caméra que le décor.
    // On utilise une vraie transformation CSS 3D (perspective = focale) : le navigateur découpe correctement la partie qui passe
    // derrière la caméra, donc le chalet ne disparaît plus d'un coup quand on regarde le meuble de côté.
    var sc = chaletEl.parentNode;
    if (V.pf !== V.f || V.pw !== V.w || V.ph !== V.h) {
      V.pf = V.f; V.pw = V.w; V.ph = V.h;
      sc.style.perspective = V.f.toFixed(2) + "px"; sc.style.perspectiveOrigin = (V.w / 2).toFixed(1) + "px " + (V.h / 2).toFixed(1) + "px";
    }
    var w2 = plan.w / 2, hh = plan.w * HA;
    var Pc = [[plan.ox - plan.rx * w2, plan.yb + hh, plan.oz - plan.rz * w2], [plan.ox + plan.rx * w2, plan.yb + hh, plan.oz + plan.rz * w2],
              [plan.ox + plan.rx * w2, plan.yb, plan.oz + plan.rz * w2], [plan.ox - plan.rx * w2, plan.yb, plan.oz - plan.rz * w2]];
    var zs = Pc.map(function (P) { return P[0] * B.f[0] + P[1] * B.f[1] + P[2] * B.f[2]; });
    if (Math.max.apply(null, zs) < 0.02) { chaletEl.style.visibility = "hidden"; V.rect.width = 0; V.hom = null; return; }
    chaletEl.style.visibility = "";
    var W = plan.Wpx, H = W * HA, F = V.f, k = plan.w / W;       // k : unités du monde par pixel du chalet
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var ex = [plan.rx, 0, plan.rz], ey = [0, -1, 0], O = Pc[0];
    var col0 = [F * k * dot(ex, B.r), -F * k * dot(ex, B.u), -F * k * dot(ex, B.f)];
    var col1 = [F * k * dot(ey, B.r), -F * k * dot(ey, B.u), -F * k * dot(ey, B.f)];
    var t = [V.w / 2 + F * dot(O, B.r), V.h / 2 - F * dot(O, B.u), F * (1 - dot(O, B.f))];
    chaletEl.style.transform = "matrix3d(" + [col0[0], col0[1], col0[2], 0, col1[0], col1[1], col1[2], 0, 0, 0, 1, 0, t[0], t[1], t[2], 1].map(function (n) { return n.toFixed(6); }).join(",") + ")";
    // homographie écran <-> chalet (pour la neige du toit) : seulement si les 4 coins sont devant la caméra
    var q = [ecran(Pc[0]), ecran(Pc[1]), ecran(Pc[2]), ecran(Pc[3])];
    if (!q[0] || !q[1] || !q[2] || !q[3]) { V.hom = null; V.rect.width = 0; return; }
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dy1 * dx2, g = (dx3 * dy2 - dy3 * dx2) / den, h = (dx1 * dy3 - dy1 * dx3) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
    V.hom = { a: a, b: b, c: x0, d: d, e: e, f: y0, g: g, h: h, W: W, H: H };
    var r = V.rect;                                       // rectangle équivalent (pour la neige du toit)
    r.left = (x0 + x3) / 2; r.width = ((x1 - x0) + (x2 - x3)) / 2; r.top = (y0 + y1) / 2; r.height = ((y3 + y2) / 2) - r.top;
  }

  /* ---------- WebGL ---------- */
  var prog, loc = {}, texBg, texSnow, texBoard, texLm, snowCanvas = null, snowSale = false, pret = false;
  var VS = "#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}";
  var FS = "#version 300 es\nprecision highp float;\n" +
    "uniform sampler2D uBg;uniform sampler2D uSnow;uniform vec3 uF,uR,uU;uniform vec2 uRes,uTex;uniform float uFoc,uT,uFlN;\n" +
    "uniform vec4 uFl[16];uniform vec4 uReg;uniform float uSnowOn;uniform sampler2D uBoard;uniform sampler2D uLm;uniform vec4 uLr;uniform float uLmOn;uniform vec4 uBd;uniform float uBdOn;out vec4 o;const float PI=3.14159265;\n" +
    "uniform vec4 uTr[2];uniform vec4 uSt[2];uniform vec3 uSc[2];uniform vec4 uAr,uGu,uEx;\n" +
    "float hsh(float n){return fract(sin(n*91.345+17.1)*43758.5453);}\n" +
    "vec3 pal(float h){int i=int(floor(h*6.));\n" +
    " if(i==0)return vec3(1.,.12,.1);if(i==1)return vec3(1.,.6,.14);if(i==2)return vec3(.25,1.,.35);\n" +
    " if(i==3)return vec3(.25,.5,1.);if(i==4)return vec3(1.,.25,.7);return vec3(1.,.88,.62);}\n" +
    "vec3 guirlande(vec2 q,vec4 T,float seed){vec3 acc=vec3(0.);\n" +
    " float dx=q.x-T.x;dx-=uTex.x*floor(dx/uTex.x+.5);\n" +
    " if(abs(dx)>T.w*1.3||q.y<T.y-8.||q.y>T.z+8.)return acc;\n" +
    " for(int r=0;r<7;r++){float tr=.17+float(r)*.125;float vr=T.y+tr*(T.z-T.y-20.);\n" +
    "  float hw=T.w*(1.-pow(1.-tr,2.2))*.9;float nB=3.+floor(hw/10.);\n" +
    "  for(int k=0;k<9;k++){if(float(k)>=nB)break;\n" +
    "   float id=float(r)*17.+float(k)*3.+seed;\n" +
    "   float ph=PI*clamp((float(k)+.5+.35*sin(float(r)*2.1))/nB,.05,.95);\n" +
    "   vec2 b=vec2(-hw*cos(ph)+(hsh(id+5.)-.5)*3.,vr+.2*hw*sin(ph)+(hsh(id+6.)-.5)*3.);\n" +
    "   vec2 dd=vec2(dx,q.y)-vec2(0.,0.)-b-vec2(0.,0.);dd.y=q.y-(b.y);\n" +
    "   float d2=dd.x*dd.x+dd.y*dd.y;if(d2>200.)continue;\n" +
    "   float tw=.5+.5*sin(uT*(1.3+hsh(id)*2.7)+hsh(id+1.)*40.);tw=tw*tw;\n" +
    "   vec3 col=pal(hsh(id+2.));\n" +
    "   float core=exp(-d2/4.5);float glow=exp(-d2/60.);\n" +
    "   float cr=(exp(-abs(dd.x)*.8-dd.y*dd.y*.9)+exp(-abs(dd.y)*.8-dd.x*dd.x*.9))*tw*tw;\n" +
    "   acc+=col*(core*1.3+glow*.5)*(.3+.9*tw)+vec3(1.,.97,.9)*(core*.55*tw+cr*.35);}}\n" +
    " return acc;}\n" +
    "vec4 etoile(vec2 dd,float R,float n,float rat,vec3 base){\n" +
    " vec2 p=vec2(dd.x,-dd.y);float d=length(p);float s=PI/n;float ang=atan(p.x,p.y);\n" +
    " float raw=mod(ang+s,2.*s)-s;float a=abs(raw);\n" +
    " vec2 P1=vec2(R,0.),P2=R*rat*vec2(cos(s),sin(s)),e=P2-P1,dr=vec2(cos(a),sin(a));\n" +
    " float t=(P1.x*e.y-P1.y*e.x)/(dr.x*e.y-dr.y*e.x);\n" +
    " float cov=1.-smoothstep(t-.8,t+.5,d);\n" +
    " float fac=raw>0.?1.14:.78;float grad=.78+.3*(p.y/R);float rim=smoothstep(t-2.4,t,d);\n" +
    " vec3 col=base*fac*grad+base*.22*rim+vec3(1.,.96,.82)*pow(max(0.,1.-d/(R*.5)),3.)*.3;\n" +
    " return vec4(col,cov);}\n" +
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
    "  float kf=f.z>40.?.22:1.;sh.x+=m*f.z*.17*h*w*kf;sh.y+=m*f.w*.05*h*sin(uT*7.+f.x)*kf;\n" +
    "  glow+=m*m*(.16+.08*sin(uT*6.3+f.x)+.05*sin(uT*13.1+f.x*2.));}\n" +
    " vec2 uv=vec2((px.x+sh.x)/uTex.x,(px.y+sh.y)/uTex.y);\n" +
    " vec3 c=textureGrad(uBg,uv,dX,dY).rgb;\n" +
    " if(uLmOn>.5){vec2 lp=vec2(px.x-uLr.x,px.y-uLr.y)/uLr.zw;\n" +
    "  if(lp.x>=0.&&lp.x<=1.&&lp.y>=0.&&lp.y<=1.){vec3 add=vec3(0.);\n" +
    "   for(int i=0;i<5;i++){vec2 o=i==0?vec2(0.):(i==1?vec2(1.,0.):(i==2?vec2(-1.,0.):(i==3?vec2(0.,1.):vec2(0.,-1.))));\n" +
    "    vec4 s=texture(uLm,lp+o*3./uLr.zw);float ph=s.g*255.;float w=i==0?1.:.45;\n" +
    "    float tw=.5+.5*sin(uT*(1.6+hsh(ph)*2.2)+ph*3.7);tw=smoothstep(.15,.9,tw);\n" +
    "    add+=vec3(1.,.8,.42)*s.r*w*(.1+tw*1.1);}\n" +
    "   c+=add*.85;}}\n" +

    " {float fl=.5+.3*sin(uT*.62)+.2*sin(uT*1.14+1.3)+.12*sin(uT*1.86+.4)+.08*sin(uT*2.8);\n" +
    "  vec2 fd=vec2(px.x-1520.,px.y-815.);float r=length(fd*vec2(1.,1.2));\n" +
    "  float inb=(1.-smoothstep(52.,78.,abs(fd.x)))*(1.-smoothstep(36.,56.,abs(px.y-822.)));\n" +
    "  c*=1.+inb*.21*fl;\n" +
    "  c+=vec3(1.,.5,.16)*(exp(-r/60.)*.5+exp(-r/150.)*.22+exp(-r/340.)*.14)*fl*.7*(.55+.45*inb+.45);}\n" +
    " {const vec4 SP[4]=vec4[4](vec4(179.,501.,12.,3.6),vec4(96.,575.,7.,2.6),vec4(2683.,516.,11.,3.2),vec4(2770.,579.,7.,2.6));\n" +
    "  float sw=.94+.06*sin(uT*1.7);\n" +
    "  for(int i=0;i<4;i++){vec4 s=SP[i];float dx=px.x-s.x;dx-=uTex.x*floor(dx/uTex.x+.5);\n" +
    "   vec2 q=vec2(dx/s.z,(px.y-s.y)/s.w);float d=length(q);\n" +
    "   float core=1.-smoothstep(.55,1.15,d);float hal=exp(-length(vec2(dx/(s.z*4.),(px.y-s.y)/(s.w*10.))) *1.3);\n" +
    "   c=mix(c,vec3(1.,.99,.96)*1.15,core*.96*sw);c+=vec3(1.,.97,.92)*hal*.26*sw;}}\n" +
    " c+=vec3(1.,.58,.2)*glow;\n" +
    " for(int t=0;t<2;t++){vec4 T=uTr[t];\n" +
    "  c+=guirlande(px,T,float(t)*101.);\n" +
    "  vec4 S=uSt[t];float cy=T.y-S.x*.38;float dx=px.x-T.x;dx-=uTex.x*floor(dx/uTex.x+.5);vec2 dd=vec2(dx,px.y-cy);\n" +
    "  if(length(dd)<S.x*4.){float tw=.9+.1*sin(uT*2.3+float(t)*2.);\n" +
    "   c+=uSc[t]*exp(-length(dd)/(S.x*.9))*.22*tw;\n" +
    "   }}\n" +
    " if(uSnowOn>.5){vec2 rp=vec2(mod(px.x-uReg.x,uTex.x),px.y-uReg.y)/uReg.zw;\n" +
    "  if(rp.x>=0.&&rp.x<=1.&&rp.y>=0.&&rp.y<=1.){vec4 s=texture(uSnow,rp);c=c*(1.-s.a)+s.rgb*vec3(1.,.97,.93);}}\n" +
    " if(uBdOn>.5){vec2 bp=vec2(mod(px.x-uBd.x+uTex.x*.5,uTex.x)-uTex.x*.5,px.y-uBd.y)/uBd.zw;\n" +
    "  if(bp.x>=0.&&bp.x<=1.&&bp.y>=0.&&bp.y<=1.){vec4 s=texture(uBoard,bp);vec3 bc=s.rgb*vec3(.96,.9,.8);\n" +
    "   float ed=min(min(bp.x,1.-bp.x),min(bp.y,1.-bp.y));bc*=.8+.2*smoothstep(0.,.08,ed);c=mix(c,bc,.94);}}\n" +
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
    ["uBg", "uSnow", "uF", "uR", "uU", "uRes", "uTex", "uFoc", "uT", "uFlN", "uFl", "uReg", "uSnowOn", "uBoard", "uLm", "uLr", "uLmOn", "uBd", "uBdOn", "uTr", "uSt", "uSc", "uAr", "uGu", "uEx"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(loc.uBg, 0); gl.uniform1i(loc.uSnow, 1); gl.uniform1i(loc.uBoard, 2); gl.uniform1i(loc.uLm, 3); gl.uniform4f(loc.uLr, 960, 480, 800, 460); gl.uniform1f(loc.uLmOn, 0);
    var TB = D.tableau || [2084, 784, 132, 101]; gl.uniform4f(loc.uBd, TB[0], TB[1], TB[2], TB[3]); gl.uniform1f(loc.uBdOn, 0);
    gl.uniform2f(loc.uTex, D.w, D.h);
    var fl = D.flammes || [], arr = new Float32Array(64);
    fl.slice(0, 16).forEach(function (q, i) { arr[i * 4] = q[0]; arr[i * 4 + 1] = q[1]; arr[i * 4 + 2] = q[2]; arr[i * 4 + 3] = q[3]; });
    gl.uniform4fv(loc.uFl, arr); gl.uniform1f(loc.uFlN, Math.min(16, fl.length));
    var sp = D.sapins || [], tr = new Float32Array(8), st = new Float32Array(8), sc = new Float32Array(6);
    sp.slice(0, 2).forEach(function (q, i) {
      tr.set([q.u, q.haut, q.bas, q.demi], i * 4); st.set([q.etoile.R, q.etoile.n, q.etoile.rat, 0], i * 4); sc.set(q.etoile.coul, i * 3);
    });
    gl.uniform4fv(loc.uTr, tr); gl.uniform4fv(loc.uSt, st); gl.uniform3fv(loc.uSc, sc);
    var sc2 = D.scintillements || { arbre: [0, 0, 1, 0], guirlande: [0, 0, 0, 0], exclu: [0, 0, 0, 0] };
    gl.uniform4fv(loc.uAr, sc2.arbre); gl.uniform4fv(loc.uGu, sc2.guirlande); gl.uniform4fv(loc.uEx, sc2.exclu);
    gl.uniform4f(loc.uReg, D.region.U0, D.region.V0, D.region.RW, D.region.RH);
    gl.activeTexture(gl.TEXTURE1); texSnow = tex(null, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.activeTexture(gl.TEXTURE2); texBoard = tex(null, true);
    gl.activeTexture(gl.TEXTURE3); texLm = tex(null, false);
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
    if (glisse && glisse.actif && gyro.actif) { gyro.ref = null; gyro.cum = undefined; gyro.prev = undefined; dec.yaw = V.cYaw; dec.pitch = V.cPitch; }
    glisse = null; document.body.classList.remove("glisse");
  }
  window.addEventListener("pointerup", finGlisse, { passive: true });
  window.addEventListener("pointercancel", finGlisse, { passive: true });
  document.addEventListener("click", function (e) {                        // un glissement n'ouvre pas une porte
    if (Date.now() - dernierGlisse < 350) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  function surTableau(x, y) {
    if (!pret) return false; var p = inv(x, y), T = D.tableau || [2084, 784, 132, 101];
    var dx = p[0] - T[0]; dx -= D.w * Math.floor(dx / D.w + .5);
    return dx >= 0 && dx <= T[2] && p[1] >= T[1] && p[1] <= T[3] + T[1];
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("#carte,#actions,#son,#pano,#chalet,#tableau-grand")) return;
    if (surTableau(e.clientX, e.clientY) && window.OUVRIR_TABLEAU) window.OUVRIR_TABLEAU();
  });
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "mouse" && !glisse) cv.style.cursor = surTableau(e.clientX, e.clientY) ? "pointer" : "";
  }, { passive: true });
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
    if (gyro.cum === undefined || gyro.prev === undefined) { gyro.cum = 0; gyro.prev = yaw; }
    var dd = yaw - gyro.prev; dd = Math.atan2(Math.sin(dd), Math.cos(dd));   // pas de saut à ±180° : on cumule les petits écarts
    gyro.cum += dd; gyro.prev = yaw;
    V.cYaw = gyro.base.yaw + gyro.cum; V.cPitch = gyro.base.pitch + (pit - gyro.refP); borne();
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
    if (gyro.actif) { gyro.ref = null; gyro.cum = undefined; gyro.prev = undefined; dec.yaw = D.vue.yaw; dec.pitch = D.vue.pitch; msg("Vue recentrée sur le chalet"); }
    else activerGyro("bouton");
  });
  if (tactile) document.addEventListener("click", function () { activerGyro(true); });

  /* ---------- Neige du meuble : calque dans le repère du décor ---------- */
  var dirtyT = 0;
  window.VUE = {
    D: D, V: V, proj: proj, inv: inv,
    echelle: function () { return V.f * TAU / D.w; },                      // pixels d'écran par pixel du décor
    rect: V.rect,
    // écran -> pixels du chalet (repère de l'élément), et inversement : pour la neige du toit
    local: function (x, y) {
      var m = V.hom; if (!m) return null;
      var A = m.a - m.g * x, Bq = m.b - m.h * x, C = x - m.c, Dq = m.d - m.g * y, E = m.e - m.h * y, F = y - m.f;
      var det = A * E - Bq * Dq; if (!det) return null;
      return [((C * E - Bq * F) / det) * m.W, ((A * F - C * Dq) / det) * m.H];
    },
    ecranDe: function (px, py) {
      var m = V.hom; if (!m) return null;
      var u = px / m.W, w = py / m.H, den = m.g * u + m.h * w + 1;
      return [(m.a * u + m.b * w + m.c) / den, (m.d * u + m.e * w + m.f) / den];
    },
    largeurLocale: function () { return V.hom ? V.hom.W : 0; },
    tableau: function (canvas) {
      if (!gl || !texBoard) return;
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texBoard);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); gl.generateMipmap(gl.TEXTURE_2D);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1f(loc.uBdOn, 1);
    },
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
  var iml = new Image();
  iml.onload = function () { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texLm); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, iml); gl.uniform1f(loc.uLmOn, 1); gl.activeTexture(gl.TEXTURE0); };
  iml.src = "img/lumieres.png";
  img.src = D.img;
  requestAnimationFrame(image);
})();
