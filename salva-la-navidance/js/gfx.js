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
    grunon: 'assets/sprites/grunon.png', coin: 'assets/sprites/coin.png', mega: 'assets/sprites/mega.png', shield: 'assets/sprites/shield.png',
    heart: 'assets/sprites/heart.png', beacon: 'assets/sprites/beacon.png', elaser: 'assets/sprites/elaser.png', ornament: 'assets/sprites/ornament.png',
    wave: 'assets/sprites/wave.png', boom: 'assets/sprites/boom.png', movinghead: 'assets/sprites/movinghead.png',
    shot_ivan: 'assets/sprites/shot_ivan.png', shot_hades: 'assets/sprites/shot_hades.png', shot_matias: 'assets/sprites/shot_matias.png',
    sky: 'assets/bg/sky.png', far: 'assets/bg/far.png', mid: 'assets/bg/mid.png', near: 'assets/bg/near.png', tiles: 'assets/bg/tiles.png',
    deco_console: 'assets/bg/deco_console.png', deco_speaker: 'assets/bg/deco_speaker.png', deco_tree: 'assets/bg/deco_tree.png',
    deco_snow: 'assets/bg/deco_snow.png', deco_truss: 'assets/bg/deco_truss.png', deco_lamp: 'assets/bg/deco_lamp.png', deco_door: 'assets/bg/deco_door.png',
    logo: 'assets/img/logo.png', brutal_logo: 'assets/img/brutal_logo.png', coinBig: 'assets/img/coin.png',
    ivan_face: 'assets/img/ivan_face.jpg', hades_face: 'assets/img/hades_face.jpg', matias_face: 'assets/img/matias_face.jpg',
    ivan_portrait: 'assets/img/ivan_portrait.jpg', hades_portrait: 'assets/img/hades_portrait.jpg', matias_portrait: 'assets/img/matias_portrait.jpg',
    grunon_card: 'assets/img/grunon_card.png',
  };
  const WHITE = ['ivan', 'hades', 'matias', 'patovica', 'regalo', 'esfera', 'duende', 'grunon', 'heart', 'coin'];
  X.load = function (done) {
    const keys = Object.keys(LIST); X.total = keys.length;
    keys.forEach((k) => {
      const im = new Image();
      im.onload = im.onerror = () => { if (++X.loaded === X.total) { WHITE.forEach(mkWhite); done(); } };
      im.src = LIST[k] + '?v=' + NV.VERSION; X.img[k] = im; // ?v= evita que el navegador muestre arte viejo después de actualizar
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
  // sq: squash & stretch vertical (1 = normal); el ancho compensa para conservar el volumen
  X.hero = function (hero, anim, frame, x, y, flip, flash, alpha, sq = 1) {
    const D = window.SPRITE_DATA; const a = D.anims[hero][anim] || D.anims[hero].idle;
    const f = ((frame % a.n) + a.n) % a.n;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (Math.abs(sq - 1) > 0.02) ctx.scale(1 / Math.sqrt(sq), sq);
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
  const mix = (hex, to, t) => { const a = NV.U.hex2rgb(hex.length === 7 ? hex : '#ffffff'), b = NV.U.hex2rgb(to); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; };
  // atlas de un color; grad = degradé arcade (arriba claro, abajo oscuro) para los textos grandes
  function atlas(color, grad) {
    const key = color + (grad ? '|g' : '');
    if (atlases[key]) return atlases[key];
    const c = document.createElement('canvas'); c.width = atlasW; c.height = GH;
    const x = c.getContext('2d');
    const rowCol = (r) => !grad ? color : r <= 1 ? mix(color, '#ffffff', 0.55) : r <= 3 ? mix(color, '#ffffff', 0.2) : r >= 6 ? mix(color, '#000000', 0.32) : color;
    for (const ch in GLYPH) { const g = GLYPH[ch]; for (const [px, py] of g.px) { x.fillStyle = rowCol(py); x.fillRect(g.x + px, py + TOP, 1, 1); } }
    atlases[key] = c; return c;
  }
  // Rendimiento: cada letra arcade (sombra + contorno + degradé + trazo grueso) o con contorno
  // se compone UNA vez en este atlas; después dibujar una letra es 1 drawImage en vez de 9-12.
  const PAD = 1, SH = 2; // borde del contorno y caída de la sombra (en píxeles de la letra)
  const comp = {};
  function compAtlas(color, oc, fancy) {
    const key = color + '|' + oc + (fancy ? '|f' : '|o');
    if (comp[key]) return comp[key];
    const base = atlas(color, fancy), ink = atlas(oc), shadow = fancy ? atlas('#05040a') : null;
    const cells = {}; let cx = 0;
    for (const ch in GLYPH) { const w = GLYPH[ch].w + (fancy ? 1 : 0) + PAD * 2; cells[ch] = { x: cx, w }; cx += w + 1; }
    const c = document.createElement('canvas'); c.width = cx; c.height = GH + PAD * 2 + (fancy ? SH : 0);
    const x = c.getContext('2d');
    const stamp = (src, g, dx, dy, bold) => { x.drawImage(src, g.x, 0, g.w, GH, dx, dy, g.w, GH); if (bold) x.drawImage(src, g.x, 0, g.w, GH, dx + 1, dy, g.w, GH); };
    const dirs = fancy ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
    for (const ch in GLYPH) {
      const g = GLYPH[ch], o = cells[ch].x + PAD;
      if (fancy) stamp(shadow, g, o, PAD + SH, true);
      for (const [dx, dy] of dirs) stamp(ink, g, o + dx, PAD + dy, fancy);
      stamp(base, g, o, PAD, fancy);
    }
    return (comp[key] = { c, cells });
  }
  const isDigit = (ch) => ch >= '0' && ch <= '9';
  function adv(ch, bold) { if (ch === ' ') return 4; const g = GLYPH[ch]; if (!g) return 6; return (isDigit(ch) ? 6 : g.w + 1) + (bold ? 1 : 0); }
  // fancy (por defecto en textos de escala 2 o más): trazo grueso + degradé + contorno + sombra dura
  X.measure = (str, sc = 1, fancy = sc >= 2) => { let w = 0; for (const ch of String(str)) w += adv(ch, fancy); return Math.max(0, w - 1) * sc; };
  X.text = function (str, x, y, o = {}) {
    str = String(str);
    const sc = o.scale || 1, col = o.color || '#ffffff';
    const fancy = o.fancy !== undefined ? o.fancy : sc >= 2;
    const w = X.measure(str, sc, fancy);
    let sx = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
    sx = Math.round(sx); y = Math.round(y);
    const ctx = o.ctx || X.ctx; // o.ctx: dibujar en otro canvas (placa para compartir)
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const pass = (color, dx, dy, grad) => {
      const a = atlas(color, grad); let cx = sx + dx;
      for (const ch of str) {
        const g = GLYPH[ch];
        if (g) {
          const off = isDigit(ch) ? Math.floor((5 - g.w) / 2) : 0, gx = cx + off * sc;
          ctx.drawImage(a, g.x, 0, g.w, GH, gx, y + dy - TOP * sc, g.w * sc, GH * sc);
          if (fancy) ctx.drawImage(a, g.x, 0, g.w, GH, gx + sc, y + dy - TOP * sc, g.w * sc, GH * sc);
        }
        cx += adv(ch, fancy) * sc;
      }
    };
    const oc = o.outline && o.outline !== true ? o.outline : '#0b0a12';
    if (fancy || o.outline) {
      const A = compAtlas(col, oc, fancy); let cx = sx;
      for (const ch of str) {
        const g = GLYPH[ch], cell = A.cells[ch];
        if (g) { const off = isDigit(ch) ? Math.floor((5 - g.w) / 2) : 0; ctx.drawImage(A.c, cell.x, 0, cell.w, A.c.height, cx + off * sc - PAD * sc, y - (TOP + PAD) * sc, cell.w * sc, A.c.height * sc); }
        cx += adv(ch, fancy) * sc;
      }
    } else {
      if (o.outline) { for (const [dx, dy] of [[-sc, 0], [sc, 0], [0, -sc], [0, sc], [-sc, -sc], [sc, sc], [-sc, sc], [sc, -sc]]) pass(oc, dx, dy); }
      else if (o.shadow !== false) pass(o.shadowColor || '#0b0a12', sc, sc);
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
    X.text(label, cx, cy - (o.scale || 2) * 3.5 + 1, { scale: o.scale || 2, align: 'center', color: on ? '#fff' : (o.textColor || '#dfe6f5') });
    return { x, y, w, h };
  };
  X.rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  NV.X = X;
})();
