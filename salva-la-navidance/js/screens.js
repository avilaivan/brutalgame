// =====================================================================
//  PANTALLAS 8-bit: título, registro, elegir DJ, resultados, ranking, pausa
// =====================================================================
(function () {
  const IN = NV.Input, U = NV.U;
  const S = {};

  // Menú genérico: botones navegables con teclado/joystick y tocables
  function menu(G, items, opts = {}) {
    const X = NV.X; G.mi = U.clamp(G.mi || 0, 0, items.length - 1);
    const horiz = opts.horiz;
    if (opts.nav !== false && IN.edge(horiz ? 'left' : 'up')) { G.mi = (G.mi + items.length - 1) % items.length; NV.Audio.sfx('move'); }
    if (opts.nav !== false && IN.edge(horiz ? 'right' : 'down')) { G.mi = (G.mi + 1) % items.length; NV.Audio.sfx('move'); }
    const rects = items.map((it, i) => X.button(it.label, it.x, it.y, it.w || 200, it.h || 28, { active: G.mi === i, color: it.color, scale: it.scale }));
    const tap = G.tapThisFrame;
    for (let i = 0; i < items.length; i++) if (IN.inRect(tap, rects[i])) { G.mi = i; G.tapThisFrame = null; NV.Audio.sfx('select'); items[i].act(); return; }
    if (IN.edge('confirm') || IN.edge('jump')) { NV.Audio.sfx('select'); items[G.mi].act(); }
  }
  function bg(ctx, G, dim = 0.45) {
    G.menuCam = (G.menuCam || 0) + 0.5;
    NV.Stage.drawBack(ctx, G, G.menuCam);
    NV.Stage.drawLights(ctx, G, G.menuCam);
    NV.Stage.drawTruss(ctx, G, G.menuCam);
    NV.Stage.drawSnow(ctx, G.menuCam);
    ctx.fillStyle = 'rgba(5,4,12,' + dim + ')'; ctx.fillRect(0, 0, NV.X.W, 360);
    NV.Stage.drawCrowd(ctx, G, G.menuCam);
  }
  S.bg = bg;

  // ---------------- PUERTA: "TOCÁ PARA EMPEZAR" ----------------
  // Los navegadores no dejan sonar nada hasta el primer toque: esta pantalla lo pide
  // (y en celular pasa a pantalla completa horizontal) antes del splash con sonido.
  S.gate = {
    enter(G) { G.gt = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W; G.gt++;
      X.rect(0, 0, W, 360, '#000');
      const go = G.gt > 10 && (IN.edges.size > 0 || G.tapThisFrame);
      if (G.gt % 60 < 40) X.text(IN.isTouch ? 'TOCÁ PARA EMPEZAR' : 'PRESIONÁ CUALQUIER TECLA', W / 2, 168, { scale: 2, align: 'center', color: '#dfe6f5', shadow: false });
      X.text('MEJOR CON SONIDO', W / 2, 196, { align: 'center', color: '#3a4466', shadow: false });
      if (go) {
        NV.Audio.unlock();
        if (IN.isTouch && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
        G.go('intro');
      }
    },
  };

  // ---------------- SPLASH DEL ESTUDIO: "BRUTAL. PRESENTA" ----------------
  // El logo se arma de bloques al azar con un golpe de bajo, brilla y se funde a negro.
  const BLK = 4; // tamaño de los bloques del armado (en píxeles del logo)
  const blockHash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  S.intro = {
    enter(G) { G.it = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W, t = ++G.it, img = X.img.brutal_logo;
      X.rect(0, 0, W, 360, '#000');
      if (t === 18) NV.Audio.sfx('logo');
      const sc = 2, lw = img.width * sc, lh = img.height * sc, lx = Math.round(W / 2 - lw / 2), ly = 150;
      const build = U.clamp((t - 18) / 34, 0, 1);         // armado por bloques
      const out = U.clamp((t - 150) / 24, 0, 1);         // fundido final
      if (build > 0) {
        ctx.save(); ctx.globalAlpha = 1 - out;
        // separación de color (rojo/cian) mientras se arma
        const split = Math.round((1 - build) * 6);
        for (let by = 0; by < img.height; by += BLK) for (let bx = 0; bx < img.width; bx += BLK) {
          if (blockHash(bx, by) > build) continue;
          const jx = build < 1 ? Math.round((blockHash(by, bx) - 0.5) * (1 - build) * 40) : 0;
          ctx.drawImage(img, bx, by, BLK, BLK, lx + bx * sc + jx, ly + by * sc, BLK * sc, BLK * sc);
        }
        if (split) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(img, lx - split, ly, lw, lh); ctx.drawImage(img, lx + split, ly, lw, lh); }
        ctx.restore();
        // destello cuando se completa + barrido de brillo
        if (t >= 52 && t < 60 && NV.OPT.fx) { ctx.globalAlpha = (60 - t) / 8 * 0.6; X.rect(0, 0, W, 360, '#ffffff'); ctx.globalAlpha = 1; }
        const sw = (t - 70) * 9;
        if (sw > 0 && sw < lw + 60) { ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, lw, lh); ctx.clip(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (1 - out); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(lx + sw - 30, ly); ctx.lineTo(lx + sw, ly); ctx.lineTo(lx + sw - 20, ly + lh); ctx.lineTo(lx + sw - 50, ly + lh); ctx.fill(); ctx.restore(); }
      }
      // línea roja de la marca que se abre desde el centro
      const bar = U.clamp((t - 58) / 16, 0, 1) * (lw / 2);
      if (bar > 0) { ctx.globalAlpha = 1 - out; X.rect(W / 2 - bar, ly + lh + 6, bar * 2, 2, '#ff2e4a'); ctx.globalAlpha = 1; }
      if (t > 74) X.text('P R E S E N T A', W / 2, ly + lh + 18, { align: 'center', color: '#8ea2c4', shadow: false, alpha: U.clamp((t - 74) / 20, 0, 1) * (1 - out) });
      if (t > 176 || (t > 30 && (IN.edges.size > 0 || G.tapThisFrame))) { G.tapThisFrame = null; G.go('title'); }
    },
  };

  // ---------------- TÍTULO ----------------
  S.title = {
    enter(G) {
      G.mi = 0; if (!G.menuMusic) { G.menuMusic = true; NV.Audio.preview(U.pick(NV.HERO_ORDER)); }
      G.partyTop = null; NV.DB.top(1).then((r) => { G.partyTop = r && r[0]; }); // récord a vencer
    },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.35);
      const logo = X.img.logo, lw = 270, lh = (lw * logo.height) / logo.width;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(logo, Math.round(W / 2 - lw / 2), 6 + Math.round(Math.sin(G.frame * 0.04) * 2) + (G.phase < 0.1 ? -1 : 0), lw, lh); ctx.restore();
      ctx.drawImage(X.img.brutal_logo, 10, 10, 94, 16); // la marca, siempre a la vista
      X.text('9 DE JULIO · BS. AS.', 10, 30, { color: '#5d6a8a' });
      // el premio: lo que mueve a jugar otra vez
      const pr = '★ EL TOP 3 SE LLEVA PREMIO ★';
      X.text(pr, W / 2, 186, { align: 'center', color: (G.frame >> 3) % 2 ? '#f5c542' : '#ffffff', outline: true });
      const top = G.partyTop;
      if (top) X.text('A VENCER: ' + String(top.name).toUpperCase() + '  ' + U.fmtTime(top.timeMs / 1000), W / 2, 202, { scale: 2, align: 'center', color: '#ff2e4a', outline: true });
      else X.text('COMPETÍ POR EL MEJOR TIEMPO', W / 2, 202, { scale: 2, align: 'center', color: '#ff2e4a', outline: true });
      const prof = NV.DB.profile();
      menu(G, [
        { label: '▶ JUGAR', x: W / 2, y: 244, w: 220, h: 34, scale: 3, color: '#b3132b', act: () => G.go(prof ? 'select' : 'register') },
        { label: 'RANKING', x: W / 2 - 116, y: 288, w: 108, h: 26, color: '#2559d6', act: () => G.go('ranking') },
        { label: prof ? 'CAMBIAR' : 'REGISTRO', x: W / 2, y: 288, w: 108, h: 26, color: '#1c9e4f', act: () => G.go('register') },
        { label: 'OPCIONES', x: W / 2 + 116, y: 288, w: 108, h: 26, color: '#7a5cff', act: () => { G.optBack = 'title'; G.go('options'); } },
      ]);
      if (prof) X.text('JUGANDO COMO ' + prof.name.toUpperCase() + '  @' + prof.ig, W / 2, 312, { align: 'center', color: '#cfd8e6' });
      X.text(NV.Input.isTouch ? 'TOCÁ PARA ELEGIR' : 'FLECHAS + ENTER  ·  M: SONIDO', W / 2, 344, { align: 'center', color: '#5d6a8a' });
    },
  };

  // ---------------- REGISTRO (formulario HTML con estilo 8-bit) ----------------
  S.register = {
    enter(G) {
      const box = document.getElementById('reg'); box.classList.remove('hidden');
      const p = NV.DB.profile();
      document.getElementById('regName').value = p ? p.name : '';
      document.getElementById('regIg').value = p ? p.ig : '';
      document.getElementById('regOk').checked = !!p;
      document.getElementById('regErr').textContent = '';
    },
    leave() { document.getElementById('reg').classList.add('hidden'); document.activeElement && document.activeElement.blur && document.activeElement.blur(); },
    draw(ctx, G) { bg(ctx, G, 0.6); },
  };

  // ---------------- ELEGIR DJ ----------------
  S.select = {
    enter(G) { G.sel = G.sel === undefined ? 0 : G.sel; G.mi = 0; G.selT = 0; NV.Audio.preview(NV.HERO_ORDER[G.sel]); },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.55);
      X.text('ELEGÍ TU DJ', W / 2, 12, { scale: 3, align: 'center', outline: true });
      X.text('LOS 3 CORREN Y DISPARAN IGUAL · CADA UNO TIENE SU CANCIÓN', W / 2, 40, { align: 'center', color: '#8ea2c4' });
      const cw = Math.min(176, (W - 40) / 3), gap = 10, x0 = W / 2 - (cw * 3 + gap * 2) / 2;
      const rects = [];
      G.selT++;
      NV.HERO_ORDER.forEach((k, i) => {
        const h = NV.HEROES[k], x = x0 + i * (cw + gap), y = 56, sel = G.sel === i, ch = 214;
        rects.push({ x, y, w: cw, h: ch });
        X.panel(x, y, cw, ch, { fill: sel ? h.dark : 'rgba(10,10,22,.9)', border: sel ? h.color : '#2a3350', light: sel ? h.light : '#3a4466' });
        ctx.save(); ctx.globalAlpha = sel ? 1 : 0.4; ctx.drawImage(X.img[k + '_portrait'], Math.round(x + 6), y + 6, cw - 12, 96); ctx.restore();
        X.rect(x + 6, y + 102, cw - 12, 2, h.color);
        X.hero(k, sel ? (G.selT % 120 < 30 ? 'shoot' : 'idle') : 'idle', sel ? Math.floor(G.selT / 10) : 0, x + cw / 2, y + 160, false);
        // mismo tamaño para los 3: nombre corto grande, nombre completo chico
        X.text(h.short, x + cw / 2, y + 166, { align: 'center', scale: 2, color: sel ? '#fff' : '#8ea2c4' });
        X.text(h.name, x + cw / 2, y + 184, { align: 'center', color: sel ? h.light : '#5d6a8a' });
        X.text('♪ ' + window.MUSIC_DATA[k].title + ' · ' + window.MUSIC_DATA[k].bpm.toFixed(0) + ' BPM', x + cw / 2, y + 197, { align: 'center', color: sel ? h.light : '#5d6a8a' });
        if (sel) { const bl = Math.round(G.bass * 10); for (let b = 0; b < 10; b++) X.rect(x + cw / 2 - 25 + b * 5, y + 158 - (b < bl ? 4 : 1), 4, b < bl ? 4 : 1, h.color); }
      });
      const pick = (i) => { if (i !== G.sel) { G.sel = i; NV.Audio.sfx('move'); NV.Audio.preview(NV.HERO_ORDER[i]); return false; } return true; };
      if (IN.edge('left')) pick((G.sel + 2) % 3);
      if (IN.edge('right')) pick((G.sel + 1) % 3);
      const t = G.tapThisFrame;
      for (let i = 0; i < 3; i++) if (IN.inRect(t, rects[i])) { G.tapThisFrame = null; if (pick(i)) { NV.Audio.sfx('select'); G.startRun(NV.HERO_ORDER[i]); return; } }
      const h = NV.HEROES[NV.HERO_ORDER[G.sel]];
      menu(G, [
        { label: '¡A JUGAR!', x: W / 2 + 60, y: 300, w: 180, h: 32, scale: 2, color: { ivan: '#b3132b', hades: '#2559d6', matias: '#1c9e4f' }[NV.HERO_ORDER[G.sel]], act: () => G.startRun(NV.HERO_ORDER[G.sel]) },
        { label: 'VOLVER', x: W / 2 - 100, y: 300, w: 110, h: 26, act: () => G.go('title') },
      ], { horiz: true, nav: false });
      X.text(NV.Input.isTouch ? 'TOCÁ UN DJ PARA ESCUCHAR SU CANCIÓN' : '◀ ▶ ELEGIR  ·  ENTER JUGAR', W / 2, 330, { align: 'center', color: '#5d6a8a' });
    },
  };

  // ---------------- RESULTADOS ----------------
  S.results = {
    enter(G) { G.mi = 0; G.rt = 0; G.confetti = []; G.top3 = null; NV.DB.top(3).then((r) => { G.top3 = r; }); },
    draw(ctx, G) {
      const X = NV.X, W = X.W, R = G.result, h = NV.HEROES[R.hero], rk = G.submit;
      const t = ++G.rt;
      bg(ctx, G, 0.6);
      X.text('¡NAVIDANCE SALVADA!', W / 2, 10, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      X.panel(W / 2 - 220, 40, 440, rk && rk.local ? 206 : 186, { border: h.color, light: h.light });
      // retrato
      ctx.drawImage(X.img[R.hero + '_portrait'], W / 2 - 208, 52, 104, 104);
      X.rect(W / 2 - 208, 156, 104, 2, h.color);
      X.text(h.name, W / 2 - 156, 164, { align: 'center', color: h.light });
      // tiempo (cuenta rápida hasta el valor final)
      const shown = R.time * Math.min(1, t / 30);
      X.text('TU TIEMPO', W / 2 + 22, 52, { align: 'center', color: '#8ea2c4' });
      X.text(U.fmtTime(shown), W / 2 + 22, 66, { scale: 4, align: 'center', color: t < 30 ? '#f5c542' : '#ffffff', outline: true });
      if (R.pb) X.text('¡NUEVO RÉCORD PERSONAL!', W / 2 + 22, 104, { align: 'center', color: (G.frame >> 3) % 2 ? '#f5c542' : '#ff2e4a', outline: true });
      else if (R.prevBest) X.text('TU RÉCORD: ' + U.fmtTime(R.prevBest), W / 2 + 22, 104, { align: 'center', color: '#8ea2c4' });
      let rkTxt = 'GUARDANDO...', rkCol = '#8ea2c4';
      if (rk && rk.error) { rkTxt = 'NO ENTRÓ AL RANKING'; rkCol = '#ff2e4a'; }
      else if (rk && rk.rank) { rkTxt = 'PUESTO #' + rk.rank + (rk.total ? ' DE ' + rk.total : ''); rkCol = rk.rank <= 3 ? '#f5c542' : '#ffffff'; }
      X.text(rkTxt, W / 2 + 22, 120, { scale: 2, align: 'center', color: rkCol, outline: true });
      if (rk && rk.error) X.text(rk.error.toUpperCase(), W / 2 + 22, 140, { align: 'center', color: '#8ea2c4' });
      else if (rk && rk.rank && rk.rank <= 3) X.text('¡ESTÁS EN EL TOP 3! TE VAMOS A ESCRIBIR', W / 2 + 22, 140, { align: 'center', color: '#f5c542' });
      else if (rk && rk.rank && G.top3 && G.top3[2]) {
        // lo que falta para el premio: el empujón para jugar otra vez
        const gap = R.time - G.top3[2].timeMs / 1000;
        if (gap > 0) X.text('TE FALTAN ' + gap.toFixed(2) + ' S PARA EL TOP 3', W / 2 + 22, 140, { align: 'center', color: (G.frame >> 4) % 2 ? '#ff4fd8' : '#ffffff' });
      }
      // medalla: cae como un sello
      const M = R.medal, mx = W / 2 + 168, my = 92;
      if (t === 34) NV.Audio.sfx('medal');
      if (t >= 34) {
        const s = Math.max(1, 3 - (t - 34) * 0.4);
        X.text('RANGO', mx, 50, { align: 'center', color: '#8ea2c4' });
        ctx.save(); ctx.translate(mx, my); ctx.scale(s, s);
        X.panel(-22, -22, 44, 44, { fill: 'rgba(8,8,18,.95)', border: M[2], light: '#ffffff' });
        X.text(M[0], 0, -14, { scale: 4, align: 'center', color: M[2], outline: true });
        ctx.restore();
        const next = NV.CFG.MEDALS[NV.CFG.MEDALS.indexOf(M) - 1];
        X.text(next ? next[0] + ' EN < ' + U.fmtTime(next[1]) : 'MÁXIMO', mx, 122, { align: 'center', color: next ? next[2] : M[2] });
      }
      // estadísticas
      X.rect(W / 2 - 96, 176, 304, 1, '#2a3350');
      const stat = (label, val, x, col) => { X.text(label, x, 186, { align: 'center', color: '#5d6a8a' }); X.text(String(val), x, 198, { scale: 2, align: 'center', color: col }); };
      stat('B-COINS', R.coins, W / 2 - 44, '#f5c542'); stat('CAÍDAS', R.deaths, W / 2 + 56, '#cfd8e6'); stat('PUNTOS', R.score, W / 2 + 156, '#cfd8e6');
      if (rk && rk.local) X.text('RANKING GUARDADO SOLO EN ESTE DISPOSITIVO', W / 2, 228, { align: 'center', color: '#5d6a8a' });
      // confeti en récord personal o top 3
      if ((R.pb || (rk && rk.rank <= 3)) && G.confetti.length < 120 && t % 2 === 0) for (let i = 0; i < 3; i++) G.confetti.push({ x: U.rand(0, W), y: -6, vx: U.rand(-0.6, 0.6), vy: U.rand(0.8, 2), c: U.pick(['#f5c542', '#ff2e4a', '#4de2ff', '#33e07a', '#ff4fd8', '#ffffff']), r: U.rand(0, 6) });
      for (const c of G.confetti) { c.x += c.vx + Math.sin((t + c.r * 10) * 0.08) * 0.4; c.y += c.vy; X.rect(c.x, c.y, (t + c.r) % 8 < 4 ? 3 : 1, 3, c.c); }
      G.confetti = G.confetti.filter((c) => c.y < 364);
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 198, y: 286, w: 124, h: 32, color: '#b3132b', act: () => G.startRun(R.hero) },
        { label: 'COMPARTIR', x: W / 2 - 66, y: 286, w: 124, h: 32, color: '#c2187a', act: () => shareCard(G).catch(() => {}) },
        { label: 'RANKING', x: W / 2 + 66, y: 286, w: 124, h: 32, color: '#2559d6', act: () => G.go('ranking') },
        { label: 'CAMBIAR DJ', x: W / 2 + 198, y: 286, w: 124, h: 32, color: '#1c9e4f', act: () => G.go('select') },
      ], { horiz: true });
      X.text(NV.Input.isTouch ? '' : 'R: OTRA VEZ AL INSTANTE', W / 2, 318, { align: 'center', color: '#5d6a8a' });
      if (IN.edge('restart')) G.startRun(R.hero);
    },
  };

  // ---------------- OPCIONES ----------------
  // Se entra desde el título o desde la pausa (G.optBack dice adónde volver).
  S.options = {
    enter(G) { G.mi = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W, O = NV.OPT, A = NV.Audio;
      if (G.optBack === 'play') { ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, 360); } else bg(ctx, G, 0.7);
      X.text('OPCIONES', W / 2, 24, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      const rows = [
        { label: 'MÚSICA', val: O.music, max: 10, set: (v) => { O.music = v; A.applyOpts(); } },
        { label: 'EFECTOS', val: O.sfx, max: 10, set: (v) => { O.sfx = v; A.applyOpts(); A.sfx('coin'); } },
        { label: 'VIBRACIÓN', val: O.vib, set: (v) => { O.vib = v; if (v && navigator.vibrate) try { navigator.vibrate(40); } catch (e) {} } },
        { label: 'DESTELLOS Y TEMBLOR', val: O.fx, set: (v) => { O.fx = v; } },
        { label: 'VOLVER', back: true },
      ];
      const back = () => { NV.saveOpt(); NV.Audio.sfx('select'); if (G.optBack === 'play') { G.state = 'play'; IN.clear(); IN.touchOn = true; } else G.go('title'); };
      if (IN.edge('up')) { G.mi = (G.mi + rows.length - 1) % rows.length; A.sfx('move'); }
      if (IN.edge('down')) { G.mi = (G.mi + 1) % rows.length; A.sfx('move'); }
      const change = (r, d) => { if (r.back) return; if (r.max) r.set(U.clamp(r.val + d, 0, r.max)); else r.set(!r.val); if (r.max) A.sfx('move'); };
      const tap = G.tapThisFrame;
      rows.forEach((r, i) => {
        const y = 74 + i * 44, sel = G.mi === i, x0 = W / 2 - 190, rw = 380;
        if (r.back) { const rr = X.button('VOLVER', W / 2, y + 14, 160, 30, { active: sel }); if (IN.inRect(tap, rr)) back(); return; }
        X.panel(x0, y, rw, 34, { fill: sel ? 'rgba(179,19,43,.35)' : 'rgba(10,10,22,.85)', border: sel ? '#ffffff' : '#3a4466' });
        X.text(r.label, x0 + 12, y + 11, { color: sel ? '#ffffff' : '#cfd8e6' });
        if (r.max) {
          for (let b = 0; b < r.max; b++) X.rect(x0 + 190 + b * 14, y + 10, 10, 14, b < r.val ? (sel ? '#f5c542' : '#8ea2c4') : '#1a1e30');
          X.text('◀', x0 + 176, y + 11, { color: '#5d6a8a' }); X.text('▶', x0 + 336, y + 11, { color: '#5d6a8a' });
        } else X.text(r.val ? 'SÍ' : 'NO', x0 + rw - 20, y + 9, { scale: 2, align: 'right', color: r.val ? '#33e07a' : '#ff2e4a' });
        // tocar: mitad izquierda baja, mitad derecha sube (o cambia SÍ/NO)
        if (IN.inRect(tap, { x: x0, y, w: rw, h: 34 })) { G.mi = i; change(r, tap.x < x0 + 190 + (r.max || 0) * 7 ? -1 : 1); }
      });
      const r = rows[G.mi];
      if (IN.edge('left')) change(r, -1);
      if (IN.edge('right')) change(r, 1);
      if (IN.edge('confirm') || IN.edge('jump')) { if (r.back) back(); else if (!r.max) change(r, 1); }
      if (IN.edge('back') || IN.edge('pause')) back();
      if (!NV.OPT.fx) X.text('SIN FLASHES DE PANTALLA NI SACUDIDAS DE CÁMARA', W / 2, 300, { align: 'center', color: '#5d6a8a' });
    },
  };

  // ---------------- PLACA PARA HISTORIAS DE INSTAGRAM ----------------
  // Se arma en 360x640 con el estilo pixel y se agranda x3 (1080x1920, formato historia).
  async function shareCard(G) {
    const X = NV.X, R = G.result, h = NV.HEROES[R.hero];
    const c = document.createElement('canvas'); c.width = 360; c.height = 640;
    const k = c.getContext('2d'); k.imageSmoothingEnabled = false;
    const g = k.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#07060b'); g.addColorStop(0.55, h.dark); g.addColorStop(1, '#07060b');
    k.fillStyle = g; k.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 70; i++) { k.fillStyle = i % 7 ? '#3a4466' : '#dfe6f5'; k.fillRect((i * 97) % 360, (i * 53) % 640, 1, 1); }
    const T = (s, x, y, o) => X.text(s, x, y, Object.assign({ ctx: k, align: 'center' }, o));
    k.drawImage(X.img.brutal_logo, 180 - 59, 26, 118, 21);
    const lw = 270, lh = Math.round((lw * X.img.logo.height) / X.img.logo.width);
    k.globalCompositeOperation = 'lighter'; k.drawImage(X.img.logo, 180 - lw / 2, 56, lw, lh); k.globalCompositeOperation = 'source-over'; // el logo trae fondo negro
    const py = 60 + lh;
    k.fillStyle = '#ffffff'; k.fillRect(180 - 88, py - 2, 176, 176); k.fillStyle = h.color; k.fillRect(180 - 86, py, 172, 172);
    k.drawImage(X.img[R.hero + '_portrait'], 180 - 84, py + 2, 168, 168);
    T(h.name, 180, py + 182, { scale: 2, color: h.light, outline: true, ctx: k });
    T('MI TIEMPO', 180, py + 212, { color: '#8ea2c4', ctx: k });
    T(U.fmtTime(R.time), 180, py + 224, { scale: 4, color: '#ffffff', outline: true, ctx: k });
    T('RANGO ' + R.medal[0], 180, py + 268, { scale: 3, color: R.medal[2], outline: true, ctx: k });
    if (G.submit && G.submit.rank) T('PUESTO #' + G.submit.rank + ' DE LA FIESTA', 180, py + 300, { color: '#f5c542', ctx: k });
    T('¿ME GANÁS?', 180, 590, { scale: 3, color: '#ff2e4a', outline: true, ctx: k });
    const big = document.createElement('canvas'); big.width = 1080; big.height = 1920;
    const b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.drawImage(c, 0, 0, 1080, 1920);
    const blob = await new Promise((r) => big.toBlob(r, 'image/png'));
    const file = new File([blob], 'navidance-brutal.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); // en compu: se descarga
  }
  S.shareCard = shareCard;

  // ---------------- SE ACABÓ EL TIEMPO ----------------
  S.timeout = {
    enter(G) { G.mi = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.7);
      X.text('¡SE ACABÓ EL TIEMPO!', W / 2, 90, { scale: 3, align: 'center', color: '#ff2e4a', outline: true });
      X.text('EL APAGÓN CORTÓ LA NAVIDANCE', W / 2, 124, { scale: 1, align: 'center', color: '#4de2ff' });
      X.text('TENÉS 3 MINUTOS PARA LLEGAR Y VENCERLO', W / 2, 140, { align: 'center', color: '#8ea2c4' });
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 70, y: 200, w: 130, h: 32, color: '#b3132b', act: () => G.startRun(G.heroKey) },
        { label: 'MENÚ', x: W / 2 + 70, y: 200, w: 130, h: 32, act: () => G.go('title') },
      ], { horiz: true });
      if (IN.edge('restart')) G.startRun(G.heroKey);
    },
  };

  // ---------------- RANKING ----------------
  S.ranking = {
    async enter(G) { G.mi = 1; G.rank = null; G.rank = await NV.DB.top(NV.CFG.RANKING_SIZE); },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.65);
      X.text('RANKING DE TIEMPO', W / 2, 10, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      X.panel(W / 2 - 220, 40, 440, 236);
      const me = NV.DB.profile();
      if (!G.rank) X.text('CARGANDO...', W / 2, 140, { scale: 2, align: 'center', color: '#8ea2c4' });
      else if (!G.rank.length) X.text('TODAVÍA NADIE TERMINÓ EL NIVEL. ¡SÉ EL PRIMERO!', W / 2, 140, { align: 'center', color: '#8ea2c4' });
      else G.rank.forEach((r, i) => {
        const y = 50 + i * 22, mine = me && (r.player === me.id);
        const col = i === 0 ? '#f5c542' : i === 1 ? '#dfe6f5' : i === 2 ? '#e0904a' : '#cfd8e6';
        if (mine) X.rect(W / 2 - 214, y - 3, 428, 20, 'rgba(255,255,255,.12)');
        X.text('#' + (i + 1), W / 2 - 206, y, { scale: 2, color: col });
        if (X.img[r.hero + '_face']) ctx.drawImage(X.img[r.hero + '_face'], Math.round(W / 2 - 158), y - 2, 16, 16);
        X.text(String(r.name || '').toUpperCase().slice(0, 16), W / 2 - 134, y, { scale: 2, color: mine ? '#ffffff' : col });
        X.text(U.fmtTime(r.timeMs / 1000), W / 2 + 206, y, { scale: 2, align: 'right', color: col });
        const md = NV.CFG.MEDALS.find((m) => r.timeMs / 1000 < m[1]);
        X.text(md[0], W / 2 + 92, y, { scale: 2, align: 'center', color: md[2] });
      });
      menu(G, [
        { label: 'VOLVER', x: W / 2 - 70, y: 304, w: 130, h: 30, act: () => G.go('title') },
        { label: '▶ JUGAR', x: W / 2 + 70, y: 304, w: 130, h: 30, color: '#b3132b', act: () => G.go(NV.DB.profile() ? 'select' : 'register') },
      ], { horiz: true });
    },
  };

  // ---------------- PAUSA ----------------
  S.pause = function (ctx, G) {
    const X = NV.X, W = X.W;
    ctx.fillStyle = 'rgba(5,4,12,.75)'; ctx.fillRect(0, 0, W, 360);
    X.text('PAUSA', W / 2, 70, { scale: 4, align: 'center', color: '#f5c542', outline: true });
    X.text('EL RELOJ SIGUE CORRIENDO', W / 2, 108, { align: 'center', color: '#8ea2c4' });
    menu(G, [
      { label: 'CONTINUAR', x: W / 2, y: 150, w: 200, act: () => G.unpause() },
      { label: 'REINICIAR', x: W / 2, y: 186, w: 200, act: () => { G.paused = false; G.startRun(G.heroKey); } },
      { label: 'OPCIONES', x: W / 2, y: 222, w: 200, act: () => { G.optBack = 'play'; G.state = 'options'; G.mi = 0; IN.clear(); IN.touchOn = false; } },
      { label: 'SALIR', x: W / 2, y: 258, w: 200, act: () => { G.paused = false; G.go('title'); NV.Audio.preview(G.heroKey); } },
    ]);
  };

  NV.Screens = S;
})();
