// =====================================================================
//  GRÁFICOS: pantalla nítida (pixel perfecto), fuente pixel, sprites, paneles 8-bit
// =====================================================================
(function () {
  const C = NV.CFG;
  const X = { W: 640, H: C.H, img: {}, white: {}, loaded: 0, total: 0 };
  const disp = document.getElementById('game');
  const dctx = disp.getContext('2d');
  const buf = document.createElement('canvas');
  const ctx = buf.getContext('2d');
  X.ctx = ctx; X.buf = buf; X.disp = disp;

  // ---------------- escalado ----------------
  X.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight;
    if (!ww || !wh) return; // ventana sin tamaño (pestaña oculta, rotando): esperar al próximo resize
    let W = Math.round((C.H * ww) / wh / 2) * 2;
    W = NV.U.clamp(W, C.MIN_W, C.MAX_W);
    X.W = W; buf.width = W; buf.height = C.H;
    const s = Math.min(ww / W, wh / C.H);
    const cssW = Math.floor(W * s), cssH = Math.floor(C.H * s);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    disp.width = Math.round(cssW * dpr); disp.height = Math.round(cssH * dpr);
    disp.style.width = cssW + 'px'; disp.style.height = cssH + 'px';
    ctx.imageSmoothingEnabled = false;
  };
  X.present = function () {
    if (!disp.width || !disp.height) return; // un drawImage con tamaño 0 tira error y frena el loop
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(buf, 0, 0, disp.width, disp.height);
  };
  X.toInternal = function (cx, cy) {
    const r = disp.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * X.W, y: ((cy - r.top) / r.height) * C.H };
  };

  // ---------------- carga de imágenes ----------------
  const LIST = {
    ivan: 'assets/sprites/ivan.png', hades: 'assets/sprites/hades.png', matias: 'assets/sprites/matias.png',
    snowman: 'assets/sprites/snowman.png', nutcracker: 'assets/sprites/nutcracker.png', skull: 'assets/sprites/skull.png', elf: 'assets/sprites/elf.png',
    grinch: 'assets/sprites/grinch.png', coin: 'assets/sprites/coin.png', mega: 'assets/sprites/mega.png', shield: 'assets/sprites/shield.png',
    heart: 'assets/sprites/heart.png', beacon: 'assets/sprites/beacon.png', elaser: 'assets/sprites/elaser.png', ornament: 'assets/sprites/ornament.png',
    wave: 'assets/sprites/wave.png', boom: 'assets/sprites/boom.png', movinghead: 'assets/sprites/movinghead.png',
    shot_ivan: 'assets/sprites/shot_ivan.png', shot_hades: 'assets/sprites/shot_hades.png', shot_matias: 'assets/sprites/shot_matias.png',
    sky: 'assets/bg/sky.png', far: 'assets/bg/far.png', mid: 'assets/bg/mid.png', near: 'assets/bg/near.png', tiles: 'assets/bg/tiles.png',
    deco_console: 'assets/bg/deco_console.png', deco_speaker: 'assets/bg/deco_speaker.png', deco_tree: 'assets/bg/deco_tree.png',
    deco_snow: 'assets/bg/deco_snow.png', deco_truss: 'assets/bg/deco_truss.png', deco_lamp: 'assets/bg/deco_lamp.png', deco_door: 'assets/bg/deco_door.png',
    logo: 'assets/img/logo.png', coinBig: 'assets/img/coin.png',
    ivan_face: 'assets/img/ivan_face.jpg', hades_face: 'assets/img/hades_face.jpg', matias_face: 'assets/img/matias_face.jpg',
    ivan_portrait: 'assets/img/ivan_portrait.jpg', hades_portrait: 'assets/img/hades_portrait.jpg', matias_portrait: 'assets/img/matias_portrait.jpg',
    grinch_card: 'assets/img/grinch_card.jpg',
  };
  const WHITE = ['ivan', 'hades', 'matias', 'snowman', 'nutcracker', 'skull', 'elf', 'grinch'];
  X.load = function (done) {
    const keys = Object.keys(LIST); X.total = keys.length;
    keys.forEach((k) => {
      const im = new Image();
      im.onload = im.onerror = () => { if (++X.loaded === X.total) { WHITE.forEach(mkWhite); done(); } };
      im.src = LIST[k]; X.img[k] = im;
    });
  };
  function mkWhite(k) {
    const s = X.img[k]; const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
    const x = c.getContext('2d'); x.drawImage(s, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    X.white[k] = c;
  }

  // ---------------- sprites ----------------
  // Dibuja un cuadro con el ancla abajo al centro (cx, by)
  X.spr = function (name, frame, cx, by, o = {}) {
    const m = window.ART_DATA.sprites[name]; if (!m) return;
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
  X.hero = function (hero, anim, frame, x, y, flip, flash, alpha) {
    const D = window.SPRITE_DATA; const a = D.anims[hero][anim] || D.anims[hero].idle;
    const f = ((frame % a.n) + a.n) % a.n;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(flash ? X.white[hero] : X.img[hero], f * D.cw, a.row * D.ch, D.cw, D.ch, -D.ax, -D.ay, D.cw, D.ch);
    ctx.restore();
  };
  X.heroFrames = (hero, anim) => (window.SPRITE_DATA.anims[hero][anim] || { n: 1 }).n;
  X.hasAnim = (hero, anim) => !!window.SPRITE_DATA.anims[hero][anim];

  // ---------------- FUENTE PIXEL ----------------
  const F = window.FONT_DATA; const GLYPH = {}; let atlasW = 0;
  const TOP = 3, GH = 12; // filas por encima (acentos) y alto total
  Object.keys(F).forEach((ch) => {
    const [w, p] = F[ch];
    GLYPH[ch] = { w, x: atlasW, px: p ? p.split(';').map((s) => s.split(',').map(Number)) : [] };
    atlasW += w + 1;
  });
  const atlases = {};
  function atlas(color) {
    if (atlases[color]) return atlases[color];
    const c = document.createElement('canvas'); c.width = atlasW; c.height = GH;
    const x = c.getContext('2d'); x.fillStyle = color;
    for (const ch in GLYPH) { const g = GLYPH[ch]; for (const [px, py] of g.px) x.fillRect(g.x + px, py + TOP, 1, 1); }
    atlases[color] = c; return c;
  }
  const isDigit = (ch) => ch >= '0' && ch <= '9';
  function adv(ch) { if (ch === ' ') return 4; const g = GLYPH[ch]; if (!g) return 6; return isDigit(ch) ? 6 : g.w + 1; }
  X.measure = (str, sc = 1) => { let w = 0; for (const ch of String(str)) w += adv(ch); return Math.max(0, w - 1) * sc; };
  X.text = function (str, x, y, o = {}) {
    str = String(str);
    const sc = o.scale || 1, col = o.color || '#ffffff';
    const w = X.measure(str, sc);
    let sx = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
    sx = Math.round(sx); y = Math.round(y);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const pass = (color, dx, dy) => {
      const a = atlas(color); let cx = sx + dx;
      for (const ch of str) {
        const g = GLYPH[ch];
        if (g) { const off = isDigit(ch) ? Math.floor((5 - g.w) / 2) : 0; ctx.drawImage(a, g.x, 0, g.w, GH, cx + off * sc, y + dy - TOP * sc, g.w * sc, GH * sc); }
        cx += adv(ch) * sc;
      }
    };
    if (o.outline) { const oc = o.outline === true ? '#0b0a12' : o.outline; for (const [dx, dy] of [[-sc, 0], [sc, 0], [0, -sc], [0, sc], [-sc, -sc], [sc, sc], [-sc, sc], [sc, -sc]]) pass(oc, dx, dy); }
    else if (o.shadow !== false) pass(o.shadowColor || '#0b0a12', sc, sc);
    pass(col, 0, 0);
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
  };
  // botón 8-bit; devuelve el rectángulo para detectar toques
  X.button = function (label, cx, cy, w, h, o = {}) {
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    const on = o.active;
    X.panel(x, y, w, h, { fill: on ? (o.color || '#b3132b') : 'rgba(10,10,22,.9)', border: on ? '#fff' : (o.color || '#3a4466'), light: on ? '#ffffff' : '#5a6e92' });
    X.text(label, cx, cy - (o.scale || 2) * 3.5 + 1, { scale: o.scale || 2, align: 'center', color: on ? '#fff' : (o.textColor || '#dfe6f5') });
    return { x, y, w, h };
  };
  X.rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  NV.X = X;
})();
