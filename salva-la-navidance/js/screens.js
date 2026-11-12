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
  }
  S.bg = bg;

  // ---------------- TÍTULO ----------------
  S.title = {
    enter(G) { G.mi = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.35);
      const logo = X.img.logo, lw = 300, lh = (lw * logo.height) / logo.width;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(logo, Math.round(W / 2 - lw / 2), 10 + Math.round(Math.sin(G.frame * 0.04) * 2) + (G.phase < 0.1 ? -1 : 0), lw, lh); ctx.restore();
      X.text('COMPETÍ POR EL MEJOR TIEMPO', W / 2, 206, { scale: 2, align: 'center', color: '#f5c542', outline: true });
      const prof = NV.DB.profile();
      menu(G, [
        { label: '▶ JUGAR', x: W / 2, y: 244, w: 220, h: 34, scale: 3, color: '#b3132b', act: () => G.go(prof ? 'select' : 'register') },
        { label: 'RANKING', x: W / 2 - 58, y: 288, w: 112, h: 26, color: '#2559d6', act: () => G.go('ranking') },
        { label: prof ? 'CAMBIAR' : 'REGISTRO', x: W / 2 + 58, y: 288, w: 112, h: 26, color: '#1c9e4f', act: () => G.go('register') },
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
        X.text(h.name, x + cw / 2, y + 166, { align: 'center', scale: h.name.length > 10 ? 1 : 2, color: sel ? '#fff' : '#8ea2c4' });
        X.text('♪ ' + window.MUSIC_DATA[k].title, x + cw / 2, y + 184, { align: 'center', color: h.light });
        X.text(window.MUSIC_DATA[k].bpm.toFixed(0) + ' BPM', x + cw / 2, y + 196, { align: 'center', color: '#5d6a8a' });
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
    enter(G) { G.mi = 0; G.rt = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W, R = G.result, h = NV.HEROES[R.hero];
      G.rt++;
      bg(ctx, G, 0.6);
      X.text('¡NAVIDANCE SALVADA!', W / 2, 10, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      X.panel(W / 2 - 200, 42, 400, 196, { border: h.color, light: h.light });
      ctx.drawImage(X.img[R.hero + '_portrait'], W / 2 - 190, 52, 110, 110);
      X.text(h.name, W / 2 - 135, 168, { align: 'center', color: h.light });
      X.text('TU TIEMPO', W / 2 + 60, 54, { align: 'center', color: '#8ea2c4', scale: 1 });
      const pulse = G.rt < 40 ? Math.floor((40 - G.rt) / 8) % 2 : 0;
      X.text(U.fmtTime(R.time), W / 2 + 60, 68, { scale: 4, align: 'center', color: pulse ? '#f5c542' : '#ffffff', outline: true });
      if (R.pb) X.text('¡NUEVO RÉCORD PERSONAL!', W / 2 + 60, 106, { align: 'center', color: (G.frame >> 3) % 2 ? '#f5c542' : '#ff2e4a', outline: true });
      else if (R.prevBest) X.text('TU MEJOR: ' + U.fmtTime(R.prevBest), W / 2 + 60, 106, { align: 'center', color: '#8ea2c4' });
      const rk = G.submit;
      let rkTxt = 'GUARDANDO...', rkCol = '#8ea2c4';
      if (rk && rk.error) { rkTxt = rk.error.toUpperCase(); rkCol = '#ff2e4a'; }
      else if (rk && rk.rank) { rkTxt = 'PUESTO #' + rk.rank + (rk.total ? ' DE ' + rk.total : ''); rkCol = rk.rank <= 3 ? '#f5c542' : '#ffffff'; }
      X.text(rkTxt, W / 2 + 60, 124, { scale: 2, align: 'center', color: rkCol, outline: true });
      if (rk && rk.rank && rk.rank <= 3) X.text('¡ESTÁS EN EL TOP 3!', W / 2 + 60, 146, { align: 'center', color: '#f5c542' });
      X.spr('coin', Math.floor(G.frame / 5), W / 2 - 10, 190); X.text('B-COINS ' + R.coins, W / 2 + 2, 180, { color: '#f5c542' });
      X.text('CAÍDAS ' + R.deaths, W / 2 + 100, 180, { color: '#cfd8e6' });
      X.text('PUNTOS ' + R.score, W / 2 + 2, 196, { color: '#cfd8e6' });
      if (rk && rk.local) X.text('RANKING GUARDADO SOLO EN ESTE DISPOSITIVO', W / 2, 222, { align: 'center', color: '#5d6a8a' });
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 130, y: 272, w: 120, h: 30, color: '#b3132b', act: () => G.startRun(R.hero) },
        { label: 'RANKING', x: W / 2, y: 272, w: 120, h: 30, color: '#2559d6', act: () => G.go('ranking') },
        { label: 'CAMBIAR DJ', x: W / 2 + 130, y: 272, w: 120, h: 30, color: '#1c9e4f', act: () => G.go('select') },
      ], { horiz: true });
    },
  };

  // ---------------- SE ACABÓ EL TIEMPO ----------------
  S.timeout = {
    enter(G) { G.mi = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.7);
      X.text('¡SE ACABÓ EL TIEMPO!', W / 2, 90, { scale: 3, align: 'center', color: '#ff2e4a', outline: true });
      X.text('EL GRINCH SE QUEDÓ CON LA NAVIDANCE', W / 2, 124, { scale: 1, align: 'center', color: '#7cff4d' });
      X.text('TENÉS 3 MINUTOS PARA LLEGAR Y VENCERLO', W / 2, 140, { align: 'center', color: '#8ea2c4' });
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 70, y: 200, w: 130, h: 32, color: '#b3132b', act: () => G.startRun(G.heroKey) },
        { label: 'MENÚ', x: W / 2 + 70, y: 200, w: 130, h: 32, act: () => G.go('title') },
      ], { horiz: true });
    },
  };

  // ---------------- RANKING ----------------
  S.ranking = {
    async enter(G) { G.mi = 0; G.rank = null; G.rank = await NV.DB.top(NV.CFG.RANKING_SIZE); },
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
      { label: NV.Audio.muted ? 'SONIDO: NO' : 'SONIDO: SÍ', x: W / 2, y: 222, w: 200, act: () => NV.Audio.toggleMute() },
      { label: 'SALIR', x: W / 2, y: 258, w: 200, act: () => { G.paused = false; G.go('title'); NV.Audio.preview(G.heroKey); } },
    ]);
  };

  NV.Screens = S;
})();
