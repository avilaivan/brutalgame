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
    NV.Stage.drawMenuFloor(ctx, G, G.menuCam); // el piso primero: las luces caen encima
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
      const out = U.clamp((t - 564) / 34, 0, 1);         // fundido a negro: la pantalla dura 10 s en total (entrada y salida incluidas)
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
      if (t > 600 || (t > 30 && (IN.edges.size > 0 || G.tapThisFrame))) { IN.edges.clear(); G.tapThisFrame = null; G.go('credits'); }
    },
  };

  // ---------------- CRÉDITOS: "DESIGNED & PRODUCED BY / DKZ & AM" ----------------
  // Pantalla negra después del logo de BRUTAL. Arriba, chico; abajo, grande y con más peso: DKZ & AM.
  S.credits = {
    enter(G) { G.ct = 0; },
    draw(ctx, G) {
      const X = NV.X, W = X.W, t = ++G.ct;
      X.rect(0, 0, W, 360, '#000');
      const fin = U.clamp((t - 14) / 22, 0, 1), fout = U.clamp((t - 564) / 34, 0, 1), a = fin * (1 - fout); // 10 s en total y al final se funde a negro
      const a2 = U.clamp((t - 34) / 18, 0, 1) * (1 - fout);
      if (t === 34) { NV.Audio.sfx('slam'); NV.Audio.menuSong(); } // con DKZ & AM ya suena la canción del menú
      // línea 1: chica, gris
      X.text('DESIGNED & PRODUCED BY', W / 2, 142, { align: 'center', color: '#8ea2c4', shadow: false, alpha: a, narrow: true });
      // línea 2: DKZ & AM, grande, entra con un pequeño golpe de escala y un brillo rojo detrás
      if (a2 > 0) {
        const pop = 1 + (1 - ease(U.clamp((t - 34) / 16, 0, 1))) * 0.25, y = 170;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * a2;
        const g = ctx.createRadialGradient(W / 2, y + 14, 4, W / 2, y + 14, 150); g.addColorStop(0, 'rgba(255,46,74,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(W / 2 - 150, y + 14 - 150, 300, 300); ctx.restore();
        ctx.save(); ctx.translate(W / 2, y + 14); ctx.scale(pop, pop); ctx.translate(-W / 2, -(y + 14));
        X.text('DKZ & AM', W / 2, y, { scale: 4, align: 'center', color: '#ffffff', fancy: true, alpha: a2 });
        ctx.restore();
        const bar = ease(U.clamp((t - 44) / 18, 0, 1)) * 70;
        ctx.globalAlpha = a2; X.rect(W / 2 - bar, y + 40, bar * 2, 2, '#ff2e4a'); ctx.globalAlpha = 1;
      }
      if (t > 600 || (t > 30 && (IN.edges.size > 0 || G.tapThisFrame))) { if (t < 34) NV.Audio.menuSong(); IN.edges.clear(); G.tapThisFrame = null; G.go('story'); }
    },
  };

  // ---------------- HISTORIA: 4 escenas con cuadro de diálogo ----------------
  // Flujo: el texto se escribe solo. Tocar / cualquier tecla = completa el texto; otra vez = escena siguiente.
  // Si no se toca nada avanza sola. SALTEAR (botón, Esc o Borrar) va directo al menú.
  const ease = (v) => 1 - Math.pow(1 - U.clamp(v, 0, 1), 3);
  const bounce = (v) => { v = U.clamp(v, 0, 1); const n = 7.5625, d = 2.75; if (v < 1 / d) return n * v * v; if (v < 2 / d) return n * (v -= 1.5 / d) * v + 0.75; if (v < 2.5 / d) return n * (v -= 2.25 / d) * v + 0.9375; return n * (v -= 2.625 / d) * v + 0.984375; };
  const PAGES = [
    { who: 'NOCHEBUENA · 9 DE JULIO', color: '#4de2ff', scene: 'party', lines: ['LA NAVIDANCE DE BRUTAL. ESTÁ A FULL.', 'TODA LA CIUDAD BAILA BAJO LA NIEVE...'] },
    { who: '???', color: '#8ea2c4', scene: 'dark', lines: ['¡SE CORTÓ LA LUZ!', 'ALGO ENORME CAYÓ SOBRE EL ESCENARIO.'] },
    { who: 'ROBO-GRINCH', color: '#ff2e4a', scene: 'boss', lines: ['"ODIO LA NAVIDAD. Y ODIO SU MÚSICA."', 'SE ROBÓ EL SONIDO DE LA FIESTA.'] },
    { who: 'BRUTAL.', color: '#f5c542', scene: 'djs', lines: ['¡SOLO UN DJ PUEDE SALVAR LA NAVIDANCE!', 'ELEGÍ EL TUYO Y RECUPERÁ EL SONIDO.'] },
  ];
  const TYPE = 2.6, HOLD = 600; // cuadros por letra y espera antes de avanzar sola (~10 s con el texto completo, para que todos lleguen a leer)
  S.story = {
    enter(G) { G.sp = 0; G.st = 0; G.sfade = 0; NV.Audio.menuSong(); },
    draw(ctx, G) {
      const X = NV.X, W = X.W, pg = PAGES[G.sp], t = ++G.st;
      const total = pg.lines.reduce((a, l) => a + l.length, 0), typed = Math.min(total, Math.floor(t / TYPE)), done = typed >= total;
      // ---------- escena ----------
      if (pg.scene === 'party') { G.hype = 2; bg(ctx, G, 0.4); }
      else if (pg.scene === 'dark') {
        bg(ctx, G, 0.93);
        if (t === 1) NV.Audio.sfx('blackout');
        if (t < 12 && (t & 2) && NV.OPT.fx) X.rect(0, 0, W, 360, '#ffffff');
        if (t > 46) { // dos gafas que se encienden en la oscuridad
          const a = Math.min(1, (t - 46) / 20), ex = W / 2, ey = 150;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 0.3));
          for (const [dx, c] of [[-14, 'rgba(255,46,74,1)'], [14, 'rgba(51,224,122,1)']]) { const g = ctx.createRadialGradient(ex + dx, ey, 0, ex + dx, ey, 26); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(ex + dx - 26, ey - 26, 52, 52); }
          ctx.restore(); X.rect(ex - 22, ey - 2, 16, 4, '#ff2e4a'); X.rect(ex + 6, ey - 2, 16, 4, '#33e07a');
          if (t === 47) NV.Audio.sfx('laser_charge');
        }
      } else if (pg.scene === 'boss') {
        bg(ctx, G, 0.86);
        const up = ease(t / 34), shake = t > 30 && t < 46 && NV.OPT.fx ? (Math.random() - 0.5) * 6 : 0;
        if (t === 30) { NV.Audio.sfx('slam'); NV.Audio.sfx('roar'); }
        // haz de luz roja detrás + Robo-Grinch subiendo
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * up; ctx.fillStyle = '#ff2e4a';
        ctx.beginPath(); ctx.moveTo(W / 2 - 30, 0); ctx.lineTo(W / 2 + 30, 0); ctx.lineTo(W / 2 + 190, 270); ctx.lineTo(W / 2 - 190, 270); ctx.fill(); ctx.restore();
        X.boss(0, W / 2 + 10 + shake, 262 + (1 - up) * 240, { scale: 1.5, sy: 1 + Math.sin(t * 0.07) * 0.01 });
      } else {
        bg(ctx, G, 0.6); G.hype = 2;
        NV.HERO_ORDER.forEach((k, i) => {
          const h = NV.HEROES[k], y = 250 - bounce((t - i * 9) / 30) * 224, x = W / 2 + (i - 1) * 150;
          if (t < i * 9) return;
          X.panel(x - 62, y, 124, 150, { fill: h.dark, border: h.color, light: h.light });
          ctx.drawImage(X.img[k + '_portrait'], x - 56, y + 6, 112, 112);
          X.rect(x - 56, y + 118, 112, 2, h.color);
          X.text(h.name, x, y + 126, { align: 'center', scale: 2, color: '#ffffff', maxW: 112 });
          if (t === i * 9 + 12) NV.Audio.sfx('move');
        });
      }
      // ---------- cuadro de diálogo ----------
      const bx = Math.round(W / 2 - 270), by = 268, bw = 540, bh = 80;
      X.panel(bx, by, bw, bh, { fill: 'rgba(6,5,14,.94)', border: pg.color, light: '#ffffff', snow: false });
      X.panel(bx + 12, by - 12, X.measure(pg.who, 1) + 20, 18, { fill: '#0b0a16', border: pg.color, light: false, snow: false });
      X.text(pg.who, bx + 22, by - 7, { color: pg.color });
      let left = typed;
      // la escala se decide con el renglón completo (si no, el texto "salta" de tamaño al terminar de escribirse)
      pg.lines.forEach((ln, i) => { const n = Math.min(ln.length, left); left -= n; const sc = X.fit(ln, 2, { maxW: bw - 40 }).sc; if (n > 0) X.text(ln.slice(0, n), bx + 20, by + 16 + i * 26 + (2 - sc) * 4, { scale: sc, fancy: true, color: i ? '#dfe6f5' : '#ffffff' }); });
      if (!done && (t & 3) === 0) NV.Audio.sfx('move');
      if (done && (G.frame >> 4) % 2) X.text('▶', bx + bw - 20, by + bh - 18, { color: pg.color });
      // progreso (puntos) y saltear
      PAGES.forEach((_, i) => X.rect(W / 2 - PAGES.length * 6 + i * 12, by + bh + 4, 8, 3, i === G.sp ? pg.color : '#2a3350'));
      const skipR = X.button('SALTEAR ▶▶', W - 62, 20, 108, 22, { scale: 1 });
      X.text(NV.Input.isTouch ? 'TOCÁ PARA SEGUIR' : 'ENTER / ESPACIO: SEGUIR  ·  ESC: SALTEAR', 10, 12, { color: '#5d6a8a' });
      // ---------- fundido entre escenas ----------
      if (G.sfade > 0) { ctx.globalAlpha = G.sfade / 8; X.rect(0, 0, W, 360, '#05040a'); ctx.globalAlpha = 1; G.sfade--; }
      // ---------- entrada ----------
      const tap = G.tapThisFrame; G.tapThisFrame = null;
      if (IN.edge('pause') || IN.edge('back') || IN.inRect(tap, skipR)) { NV.Audio.sfx('select'); G.go('title'); return; }
      const any = t > 8 && (IN.edges.size > 0 || tap); IN.edges.clear();
      const next = () => { if (G.sp >= PAGES.length - 1) G.go('title'); else { G.sp++; G.st = 0; G.sfade = 8; } };
      if (any) { if (!done) G.st = Math.ceil(total * TYPE) + 1; else { NV.Audio.sfx('select'); next(); } }
      else if (t > total * TYPE + HOLD) next();
    },
  };

  // ---------------- TÍTULO ----------------
  // Entrada animada: arranca TODO A OSCURAS -> se enciende el video del logo (loop, sin sonido)
  // -> la ciudad se arma de abajo hacia arriba, baja el truss, se prenden las luces, sube el público
  // -> entran los botones uno por uno. Tocar o apretar una tecla adelanta la entrada.
  // La primera vez es completa; al volver desde otra pantalla es más corta.
  const T_VIDEO = 14, T_CITY = 150, T_UI = 318, T_READY = 356; // en cuadros (60 = 1 s): el logo se arma ~6 s
  function titleBg(ctx, G, t) {
    const X = NV.X, W = X.W;
    G.menuCam = (G.menuCam || 0) + 0.5;
    const cam = G.menuCam;
    NV.Stage.drawBack(ctx, G, cam);
    NV.Stage.drawMenuFloor(ctx, G, cam); // el piso primero: las luces caen encima
    // las luces se prenden de a poco (parpadeo de arranque)
    const la = U.clamp((t - T_CITY - 34) / 26, 0, 1);
    if (la > 0) { ctx.save(); ctx.globalAlpha = la * (la < 1 && (t >> 1) % 3 === 0 ? 0.4 : 1); NV.Stage.drawLights(ctx, G, cam); ctx.restore(); }
    // el truss baja desde arriba
    const tr = ease((t - T_CITY - 18) / 28);
    if (tr > 0) { ctx.save(); ctx.translate(0, Math.round((1 - tr) * -60)); NV.Stage.drawTruss(ctx, G, cam); ctx.restore(); }
    NV.Stage.drawSnow(ctx, cam);
    ctx.fillStyle = 'rgba(5,4,12,0.35)'; ctx.fillRect(0, 0, W, 360);
    // la ciudad aparece por franjas, de abajo hacia arriba
    const bands = 30, bh = 12;
    for (let i = 0; i < bands; i++) {
      const a = 1 - U.clamp((t - T_CITY - (bands - 1 - i) * 1.4) / 10, 0, 1);
      if (a > 0) { ctx.fillStyle = 'rgba(2,2,8,' + a + ')'; ctx.fillRect(0, i * bh, W, bh); }
    }
    // el público sube desde abajo
    const cr = ease((t - T_CITY - 40) / 30);
    if (cr > 0) { ctx.save(); ctx.translate(0, Math.round((1 - cr) * 90)); NV.Stage.drawCrowd(ctx, G, cam); ctx.restore(); }
  }
  // VIDEO del logo (SALVA LA NAVIDANCE INFINITO, fondo negro, loop ya hecho en el video). Es un <video> real
  // encima del juego, en su calidad original; se ubica sobre la zona del logo (escala y bordes de la pantalla
  // incluidos) y se funde con opacidad en la entrada. Si el video no puede reproducirse, se dibuja logo.png.
  const VID = { x: -200, y: -10, w: 400, h: 225 }; // rectángulo del video en coordenadas internas (W/2 + x)
  const vidEl = () => document.getElementById('menuVideo');
  function videoOk() { const v = vidEl(); return v && !v.error && v.readyState >= 2 && !v.paused; }
  function placeVideo(W, alpha) {
    const v = vidEl(); if (!v) return;
    const c = NV.X.ctx.canvas, r = c.getBoundingClientRect(), k = r.height / NV.CFG.H;
    const st = v.style;
    st.display = 'block'; st.opacity = String(alpha);
    st.left = Math.round(r.left + (W / 2 + VID.x) * k) + 'px'; st.top = Math.round(r.top + VID.y * k) + 'px';
    st.width = Math.round(VID.w * k) + 'px'; st.height = Math.round(VID.h * k) + 'px';
    if (v.paused) { const p = v.play(); if (p) p.catch(() => {}); }
  }
  function hideVideo() { const v = vidEl(); if (v) { v.style.display = 'none'; v.pause(); } }
  NV.hideMenuVideo = hideVideo;
  function titleVideo(ctx, G, t, W) {
    if (t < T_VIDEO) { hideVideo(); return; }
    const a = U.clamp((t - T_VIDEO) / 24, 0, 1);
    const v = vidEl();
    if (v && !v.error) {
      if (!G.vidStarted) { G.vidStarted = true; try { v.currentTime = 0; } catch (e) {} } // la primera vez arranca desde el principio
      placeVideo(W, a);
      if (videoOk()) G.vidPlayed = true;
      // Una vez que el video arrancó, se queda SIEMPRE (al volver a empezar el loop hay un instante en que
      // el navegador lo marca como "cargando": no es un error). El logo fijo solo aparece si el video
      // no puede reproducirse nunca (archivo que falta o navegador sin soporte).
      if (G.vidPlayed || t < T_VIDEO + 240) return;
    }
    hideVideo();
    // respaldo: el logo fijo
    const logo = NV.X.img.logo, lw = 270, lh = (lw * logo.height) / logo.width;
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(logo, Math.round(W / 2 - lw / 2), Math.round(6 + Math.sin(G.frame * 0.04) * 2), lw, lh);
    ctx.restore();
  }
  S.title = {
    enter(G) {
      G.mi = 0; NV.Audio.menuSong(); // menú principal = siempre la canción del menú (Flower In A Hurricane)
      G.partyTop = null; NV.DB.top(1).then((r) => { G.partyTop = r && r[0]; }); // récord a vencer
      G.tt = G.titleSeen ? T_UI - 50 : 0; G.titleSeen = true; // al volver al menú, la entrada es más corta
    },
    leave() { hideVideo(); },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      // adelantar la entrada con cualquier toque / tecla
      if (G.tt < T_READY && (G.tapThisFrame || IN.edges.size)) { G.tt = Math.max(G.tt, T_READY - 1); G.tapThisFrame = null; IN.edges.clear(); }
      const t = ++G.tt;
      X.rect(0, 0, W, 360, '#020208');
      if (t > T_CITY - 4) titleBg(ctx, G, t);
      titleVideo(ctx, G, t, W);
      if (t === T_VIDEO + 2) NV.Audio.sfx('laser_charge');
      if (t === T_UI) NV.Audio.sfx('slam');
      // ---- interfaz: cada elemento entra con su propio retardo ----
      const k = (d, len = 18) => ease((t - T_UI - d) / len);
      const brand = k(0);
      if (brand > 0) { ctx.save(); ctx.translate(Math.round((1 - brand) * -140), 0); ctx.drawImage(X.img.brutal_logo, 10, 10, 94, 16); X.text('9 DE JULIO · BS. AS.', 10, 30, { color: '#5d6a8a' }); ctx.restore(); }
      const pr = k(4);
      if (pr > 0) {
        ctx.save(); ctx.globalAlpha = pr; ctx.translate(0, Math.round((1 - pr) * 12));
        X.text('★ EL TOP 3 SE LLEVA PREMIO ★', W / 2, 186, { align: 'center', color: (G.frame >> 3) % 2 ? '#f5c542' : '#ffffff', outline: true });
        const top = G.partyTop;
        if (top) X.text('#1 DEL RANKING: ' + String(top.name).toUpperCase() + '  ' + U.fmtTime(top.timeMs / 1000), W / 2, 202, { scale: 2, align: 'center', color: '#ff2e4a', outline: true, maxW: W - 24 });
        else X.text('COMPETÍ POR EL MEJOR TIEMPO', W / 2, 202, { scale: 2, align: 'center', color: '#ff2e4a', outline: true });
        ctx.restore();
      }
      const prof = NV.DB.profile();
      const items = [
        { label: '▶ JUGAR', x: W / 2, y: 244, w: 220, h: 34, scale: 3, color: '#b3132b', act: () => { NV.Audio.pauseMenu(); G.go(prof ? 'select' : 'register'); } },
        { label: 'RANKING', x: W / 2 - 158, y: 288, w: 150, h: 26, color: '#2559d6', act: () => { G.rankBack = 'title'; G.go('ranking'); } },
        { label: prof ? 'CAMBIAR' : 'REGISTRO', x: W / 2, y: 288, w: 150, h: 26, color: '#1c9e4f', act: () => G.go('register') },
        { label: 'OPCIONES', x: W / 2 + 158, y: 288, w: 150, h: 26, color: '#7a5cff', act: () => { G.optBack = 'title'; G.go('options'); } },
      ];
      if (t < T_READY) {
        // los botones entran: JUGAR crece con rebote; los chicos suben de a uno
        items.forEach((it, i) => {
          const d = i === 0 ? 10 : 18 + i * 6, p = i === 0 ? bounce((t - T_UI - d) / 22) : ease((t - T_UI - d) / 14);
          if (p <= 0) return;
          if (t === T_UI + d + 1) NV.Audio.sfx('move');
          ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5);
          if (i === 0) { ctx.translate(it.x, it.y); ctx.scale(p, p); ctx.translate(-it.x, -it.y); } else ctx.translate(0, Math.round((1 - p) * 40));
          X.button(it.label, it.x, it.y, it.w, it.h, { active: i === 0, color: it.color, scale: it.scale });
          ctx.restore();
        });
        G.tapThisFrame = null; IN.edges.clear();
      } else menu(G, items);
      const ft = k(44);
      if (ft > 0) {
        ctx.save(); ctx.globalAlpha = ft;
        if (prof) X.text('JUGANDO COMO ' + prof.name.toUpperCase() + '  @' + prof.ig, W / 2, 312, { align: 'center', color: '#cfd8e6', maxW: W - 24 });
        X.text(NV.Input.isTouch ? 'TOCÁ PARA ELEGIR' : 'FLECHAS + ENTER  ·  M: SONIDO', W / 2, 344, { align: 'center', color: '#5d6a8a' });
        ctx.restore();
      }
      // destello blanco cuando termina de armarse
      if (t >= T_UI && t < T_UI + 8 && NV.OPT.fx) { ctx.globalAlpha = (T_UI + 8 - t) / 16; X.rect(0, 0, W, 360, '#ffffff'); ctx.globalAlpha = 1; }
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
    enter(G) { G.sel = G.sel === undefined ? 0 : G.sel; G.mi = 0; G.selT = 0; if (NV.Audio.cur !== NV.HERO_ORDER[G.sel]) NV.Audio.preview(NV.HERO_ORDER[G.sel]); else NV.Audio.resume(); },
    draw(ctx, G) {
      const X = NV.X, W = X.W;
      bg(ctx, G, 0.55);
      X.text('ELEGÍ TU DJ', W / 2, 12, { scale: 3, align: 'center', outline: true });
      X.text('LOS 3 CORREN Y DISPARAN IGUAL · CADA UNO TIENE SU CANCIÓN', W / 2, 42, { align: 'center', color: '#8ea2c4' });
      const cw = Math.min(176, (W - 40) / 3), gap = 10, x0 = W / 2 - (cw * 3 + gap * 2) / 2;
      const rects = [];
      G.selT++;
      NV.HERO_ORDER.forEach((k, i) => {
        const h = NV.HEROES[k], x = x0 + i * (cw + gap), y = 54, sel = G.sel === i, ch = 224;
        rects.push({ x, y, w: cw, h: ch });
        X.panel(x, y, cw, ch, { fill: sel ? h.dark : 'rgba(10,10,22,.9)', border: sel ? h.color : '#2a3350', light: sel ? h.light : '#3a4466' });
        // retrato CUADRADO, con su proporción original (como en la historia), centrado en la tarjeta
        const ps = Math.min(cw - 12, 104), px = Math.round(x + cw / 2 - ps / 2);
        ctx.save(); ctx.globalAlpha = sel ? 1 : 0.4; ctx.drawImage(X.img[k + '_portrait'], px, y + 6, ps, ps); ctx.restore();
        X.rect(px, y + 6 + ps, ps, 2, h.color);
        // el elegido corre y dispara en el lugar (muestra de sus animaciones)
        const cyc = G.selT % 180, an = !sel ? 'idle' : cyc < 70 ? 'run' : cyc < 120 ? 'runshoot' : 'shoot';
        const fpos = an === 'idle' ? 0 : an === 'shoot' ? 1 + ((cyc >> 3) % 2) : (G.selT * X.heroFrames(k, an)) / 30;
        // el DJ chiquito: más arriba, y las barritas del ritmo DEBAJO de sus pies (no lo tapan)
        const feet = y + 162;
        X.hero(k, an, fpos, x + cw / 2 - 4, feet, false, false, undefined, 1, an === 'run' || an === 'runshoot' ? (fpos % 1) * 0.6 : 0);
        if (sel) { const bl = Math.round(G.bass * 10); for (let b = 0; b < 10; b++) X.rect(x + cw / 2 - 25 + b * 5, feet + 4 - (b < bl ? 3 : 0), 4, b < bl ? 4 : 1, h.color); }
        X.text(h.name, x + cw / 2, y + 174, { align: 'center', scale: 2, color: sel ? '#fff' : '#8ea2c4', maxW: cw - 10 });
        X.text('DJ ' + h.role, x + cw / 2, y + 194, { align: 'center', color: sel ? h.color : '#5d6a8a' });
        X.text('♪ ' + window.MUSIC_DATA[k].title + ' · ' + window.MUSIC_DATA[k].bpm.toFixed(0) + ' BPM', x + cw / 2, y + 207, { align: 'center', color: sel ? h.light : '#5d6a8a', maxW: cw - 8 });
      });
      const pick = (i) => { if (i !== G.sel) { G.sel = i; NV.Audio.sfx('move'); NV.Audio.preview(NV.HERO_ORDER[i]); return false; } return true; };
      if (IN.edge('left')) pick((G.sel + 2) % 3);
      if (IN.edge('right')) pick((G.sel + 1) % 3);
      const t = G.tapThisFrame;
      for (let i = 0; i < 3; i++) if (IN.inRect(t, rects[i])) { G.tapThisFrame = null; if (pick(i)) { NV.Audio.sfx('select'); G.startRun(NV.HERO_ORDER[i]); return; } }
      const h = NV.HEROES[NV.HERO_ORDER[G.sel]];
      menu(G, [
        { label: '¡A JUGAR!', x: W / 2 + 60, y: 304, w: 180, h: 30, scale: 2, color: { ivan: '#b3132b', hades: '#2559d6', matias: '#1c9e4f' }[NV.HERO_ORDER[G.sel]], act: () => G.startRun(NV.HERO_ORDER[G.sel]) },
        { label: 'VOLVER', x: W / 2 - 100, y: 304, w: 110, h: 26, act: () => G.go('title') },
      ], { horiz: true, nav: false });
      X.text(NV.Input.isTouch ? 'TOCÁ UN DJ PARA ESCUCHAR SU CANCIÓN' : '◀ ▶ ELEGIR  ·  ENTER JUGAR  ·  ESC VOLVER', W / 2, 334, { align: 'center', color: '#5d6a8a' });
      if (IN.edge('back') || IN.edge('pause')) { NV.Audio.sfx('select'); G.go('title'); }
    },
  };

  // ---------------- RESULTADOS ----------------
  S.results = {
    enter(G) { const back = G.rankBack === 'results'; G.mi = 0; G.rt = back ? 200 : 0; G.rkT0 = back ? -999 : null; G.cheered = back; G.rankBack = null; G.confetti = []; G.top3 = null; NV.DB.top(3).then((r) => { G.top3 = r; }); },
    draw(ctx, G) {
      const X = NV.X, W = X.W, R = G.result, h = NV.HEROES[R.hero], rk = G.submit;
      const t = ++G.rt;
      bg(ctx, G, 0.6);
      X.text('¡NAVIDANCE SALVADA!', W / 2, 10, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      X.panel(W / 2 - 220, 40, 440, rk && rk.local ? 206 : 186, { border: h.color, light: h.light });
      // retrato
      ctx.drawImage(X.img[R.hero + '_portrait'], W / 2 - 208, 52, 104, 104);
      X.rect(W / 2 - 208, 156, 104, 2, h.color);
      X.text(h.name, W / 2 - 156, 164, { align: 'center', color: h.light, maxW: 104 });
      // tiempo (cuenta rápida hasta el valor final)
      const shown = R.time * Math.min(1, t / 30);
      X.text('TU TIEMPO', W / 2 + 22, 52, { align: 'center', color: '#8ea2c4' });
      X.text(U.fmtTime(shown), W / 2 + 22, 66, { scale: 4, narrow: true, maxW: 236, align: 'center', color: t < 30 ? '#f5c542' : '#ffffff', outline: true });
      if (R.pb) X.text('¡NUEVO RÉCORD PERSONAL!', W / 2 + 22, 104, { align: 'center', color: (G.frame >> 3) % 2 ? '#f5c542' : '#ff2e4a', outline: true });
      else if (R.prevBest) X.text('TU RÉCORD: ' + U.fmtTime(R.prevBest), W / 2 + 22, 104, { align: 'center', color: '#8ea2c4' });
      let rkTxt = 'GUARDANDO...', rkCol = '#8ea2c4';
      if (rk && rk.queued) { rkTxt = 'SIN SEÑAL · REINTENTANDO'; rkCol = '#f5c542'; }
      else if (rk && rk.error) { rkTxt = 'NO ENTRÓ AL RANKING'; rkCol = '#ff2e4a'; }
      else if (rk && rk.rank) {
        // el puesto "sube" desde el último hasta el tuyo
        if (G.rkT0 === null) G.rkT0 = Math.max(t, 40); // arranca cuando terminó de contar el tiempo
        const k = U.clamp((t - G.rkT0) / 40, 0, 1), e = 1 - Math.pow(1 - k, 3), from = Math.max(rk.rank, rk.total || rk.rank);
        const shownRank = Math.round(from + (rk.rank - from) * e);
        rkTxt = 'PUESTO #' + shownRank + (rk.total ? ' DE ' + rk.total : ''); rkCol = k >= 1 && rk.rank <= 3 ? '#f5c542' : '#ffffff';
        if (k < 1 && t % 3 === 0 && shownRank !== rk.rank) NV.Audio.sfx('move');
        // festejo: TOP 3 o récord personal (una sola vez)
        if (k >= 1 && !G.cheered) { G.cheered = true; if (rk.rank <= 3 || R.pb) { NV.Audio.sfx('cheer'); NV.Audio.sfx(rk.rank <= 3 ? 'fever' : 'jingle'); G.hype = 200; } }
      }
      X.text(rkTxt, W / 2 + 22, 120, { scale: 2, align: 'center', color: rkCol, outline: true });
      if (rk && rk.error) X.text(rk.error.toUpperCase(), W / 2 + 22, 140, { align: 'center', color: '#8ea2c4' });
      else if (rk && rk.rank && rk.rank <= 3 && t >= G.rkT0 + 40) X.text('¡ESTÁS EN EL TOP 3! TE VAMOS A ESCRIBIR', W / 2 + 22, 140, { align: 'center', color: '#f5c542' });
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
      // las B-Coins y los puntos se cuentan (con la escalita de las monedas) después del tiempo
      const kc = U.clamp((t - 30) / 36, 0, 1);
      if (kc > 0 && kc < 1 && t % 4 === 0) NV.Audio.sfx('coin');
      stat('B-COINS', Math.round(R.coins * kc), W / 2 - 44, '#f5c542'); stat('CAÍDAS', R.deaths, W / 2 + 56, '#cfd8e6'); stat('PUNTOS', Math.round(R.score * kc), W / 2 + 156, '#cfd8e6');
      if (rk && rk.local) X.text('RANKING GUARDADO SOLO EN ESTE DISPOSITIVO', W / 2, 228, { align: 'center', color: '#5d6a8a' });
      // confeti en récord personal o top 3
      if ((R.pb || (rk && rk.rank && rk.rank <= 3)) && G.confetti.length < 120 && t % 2 === 0) for (let i = 0; i < 3; i++) G.confetti.push({ x: U.rand(0, W), y: -6, vx: U.rand(-0.6, 0.6), vy: U.rand(0.8, 2), c: U.pick(['#f5c542', '#ff2e4a', '#4de2ff', '#33e07a', '#ff4fd8', '#ffffff']), r: U.rand(0, 6) });
      for (const c of G.confetti) { c.x += c.vx + Math.sin((t + c.r * 10) * 0.08) * 0.4; c.y += c.vy; X.rect(c.x, c.y, (t + c.r) % 8 < 4 ? 3 : 1, 3, c.c); }
      G.confetti = G.confetti.filter((c) => c.y < 364);
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 112, y: 270, w: 216, h: 30, color: '#b3132b', act: () => G.startRun(R.hero) },
        { label: 'MENÚ PRINCIPAL', x: W / 2 + 112, y: 270, w: 216, h: 30, color: '#c98a12', act: () => G.go('title') },
        { label: 'COMPARTIR', x: W / 2 - 160, y: 309, w: 152, h: 26, color: '#c2187a', act: () => shareCard(G).catch(() => {}) },
        { label: 'RANKING', x: W / 2, y: 309, w: 152, h: 26, color: '#2559d6', act: () => { G.rankBack = 'results'; G.go('ranking'); } },
        { label: 'CAMBIAR DJ', x: W / 2 + 160, y: 309, w: 152, h: 26, color: '#1c9e4f', act: () => G.go('select') },
      ], { horiz: true });
      X.text(NV.Input.isTouch ? '' : 'R: OTRA VEZ AL INSTANTE  ·  ESC: MENÚ PRINCIPAL', W / 2, 340, { align: 'center', color: '#5d6a8a' });
      if (IN.edge('restart')) G.startRun(R.hero);
      if (IN.edge('back') || IN.edge('pause')) { NV.Audio.sfx('select'); G.go('title'); }
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
      X.text('ROBO-GRINCH SE QUEDÓ CON LA NAVIDANCE', W / 2, 124, { scale: 1, align: 'center', color: '#4de2ff' });
      X.text('TENÉS 3 MINUTOS PARA LLEGAR Y VENCERLO', W / 2, 140, { align: 'center', color: '#8ea2c4' });
      menu(G, [
        { label: 'OTRA VEZ', x: W / 2 - 90, y: 200, w: 170, h: 32, color: '#b3132b', act: () => G.startRun(G.heroKey) },
        { label: 'MENÚ PRINCIPAL', x: W / 2 + 90, y: 200, w: 170, h: 32, act: () => G.go('title') },
      ], { horiz: true });
      if (IN.edge('restart')) G.startRun(G.heroKey);
    },
  };

  // ---------------- RANKING ----------------
  // Cada Instagram figura UNA sola vez, con su mejor tiempo. Se ve: NOMBRE · PERSONAJE elegido · TIEMPO.
  S.ranking = {
    enter(G) { G.mi = 1; G.rank = null; G.rankErr = false; const back = G.rankBack || 'title'; G.rankFrom = back; NV.DB.top(NV.CFG.RANKING_SIZE).then((r) => { G.rank = r || []; }).catch(() => { G.rank = []; G.rankErr = true; }); },
    draw(ctx, G) {
      const X = NV.X, W = X.W, L = W / 2 - 260;
      bg(ctx, G, 0.65);
      X.text('RANKING', W / 2, 8, { scale: 3, align: 'center', color: '#f5c542', outline: true });
      X.panel(L, 40, 520, 244);
      X.text('#', L + 12, 48, { color: '#5d6a8a' }); X.text('NOMBRE', L + 66, 48, { color: '#5d6a8a' }); X.text('PERSONAJE', L + 284, 48, { color: '#5d6a8a' }); X.text('TIEMPO', L + 508, 48, { align: 'right', color: '#5d6a8a' });
      X.rect(L + 8, 58, 504, 1, '#2a3350');
      const me = NV.DB.profile();
      if (!G.rank) X.text('CARGANDO...', W / 2, 150, { scale: 2, align: 'center', color: '#8ea2c4' });
      else if (!G.rank.length) X.text(G.rankErr ? 'NO SE PUDO CARGAR EL RANKING' : 'TODAVÍA NADIE TERMINÓ EL NIVEL. ¡SÉ EL PRIMERO!', W / 2, 150, { align: 'center', color: '#8ea2c4' });
      else G.rank.slice(0, 10).forEach((r, i) => {
        const y = 64 + i * 22, mine = me && me.id && (r.id === me.id || r.player === me.id);
        const col = i === 0 ? '#f5c542' : i === 1 ? '#dfe6f5' : i === 2 ? '#e0904a' : '#cfd8e6', h = NV.HEROES[r.hero] || NV.HEROES.ivan;
        if (mine) X.rect(L + 6, y - 3, 508, 20, 'rgba(255,255,255,.12)');
        X.text(String(i + 1), L + 12, y, { scale: 2, color: col, maxW: 30 });
        if (X.img[r.hero + '_face']) ctx.drawImage(X.img[r.hero + '_face'], L + 44, y - 2, 16, 16);
        X.text(String(r.name || '').toUpperCase().slice(0, 16), L + 66, y, { scale: 2, color: mine ? '#ffffff' : col, maxW: 208 });
        X.text(h.name, L + 284, y, { scale: 2, color: h.color, maxW: 112 });
        X.text(U.fmtTime(r.timeMs / 1000), L + 510, y, { scale: 2, narrow: true, align: 'right', color: col, maxW: 104 });
      });
      const back = () => G.go(G.rankFrom === 'results' && G.result ? 'results' : 'title');
      if (G.rankFrom === 'results') G.rankBack = 'results';
      menu(G, [
        { label: 'VOLVER', x: W / 2 - 80, y: 308, w: 150, h: 30, act: back },
        { label: '▶ JUGAR', x: W / 2 + 80, y: 308, w: 150, h: 30, color: '#b3132b', act: () => { G.rankBack = null; G.go(NV.DB.profile() ? 'select' : 'register'); } },
      ], { horiz: true });
      if (IN.edge('back') || IN.edge('pause')) { NV.Audio.sfx('select'); back(); }
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
      { label: 'MENÚ PRINCIPAL', x: W / 2, y: 258, w: 200, act: () => { G.paused = false; G.go('title'); } },
    ]);
  };

  NV.Screens = S;
})();
