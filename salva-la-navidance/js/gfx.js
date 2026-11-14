// =====================================================================
//  GRÁFICOS: pantalla nítida (pixel perfecto), fuente pixel, sprites, paneles 8-bit
// =====================================================================
(function () {
  const C = NV.CFG;
  const X = { W: 640, H: C.H, img: {}, white: {}, loaded: 0, total: 0 };
  // Rendimiento: se dibuja directo en el canvas visible a resolución interna (640x360 aprox.)
  // y el navegador lo agranda por CSS con image-rendering: pixelated (lo hace la GPU, gratis).
  // Antes se copiaba cada cuadro a un canvas del tamaño de la pantalla (hasta 3x en celulares).
  const disp = document.getElementById('game');
  const ctx = disp.getContext('2d', { alpha: false });
  X.ctx = ctx; X.disp = disp;

  // ---------------- escalado ----------------
  X.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight;
    if (!ww || !wh) return; // ventana sin tamaño (pestaña oculta, rotando): esperar al próximo resize
    let W = Math.round((C.H * ww) / wh / 2) * 2;
    W = NV.U.clamp(W, C.MIN_W, C.MAX_W);
    X.W = W; disp.width = W; disp.height = C.H;
    const s = Math.min(ww / W, wh / C.H);
    disp.style.width = Math.floor(W * s) + 'px'; disp.style.height = Math.floor(C.H * s) + 'px';
    ctx.imageSmoothingEnabled = false; // cambiar el tamaño del canvas reinicia el contexto
  };
  X.present = function () {};
  X.toInternal = function (cx, cy) {
    const r = disp.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * X.W, y: ((cy - r.top) / r.height) * C.H };
  };

  // ---------------- carga de imágenes ----------------
  const LIST = {
    ivan: 'assets/sprites/ivan.png', hades: 'assets/sprites/hades.png', matias: 'assets/sprites/matias.png',
    patovica: 'assets/sprites/patovica.png', regalo: 'assets/sprites/regalo.png', esfera: 'assets/sprites/esfera.png', duende: 'assets/sprites/duende.png',
    robogrinch: 'assets/sprites/robogrinch.png', rocket: 'assets/sprites/rocket.png', plasma: 'assets/sprites/plasma.png', bag: 'assets/sprites/bag.png', coin: 'assets/sprites/coin.png', mega: 'assets/sprites/mega.png', shield: 'assets/sprites/shield.png',
    heart: 'assets/sprites/heart.png', beacon: 'assets/sprites/beacon.png', elaser: 'assets/sprites/elaser.png', ornament: 'assets/sprites/ornament.png',
    wave: 'assets/sprites/wave.png', boom: 'assets/sprites/boom.png', movinghead: 'assets/sprites/movinghead.png',
    shot_ivan: 'assets/sprites/shot_ivan.png', shot_hades: 'assets/sprites/shot_hades.png', shot_matias: 'assets/sprites/shot_matias.png',
    sky: 'assets/bg/sky.png', far: 'assets/bg/far.png', mid: 'assets/bg/mid.png', near: 'assets/bg/near.png', tiles: 'assets/bg/tiles.png',
    deco_console: 'assets/bg/deco_console.png', deco_speaker: 'assets/bg/deco_speaker.png', deco_tree: 'assets/bg/deco_tree.png',
    deco_snow: 'assets/bg/deco_snow.png', deco_truss: 'assets/bg/deco_truss.png', deco_lamp: 'assets/bg/deco_lamp.png', deco_door: 'assets/bg/deco_door.png',
    logo: 'assets/img/logo.png', brutal_logo: 'assets/img/brutal_logo.png', coinBig: 'assets/img/coin.png',
    ivan_face: 'assets/img/ivan_face.jpg', hades_face: 'assets/img/hades_face.jpg', matias_face: 'assets/img/matias_face.jpg',
    ivan_portrait: 'assets/img/ivan_portrait.jpg', hades_portrait: 'assets/img/hades_portrait.jpg', matias_portrait: 'assets/img/matias_portrait.jpg',
    robogrinch_card: 'assets/img/robogrinch_card.png',
  };
  const WHITE = ['ivan', 'hades', 'matias', 'patovica', 'regalo', 'esfera', 'duende', 'robogrinch', 'heart', 'coin'];
  X.load = function (done) {
    const keys = Object.keys(LIST); X.total = keys.length;
    keys.forEach((k) => {
      const im = new Image();
      im.onload = () => { im.ok = true; if (++X.loaded === X.total) { WHITE.forEach(mkWhite); done(); } };
      im.onerror = () => { im.ok = false; if (++X.loaded === X.total) { WHITE.forEach(mkWhite); done(); } };
      im.src = LIST[k] + '?v=' + NV.VERSION; X.img[k] = im; // ?v= evita que el navegador muestre arte viejo después de actualizar
    });
  };
  function mkWhite(k) {
    const s = X.img[k]; const c = document.createElement('canvas'); c.width = s.width || 1; c.height = s.height || 1;
    if (!s.ok) { X.white[k] = c; return; }
    const x = c.getContext('2d'); x.drawImage(s, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    X.white[k] = c;
  }

  // ---------------- sprites ----------------
  // Dibuja un cuadro con el ancla abajo al centro (cx, by)
  X.spr = function (name, frame, cx, by, o = {}) {
    const AS = window.ART_DATA.sprites;
    const m = (window.SPRITE_EXTRA && window.SPRITE_EXTRA[name]) || AS[name] || (name.indexOf('shot_') === 0 ? AS.shot : null); if (!m) return;
    const f = ((frame % m.n) + m.n) % m.n;
    const img = o.flash ? X.white[name] : X.img[name];
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(cx), Math.round(by));
    const sc = o.scale || 1;
    if (o.flip) ctx.scale(-sc, sc); else if (sc !== 1) ctx.scale(sc, sc);
    ctx.drawImage(img, f * m.w, 0, m.w, m.h, -Math.floor(m.w / 2), -m.h, m.w, m.h);
    ctx.restore();
  };
  // Héroes (hojas recortadas de las animaciones originales)
  // sq: squash & stretch vertical (1 = normal); el ancho compensa para conservar el volumen
  // mix (0..1): mezcla el cuadro siguiente encima (cuadro intermedio "fantasma": la animación se ve fluida)
  X.hero = function (hero, anim, frame, x, y, flip, flash, alpha, sq = 1, mix = 0, loop = true) {
    const D = window.SPRITE_DATA; const a = D.anims[hero][anim] || D.anims[hero].idle;
    const f = ((Math.floor(frame) % a.n) + a.n) % a.n;
    const img = flash ? X.white[hero] : X.img[hero];
    ctx.save();
    const ga = alpha !== undefined ? alpha : 1; ctx.globalAlpha = ga;
    ctx.translate(Math.round(x), Math.round(y));
    if (Math.abs(sq - 1) > 0.02) ctx.scale(1 / Math.sqrt(sq), sq);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, f * D.cw, a.row * D.ch, D.cw, D.ch, -D.ax, -D.ay, D.cw, D.ch);
    if (mix > 0.05 && a.n > 1) {
      const f2 = loop ? (f + 1) % a.n : Math.min(a.n - 1, f + 1);
      if (f2 !== f) { ctx.globalAlpha = ga * mix; ctx.drawImage(img, f2 * D.cw, a.row * D.ch, D.cw, D.ch, -D.ax, -D.ay, D.cw, D.ch); }
    }
    ctx.restore();
  };
  // ROBO-GRINCH: hoja en grilla. o.next + o.mix mezclan dos cuadros (transición suave entre poses)
  X.boss = function (frame, cx, by, o = {}) {
    const B = window.BOSS_DATA, img = o.flash ? X.white.robogrinch : X.img.robogrinch;
    const cell = (f) => [(f % B.cols) * B.w, Math.floor(f / B.cols) * B.h];
    ctx.save();
    const ga = o.alpha !== undefined ? o.alpha : 1; ctx.globalAlpha = ga;
    ctx.translate(Math.round(cx), Math.round(by));
    const sc = o.scale || 1; ctx.scale(sc * (o.sx || 1), sc * (o.sy || 1));
    if (o.filter) ctx.filter = o.filter;
    let [sx, sy] = cell(frame);
    ctx.drawImage(img, sx, sy, B.w, B.h, -B.w / 2, -B.h, B.w, B.h);
    if (o.next !== undefined && o.next !== frame && o.mix > 0.04) {
      [sx, sy] = cell(o.next); ctx.globalAlpha = ga * o.mix;
      ctx.drawImage(img, sx, sy, B.w, B.h, -B.w / 2, -B.h, B.w, B.h);
    }
    ctx.restore();
  };
  X.heroFrames = (hero, anim) => (window.SPRITE_DATA.anims[hero][anim] || { n: 1 }).n;
  X.hasAnim = (hero, anim) => !!window.SPRITE_DATA.anims[hero][anim];

  // ---------------- FUENTE AKIRA 8-BIT ----------------
  // Dos juegos de letras: 's' (Akira8 chica, 6x7) para textos chicos y medianos, y 'w' (Akira ancha)
  // para los títulos (escala 3 o más). Si un texto no entra en su ancho, se achica solo.
  const TOP = 3, GH = 12; // filas por encima (acentos) y alto total
  const mix = (hex, to, t) => { const a = NV.U.hex2rgb(hex.length === 7 ? hex : '#ffffff'), b = NV.U.hex2rgb(to); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; };
  function mkSet(F, space) {
    const S = { G: {}, w: 0, space, atl: {}, comp: {}, dw: 0 };
    Object.keys(F).forEach((ch) => {
      const [w, p] = F[ch];
      S.G[ch] = { w, x: S.w, px: p ? p.split(';').map((q) => q.split(',').map(Number)) : [] };
      S.w += w + 1;
    });
    for (const d of '0123456789') if (S.G[d]) S.dw = Math.max(S.dw, S.G[d].w);
    return S;
  }
  const FS = window.FONT_DATA, FW = Object.assign({}, FS, window.FONT_WIDE || {});
  const SETS = { s: mkSet(FS, 4), w: mkSet(FW, 6) };
  // atlas de un color; grad = degradé arcade (arriba claro, abajo oscuro) para los textos grandes
  function atlas(S, color, grad) {
    const key = color + (grad ? '|g' : '');
    if (S.atl[key]) return S.atl[key];
    const c = document.createElement('canvas'); c.width = S.w; c.height = GH;
    const x = c.getContext('2d');
    const rowCol = (r) => !grad ? color : r <= 1 ? mix(color, '#ffffff', 0.55) : r <= 3 ? mix(color, '#ffffff', 0.2) : r >= 6 ? mix(color, '#000000', 0.32) : color;
    for (const ch in S.G) { const g = S.G[ch]; for (const [px, py] of g.px) { x.fillStyle = rowCol(py); x.fillRect(g.x + px, py + TOP, 1, 1); } }
    S.atl[key] = c; return c;
  }
  // Rendimiento: cada letra arcade (sombra + contorno + degradé) se compone UNA vez; después es 1 drawImage.
  const PAD = 1, SH = 2; // borde del contorno y caída de la sombra (en píxeles de la letra)
  function compAtlas(S, color, oc, fancy) {
    const key = color + '|' + oc + (fancy ? '|f' : '|o');
    if (S.comp[key]) return S.comp[key];
    const base = atlas(S, color, fancy), ink = atlas(S, oc), shadow = fancy ? atlas(S, '#05040a') : null;
    const cells = {}; let cx = 0;
    for (const ch in S.G) { const w = S.G[ch].w + 1 + PAD * 2; cells[ch] = { x: cx, w }; cx += w + 1; }
    const c = document.createElement('canvas'); c.width = cx; c.height = GH + PAD * 2 + (fancy ? SH : 0);
    const x = c.getContext('2d');
    const stamp = (src, g, dx, dy) => x.drawImage(src, g.x, 0, g.w, GH, dx, dy, g.w, GH);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
    for (const ch in S.G) {
      const g = S.G[ch], o = cells[ch].x + PAD;
      if (fancy) { stamp(shadow, g, o, PAD + SH); stamp(shadow, g, o + 1, PAD + SH); }
      for (const [dx, dy] of dirs) stamp(ink, g, o + dx, PAD + dy);
      stamp(base, g, o, PAD);
    }
    return (S.comp[key] = { c, cells });
  }
  const isDigit = (ch) => ch >= '0' && ch <= '9';
  function adv(S, ch) { if (ch === ' ') return S.space; const g = S.G[ch]; if (!g) return 6; return (isDigit(ch) ? S.dw : g.w) + 1; }
  function width(S, str, sc) { let w = 0; for (const ch of str) w += adv(S, ch); return Math.max(0, w - 1) * sc; }
  // elige juego de letras y escala para que el texto entre en maxW
  X.fit = function (str, sc = 1, o = {}) {
    str = String(str);
    let set = (sc >= 2.5 || o.wide) && !o.narrow ? 'w' : 's';
    const maxW = o.maxW || 0;
    if (maxW) {
      if (set === 'w' && width(SETS.w, str, sc) > maxW) set = 's';
      while (sc > 1 && width(SETS[set], str, sc) > maxW) sc--;
    }
    return { sc, set, w: width(SETS[set], str, sc) };
  };
  // fancy (por defecto en textos de escala 2 o más): degradé + contorno + sombra dura
  X.measure = (str, sc = 1, o = {}) => X.fit(str, sc, typeof o === 'object' ? o : {}).w;
  X.text = function (str, x, y, o = {}) {
    str = String(str);
    const ctx = o.ctx || X.ctx; // o.ctx: dibujar en otro canvas (placa para compartir)
    // ancho disponible: lo que se pida (maxW) o, en la pantalla del juego, lo que queda hasta el borde
    let maxW = o.maxW;
    if (!maxW && !o.ctx) maxW = (o.align === 'center' ? 2 * Math.min(x, X.W - x) : o.align === 'right' ? x : X.W - x) - 4;
    const fit = X.fit(str, o.scale || 1, { maxW: maxW > 20 ? maxW : 0, narrow: o.narrow, wide: o.wide });
    const sc = fit.sc, S = SETS[fit.set], col = o.color || '#ffffff', w = fit.w;
    const fancy = o.fancy !== undefined ? o.fancy : (o.scale || 1) >= 2;
    let sx = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
    sx = Math.round(sx); y = Math.round(y);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const off = (ch, g) => (isDigit(ch) ? Math.floor((S.dw - g.w) / 2) : 0);
    const pass = (color, dx, dy) => {
      const a = atlas(S, color); let cx = sx + dx;
      for (const ch of str) {
        const g = S.G[ch];
        if (g) ctx.drawImage(a, g.x, 0, g.w, GH, cx + off(ch, g) * sc, y + dy - TOP * sc, g.w * sc, GH * sc);
        cx += adv(S, ch) * sc;
      }
    };
    const oc = o.outline && o.outline !== true ? o.outline : '#0b0a12';
    if (fancy || o.outline) {
      const A = compAtlas(S, col, oc, fancy); let cx = sx;
      for (const ch of str) {
        const g = S.G[ch], cell = A.cells[ch];
        if (g) ctx.drawImage(A.c, cell.x, 0, cell.w, A.c.height, cx + off(ch, g) * sc - PAD * sc, y - (TOP + PAD) * sc, cell.w * sc, A.c.height * sc);
        cx += adv(S, ch) * sc;
      }
    } else {
      if (o.shadow !== false) pass(o.shadowColor || '#0b0a12', sc, sc);
      pass(col, 0, 0);
    }
    if (o.alpha !== undefined) ctx.globalAlpha = 1;
    return w;
  };
  // texto con salto de línea automático
  X.wrap = function (str, x, y, maxW, o = {}) {
    const sc = o.scale || 1, lh = (o.lh || 11) * sc;
    const words = String(str).split(' '); let line = '', yy = y;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (X.measure(t, sc) > maxW && line) { X.text(line, x, yy, o); line = wd; yy += lh; } else line = t;
    }
    if (line) X.text(line, x, yy, o);
    return yy + lh;
  };

  // ---------------- PANELES 8-bit ----------------
  X.panel = function (x, y, w, h, o = {}) {
    x = Math.round(x); y = Math.round(y);
    const fill = o.fill || 'rgba(8,8,18,.86)', b1 = o.border || '#3a4466', b2 = o.light || '#8ea2c4';
    ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#0b0a12'; ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + h - 1, w - 2, 1); ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
    ctx.fillStyle = b1; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    if (o.light !== false) { ctx.fillStyle = b2; ctx.fillRect(x + 2, y + 2, w - 4, 1); }
    // Navidad: montoncito de nieve sobre el borde y carámbanos colgando (o.snow: false para sacarlo)
    if (o.snow !== false && w > 24) ctx.drawImage(snowCap(w), x, y - 2);
  };
  // la nieve de cada ancho de panel se dibuja una vez y se reutiliza (antes: 2 rectángulos por píxel, cada cuadro)
  const caps = {};
  function snowCap(w) {
    if (caps[w]) return caps[w];
    const c = document.createElement('canvas'); c.width = w; c.height = 9; const g = c.getContext('2d');
    for (let k = 1; k < w - 1; k++) {
      const hh = 2 + ((k * 7) % 9 === 0 ? 1 : 0) + (k > 3 && k < w - 4 ? 1 : 0);
      g.fillStyle = '#f4f8ff'; g.fillRect(k, 4 - hh, 1, hh - 1); g.fillStyle = '#c8d8f0'; g.fillRect(k, 3, 1, 1);
    }
    g.fillStyle = '#9fc4ee';
    for (let k = 6 + (w % 7); k < w - 4; k += 11 + (k % 5)) g.fillRect(k, 4, 1, 2 + (k % 3));
    return (caps[w] = c);
  }
  // botón 8-bit; devuelve el rectángulo para detectar toques
  X.button = function (label, cx, cy, w, h, o = {}) {
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    const on = o.active;
    X.panel(x, y, w, h, { fill: on ? (o.color || '#b3132b') : 'rgba(10,10,22,.9)', border: on ? '#fff' : (o.color || '#3a4466'), light: on ? '#ffffff' : '#5a6e92' });
    // la letra de los botones va un 12% más chica que la escala pedida (el recuadro queda igual)
    const ft = X.fit(label, (o.scale || 2) * 0.88, { maxW: w - 8 });
    X.text(label, cx, cy - ft.sc * 3.5 + 1, { scale: ft.sc, narrow: ft.set === 's', align: 'center', color: on ? '#fff' : (o.textColor || '#dfe6f5'), fancy: true, maxW: w - 4 });
    return { x, y, w, h };
  };
  X.rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  NV.X = X;
})();
