// =====================================================================
//  SALVA LA NAVIDANCE — NÚCLEO: estados, carrera contra el reloj, cámara
// =====================================================================
(function () {
  const C = NV.CFG, U = NV.U, IN = NV.Input, FX = NV.FX, A = NV.Audio, X = NV.X, T = NV.T;
  const params = new URLSearchParams(location.search);
  const G = { state: 'boot', frame: 0, parts: [], booms: [], texts: [], bullets: [], coins: [], items: [], enemies: [], marks: [],
    camX: 0, camY: 8, shakeT: 0, shakeM: 0, flashT: 0, flashC: '#fff', hitstop: 0, bass: 0, onset: 0, beat: 0, beatPos: 0, phase: 0, lastBeat: -1 };
  NV.G = G;
  G.sfx = (n) => A.sfx(n);
  // con "destellos y temblor" apagado (opciones) no hay sacudidas de cámara ni flashes de pantalla
  G.shake = (m) => { if (!NV.OPT.fx) return; G.shakeM = Math.max(G.shakeM, m); G.shakeT = 12; };
  G.flash = (c, t = 8) => { if (!NV.OPT.fx) return; G.flashC = c; G.flashT = t; };
  // vibración en celulares (Android; iPhone lo ignora)
  G.vib = (ms) => { if (NV.OPT.vib && IN.isTouch && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };
  G.banner = null;
  G.say = (s, o = {}) => { G.banner = Object.assign({ s, t: 0, life: o.life || 110 }, o); };

  const FADE = 10; // cuadros del fundido desde negro al cambiar de pantalla
  G.go = function (s) {
    const prev = NV.Screens[G.state]; if (prev && prev.leave) prev.leave(G);
    G.state = s; IN.clear(); G.mi = 0; IN.touchOn = false; G.fadeT = FADE;
    const sc = NV.Screens[s]; if (sc && sc.enter) sc.enter(G);
    document.body.classList.toggle('in-register', s === 'register');
  };

  // ---------------- PARTIDA ----------------
  G.startRun = function (hero) {
    const prof = NV.DB.profile(); if (!prof) { G.go('register'); return; }
    if (NV.Screens[G.state] && NV.Screens[G.state].leave) NV.Screens[G.state].leave(G);
    G.heroKey = hero; G.profile = prof;
    G.L = NV.buildLevel();
    G.enemies = G.L.enemies.map((d) => NV.Enemy(d));
    G.coins = G.L.coins.map((c) => NV.Coin(c.x, c.y, false));
    G.items = G.L.items.map((i) => NV.Item(i.type, i.x, i.y));
    G.bullets = []; G.parts = []; G.booms = []; G.texts = []; G.marks = [];
    G.cp = 0; G.runTime = 0; G.running = false; G.finished = false; G.finishT = 0;
    G.coinsGot = 0; G.score = 0; G.kills = 0; G.deaths = 0; G.splits = [];
    G.bossOn = false; G.boss = null; G.banner = null; G.paused = false; G.vsT = 0; G.hype = 0; G.gIdx = 0; G.gDelta = null; G.coinPop = 0; G.hpLost = 0; G.tip = (G.tip || Math.floor(Math.random() * 9)) + 1;
    const c0 = G.L.checkpoints[0];
    G.player = NV.Player(hero, c0.x, c0.y);
    G.ghostRec = []; G.ghost = NV.DB.ghost();
    G.camX = 0; G.state = 'play'; G.fadeT = FADE; IN.clear(); IN.touchOn = true; document.body.classList.remove('in-register');
    // la canción del personaje arranca desde el principio; cuenta regresiva de 4 beats
    A.play(hero, 0);
    G.countBeat = null; G.count = 0;
    G.token = null; G.tokenP = NV.DB.startRun(prof, hero); G.tokenP.then((t) => { G.token = t; });
    if (params.get('boss')) { G.cp = 3; G.respawnAt(G.L.checkpoints[3]); }
  };

  G.respawnAt = function (c) {
    const p = NV.Player(G.heroKey, c.x, c.y); p.invuln = 90; G.player = p;
    G.bullets = [];
  };
  G.respawn = function () {
    if (G.bossOn) { const A0 = G.L.arena; G.respawnAt({ x: A0.x0 + 48, y: A0.floorY }); }
    else G.respawnAt(G.L.checkpoints[G.cp]);
    G.flash('#ffffff', 6);
    FX.text(G, '¡DE NUEVO!', G.player.x + 7, G.player.y - 10, G.player.hero.light);
  };
  G.pitFall = function () {
    const p = G.player;
    p.hp -= 1; G.sfx('hurt'); G.shake(4);
    if (p.hp <= 0) { p.y = G.L.h * 16; NV.killPlayer(p, G); p.y = p.safe.y - p.h; p.x = p.safe.x - 7; return; }
    p.x = p.safe.x - 7; p.y = p.safe.y - p.h - 2; p.vx = p.vy = 0; p.invuln = 70; p.dash = 0;
    FX.burst(G, p.x + 7, p.y + 17, p.hero.color, 12, 2, 20, 0, 2);
  };

  G.getCoin = function (x, y) {
    G.coinsGot++; G.score += C.COIN_PTS; G.sfx('coin'); G.coinPop = 8;
    FX.part(G, { x, y, vx: 0, vy: -0.6, color: '#fff3c4', life: 8, max: 8, size: 3 });
  };
  G.getItem = function (it) {
    const p = G.player;
    if (it.type === 'mega') { for (let i = 0; i < 10; i++) G.coins.push(NV.Coin(it.x, it.y, true)); G.score += 1000; G.sfx('mega'); FX.text(G, 'MEGA B-COIN +1000', it.x, it.y - 14, '#f5c542', 1, 60); G.flash('#f5c542', 6); }
    if (it.type === 'shield') { p.shield = C.SHIELD_TIME; G.sfx('shield'); G.say('¡ESCUDO!', { sub: 'SOS INMUNE: TOCÁ ENEMIGOS PARA ROMPERLOS', life: 90, color: '#f5c542' }); }
    if (it.type === 'heart') { p.hp = Math.min(C.HP, p.hp + 2); G.sfx('heal'); FX.text(G, '+2 ♥', it.x, it.y - 14, '#ff2e4a', 1, 50); }
  };

  G.onBossKilled = function () {
    G.finished = true; G.running = false; G.finishT = 0;
    const time = Math.round(G.runTime * 1000) / 1000;
    const prevBest = NV.DB.best(); const better = !prevBest || time < prevBest;
    const medal = C.MEDALS.find((m) => time < m[1]);
    // el récord personal (y su ghost) se guarda solo si la partida es válida para el ranking
    const savePb = () => { NV.DB.setBest(time); NV.DB.setSplits(G.splits); NV.DB.setGhost({ hero: G.heroKey, f: G.ghostRec }); G.result.pb = true; G.hype = 400; };
    G.result = { hero: G.heroKey, time, coins: G.coinsGot, deaths: G.deaths, score: G.score, pb: false, prevBest, medal };
    G.say('¡NAVIDANCE SALVADA!', { scale: 3, life: 220, sub: U.fmtTime(time), subColor: '#ffffff' });
    G.sfx('win');
    G.submit = null;
    NV.DB.submit({ name: G.profile.name, ig: G.profile.ig, playerId: G.profile.id, hero: G.heroKey, timeMs: Math.round(time * 1000), coins: G.coinsGot, deaths: G.deaths, token: G.token })
      .then((r) => { G.submit = r; if (better && !r.error) savePb(); });
  };

  // ---------------- ACTUALIZACIÓN ----------------
  function updateMusic() {
    G.beatPos = A.beatPos(); const b = Math.floor(G.beatPos);
    G.beatTick = b !== G.lastBeat; G.lastBeat = b; G.beat = b; G.phase = G.beatPos - b;
    G.bass = U.lerp(G.bass, A.level('bass'), 0.35); G.onset = U.lerp(G.onset, A.level('onset'), 0.5);
  }

  function updatePlay() {
    const p = G.player, L = G.L;
    if (G.paused) return;
    if (IN.pressed('pause')) { G.paused = true; G.mi = 0; A.pause(); IN.clear(); return; }
    if (G.pauseTap) { G.pauseTap = false; G.paused = true; G.mi = 0; A.pause(); IN.clear(); return; }
    // reinicio instantáneo (R / Select): clave en una carrera contra el reloj
    if (IN.pressed('restart') && !G.finished) { G.startRun(G.heroKey); return; }

    // cuenta regresiva sincronizada con la canción
    if (!G.running && !G.finished) {
      if (G.countBeat === null && G.beatTick) G.countBeat = G.beat;
      if (G.countBeat !== null) {
        const n = 4 - (G.beat - G.countBeat);
        if (G.beatTick) { if (n > 0) { G.sfx('beep'); G.say(String(n), { scale: 6, life: 26, color: p.hero.light }); } else { G.sfx('go'); G.running = true; G.t0 = performance.now();
          // el servidor anota la largada: el tiempo final tiene que coincidir con su reloj
          const pid = G.profile.id; G.tokenP.then((t) => NV.DB.go(t, pid)); G.say('¡YA!', { scale: 6, life: 40, color: '#f5c542', sub: 'LLEGÁ AL GRINCH Y VENCELO', subColor: '#ffffff' }); } }
      }
    }
    if (G.running) {
      // reloj real: sigue corriendo en pausa o si el celular se traba (igual que el del servidor)
      G.runTime = (performance.now() - G.t0) / 1000;
      if (G.runTime >= C.TIME_LIMIT) { G.running = false; G.sfx('timeout'); G.heroKeyLast = G.heroKey; G.go('timeout'); return; }
    }
    if (G.finished) { G.finishT++; if (G.finishT > 240) { G.go('results'); return; } }
    if (G.banner) { G.banner.t++; if (--G.banner.life <= 0) G.banner = null; }
    if (G.vsT) {
      if (++G.vsT === 18) { G.sfx('slam'); G.shake(6); G.vib(60); }
      if (G.vsT === 100) G.say('¡CYBER-GRINCH!', { scale: 3, life: 100, color: '#7cff4d', sub: 'ESQUIVÁ LOS LÁSERES DE SUS LENTES' });
      if (G.vsT > 112) G.vsT = 0;
    }

    if (G.hitstop > 0) { G.hitstop--; return; }

    NV.updatePlayer(p, G, !G.running && !G.finished);
    // grabar el recorrido para el ghost (30 muestras por segundo; 0 = muerto/invisible)
    if (G.running) for (const gi = Math.floor(G.runTime * 30); G.ghostRec.length <= gi;) G.ghostRec.push(p.dead ? 0 : [Math.round(p.x), Math.round(p.y), p.anim, p.frame, p.dir]);
    // diferencia contra el ghost: cuándo pasó tu récord por donde estás ahora (- = vas adelante)
    if (G.running && G.ghost && !G.bossOn) {
      const f = G.ghost.f; G.gIdx = G.gIdx || 0;
      while (G.gIdx < f.length && (f[G.gIdx] === 0 || f[G.gIdx][0] < p.x)) G.gIdx++;
      if (G.gIdx < f.length && p.x > 120) G.gDelta = G.runTime - G.gIdx / 30;
    }

    // checkpoints (con tiempo parcial vs tu mejor)
    for (let i = G.cp + 1; i < L.checkpoints.length; i++) {
      const c = L.checkpoints[i];
      if (p.x > c.x && !p.dead) {
        G.cp = i; G.splits[i] = G.runTime; G.sfx('checkpoint');
        const pbS = NV.DB.splits()[i]; let sub = U.fmtTime(G.runTime), sc = '#ffffff';
        if (pbS) { const d = G.runTime - pbS; sub += '  ' + (d < 0 ? '-' : '+') + Math.abs(d).toFixed(2); sc = d < 0 ? '#33e07a' : '#ff2e4a'; }
        G.say(c.label, { sub, subColor: sc, life: 100 }); G.hype = 50;
      }
    }
    // entrada a la arena del jefe
    const Ar = L.arena;
    if (!G.bossOn && p.x > Ar.x0 + 40) {
      G.bossOn = true;
      for (let y = 0; y < NV.GR; y++) L.t[y * L.w + Ar.gateX] = T.GATE;
      G.boss = NV.Boss(Ar); G.enemies = [];
      G.sfx('roar'); G.shake(8);
      G.vsT = 1; // presentación VS (dura menos que lo que tarda el jefe en despertarse)
      G.bossWake = G.beat + 4 - (G.beat & 3) + 4; // se activa 2 compases después
    }
    if (G.boss && !G.boss.active && !G.boss.dead && G.beat >= G.bossWake) { G.boss.active = true; G.boss.startBeat = G.beat; }

    for (const e of G.enemies) if (Math.abs(e.x - p.x) < X.W * 1.2) NV.updateEnemy(e, G);
    G.enemies = G.enemies.filter((e) => !e.dead);
    if (G.boss) NV.updateBoss(G.boss, G);
    updateBullets();
    for (const c of G.coins) NV.updateCoin(c, G); G.coins = G.coins.filter((c) => !c.dead);
    for (const it of G.items) NV.updateItem(it, G); G.items = G.items.filter((i) => !i.dead);
    for (const m of G.marks) m.life--; G.marks = G.marks.filter((m) => m.life > 0);
    FX.update(G);
    updateCamera();
  }

  function updateCamera() {
    const p = G.player, L = G.L, W = X.W, Ar = L.arena;
    let target = p.x + 7 - W * 0.38 + p.dir * 30;
    let min = 0, max = Ar.x1 - W;
    if (G.bossOn) {
      if (W >= Ar.x1 - Ar.x0) { target = (Ar.x0 + Ar.x1) / 2 - W / 2; min = max = target; }
      else { min = Ar.x0; max = Ar.x1 - W; }
    }
    G.camX = U.clamp(U.lerp(G.camX, target, 0.12), min, max);
    if (G.shakeT > 0 && --G.shakeT === 0) G.shakeM = 0;
  }

  function hitRect(b, r) { const cx = U.clamp(b.x, r.x, r.x + r.w), cy = U.clamp(b.y, r.y, r.y + r.h); return (b.x - cx) ** 2 + (b.y - cy) ** 2 < b.r * b.r; }

  function updateBullets() {
    const p = G.player, L = G.L;
    for (const b of G.bullets) {
      b.t++; b.vy += b.g || 0; b.x += b.vx; b.y += b.vy;
      if (--b.life <= 0) { b.dead = true; if (b.bomb) explode(b); continue; }
      if (b.mine) {
        if (NV.Phys.solidAt(L, b.x, b.y)) { b.dead = true; FX.burst(G, b.x, b.y, '#ffffff', 3, 1, 8, 0, 1); continue; }
        for (const e of G.enemies) if (!e.dead && hitRect(b, e)) { NV.damageEnemy(e, G, b.dmg); b.dead = true; FX.burst(G, b.x, b.y, p.hero.light, 4, 1.4, 10, 0, 1); break; }
        if (!b.dead && G.boss && G.boss.active && !G.boss.dead && hitRect(b, NV.bossBox(G.boss))) { NV.damageBoss(G.boss, G, b.dmg); b.dead = true; FX.burst(G, b.x, b.y, '#ffd23d', 4, 1.4, 10, 0, 1); }
        continue;
      }
      // proyectiles enemigos
      if (b.wave) { if (b.x < L.arena.x0 + 4) b.dead = true; }
      else if (b.bomb) {
        const floorHit = b.rain ? b.y >= L.arena.floorY - 4 : (b.vy > 0 && NV.Phys.groundAt(L, b.x, b.y + 4));
        if (floorHit) { explode(b); continue; }
      } else if (NV.Phys.solidAt(L, b.x, b.y)) { b.dead = true; continue; }
      if (!p.dead && hitRect(b, NV.playerBox(p))) {
        if (b.bomb) { explode(b); continue; }
        if (NV.hurtPlayer(p, G, b.x) || p.shield > 0) { b.dead = true; if (p.shield > 0) FX.burst(G, b.x, b.y, '#f5c542', 5, 1.5, 10, 0, 1); }
      }
    }
    G.bullets = G.bullets.filter((b) => !b.dead);
  }
  function explode(b) {
    b.dead = true; G.sfx('kill'); FX.boom(G, b.x, b.y - 4);
    FX.burst(G, b.x, b.y, b.green ? '#33e07a' : '#ff2e4a', 8, 2, 16, 0.1, 2);
    const p = G.player; if (!p.dead && U.dist(b.x, b.y, p.x + 7, p.y + 20) < 22) NV.hurtPlayer(p, G, b.x);
  }

  // ---------------- DIBUJO ----------------
  function drawPlay(ctx) {
    const L = G.L, W = X.W;
    const sx = G.shakeT > 0 ? Math.round((Math.random() - 0.5) * G.shakeM) : 0, sy = G.shakeT > 0 ? Math.round((Math.random() - 0.5) * G.shakeM) : 0;
    const cx = Math.round(G.camX) + sx, cy = G.camY + sy;
    NV.Stage.drawBack(ctx, G, cx);
    NV.Stage.drawTint(ctx, G);
    NV.Stage.drawLights(ctx, G, cx);
    NV.Stage.drawTruss(ctx, G, cx);
    NV.Stage.drawDeco(ctx, G, cx, cy);
    NV.Stage.drawTiles(ctx, L, cx, cy);
    // balizas de checkpoint y puerta
    L.checkpoints.forEach((c, i) => { if (i > 0) X.spr('beacon', i <= G.cp ? 1 : 0, c.x - cx, c.y - cy); });
    const dx = L.bossDoor - cx; if (dx > -50 && dx < W + 10 && !G.bossOn) { ctx.drawImage(X.img.deco_door, Math.round(dx), NV.GR * 16 - 96 - cy); X.text('JEFE', dx + 20, NV.GR * 16 - 110 - cy, { align: 'center', color: (G.frame >> 4) % 2 ? '#ff2e4a' : '#ff9aa8', outline: true }); }
    for (const m of G.marks) { if ((m.life >> 2) % 2) X.rect(m.x - 10 - cx, L.arena.floorY - 3 - cy, 20, 3, '#ff2e4a'); }
    for (const it of G.items) NV.drawItem(it, cx, cy, G);
    for (const c of G.coins) NV.drawCoin(c, cx, cy, G.frame);
    for (const e of G.enemies) if (e.x - cx > -40 && e.x - cx < W + 40) NV.drawEnemy(e, cx, cy);
    if (G.boss) NV.drawBoss(ctx, G.boss, G, cx, cy);
    // ghost de tu mejor partida: silueta blanca translúcida
    const gs = G.ghost && (G.running || G.finished) && G.ghost.f[Math.floor(G.runTime * 30)];
    if (gs) X.hero(G.ghost.hero, gs[2], gs[3], gs[0] + 7 - cx, gs[1] + G.player.h - cy, gs[4] < 0, true, 0.3);
    NV.drawPlayer(ctx, G.player, G, cx, cy);
    for (const b of G.bullets) {
      if (b.kind === 'ornament') X.spr('ornament', (b.green ? 2 : 0) + ((G.frame >> 3) & 1), b.x - cx, b.y - cy + 6);
      else if (b.kind === 'wave') X.spr('wave', (G.frame >> 3) & 1, b.x - cx, b.y - cy + 8);
      else X.spr(b.kind, (b.t >> 2) & 1, b.x - cx, b.y - cy + (b.kind === 'elaser' ? 2 : 4), { flip: b.vx < 0 });
    }
    FX.draw(ctx, G, cx, cy);
    NV.Stage.drawCrowd(ctx, G, cx);
    NV.Stage.drawSnow(ctx, cx);
    FX.drawTexts(G, cx, cy);
    if (G.flashT > 0) { ctx.globalAlpha = G.flashT / 18; ctx.fillStyle = G.flashC; ctx.fillRect(0, 0, W, 360); ctx.globalAlpha = 1; G.flashT--; }
    NV.HUD.draw(ctx, G);
    // controles durante la cuenta regresiva (en celular los botones ya tienen nombre)
    if (!G.running && !G.finished) {
      if (!IN.isTouch) { X.rect(W / 2 - 170, 216, 340, 18, 'rgba(5,4,12,.8)'); X.text('◀ ▶ MOVER · Z SALTAR · X DISPARAR · C DASH · R REINICIAR', W / 2, 221, { align: 'center', color: '#ffffff' }); }
      const tip = 'TIP: ' + TIPS[G.tip % TIPS.length];
      X.rect(W / 2 - X.measure(tip) / 2 - 6, 238, X.measure(tip) + 12, 16, 'rgba(5,4,12,.8)');
      X.text(tip, W / 2, 242, { align: 'center', color: '#f5c542' });
    }
    if (IN.isTouch && !G.paused) { const r = X.button('II', W - 20, 64, 26, 20, { scale: 1 }); if (IN.inRect(G.tapThisFrame, r)) G.pauseTap = true; }
    if (G.vsT) drawVS(ctx);
    if (G.paused) NV.Screens.pause(ctx, G);
  }

  // Un consejo distinto en cada cuenta regresiva
  const TIPS = [
    'MANTENÉ SALTO PARA SALTAR MÁS ALTO',
    'PISÁ ENEMIGOS: REBOTÁS Y NO PERDÉS VELOCIDAD',
    'EL DASH TAMBIÉN FUNCIONA EN EL AIRE',
    'DASH + SALTO = SALTO LARGO Y RÁPIDO',
    'CUANDO EL NÚCLEO DEL GRINCH BRILLA, RECIBE DOBLE DAÑO',
    'HAY 2 MEGA B-COINS ESCONDIDAS EN EL NIVEL',
    'CON EL ESCUDO DORADO ROMPÉS ENEMIGOS AL TOCARLOS',
    'LA SILUETA BLANCA ES TU MEJOR PARTIDA: ¡GANALE!',
    'EL JEFE ATACA AL RITMO: ESCUCHÁ LA CANCIÓN',
  ];

  // Presentación del jefe: tu DJ entra por la izquierda, el Grinch por la derecha, "VS" en el medio
  function drawVS(ctx) {
    const W = X.W, t = G.vsT, h = G.player.hero;
    const ease = (v) => 1 - Math.pow(1 - U.clamp(v, 0, 1), 3);
    const inn = ease(t / 16), out = U.clamp((t - 96) / 16, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.7 * (1 - out); X.rect(0, 0, W, 360, '#05040a'); ctx.restore();
    const slide = (1 - inn) * W * 0.6 + out * W * 0.6, sk = 40; // desplazamiento y diagonal
    const band = (x0, x1, col, img, ix, iw, ih, flip) => {
      ctx.save(); ctx.beginPath(); ctx.moveTo(x0 + sk, 70); ctx.lineTo(x1 + sk, 70); ctx.lineTo(x1 - sk, 290); ctx.lineTo(x0 - sk, 290); ctx.closePath(); ctx.clip();
      ctx.fillStyle = col; ctx.fillRect(x0 - sk, 70, x1 - x0 + sk * 2, 220);
      if (flip) { ctx.translate(ix + iw, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 76, iw, ih); } else ctx.drawImage(img, ix, 76, iw, ih);
      ctx.restore();
      X.rect(x0 - sk, 288, x1 - x0 + sk, 3, '#ffffff');
    };
    const lx = -slide, rx = slide;
    band(lx - 20, lx + W / 2 - 12, h.dark, X.img[G.heroKey + '_portrait'], lx + W / 2 - 230, 210, 210, false);
    band(rx + W / 2 + 12, rx + W + 60, '#0e3a12', X.img.grinch_card, rx + W / 2 + 30, 220, 212, false);
    X.text(h.name, lx + 30, 296, { scale: 2, color: h.light, outline: true });
    X.text('CYBER-GRINCH', rx + W - 30, 296, { scale: 2, align: 'right', color: '#7cff4d', outline: true });
    if (t > 14 && out < 1) {
      const pop = Math.max(1, 2.2 - (t - 14) * 0.15);
      ctx.save(); ctx.translate(W / 2, 168); ctx.scale(pop, pop); ctx.globalAlpha = 1 - out;
      X.text('VS', 0, -18, { scale: 6, align: 'center', color: (t >> 2) % 2 ? '#f5c542' : '#ffffff', outline: true });
      ctx.restore();
    }
  }
  G.unpause = function () { G.paused = false; A.resume(); IN.clear(); };

  // ---------------- LOOP ----------------
  const BOT = params.get('bot');
  function bot() {
    const f = G.frame, b = IN.bot;
    b.right = true; b.shoot = true; b.jump = f % 50 < 18; b.dash = f % 140 < 10;
    if (G.state !== 'play') b.confirm = f % 30 < 2;
  }
  function update() {
    if (BOT) bot();
    IN.update();
    updateMusic();
    if (G.hype > 0) G.hype--; // euforia del público (checkpoint, jefe vencido, récord)
    if (G.state === 'play') updatePlay();
    G.frame++;
  }
  function draw() {
    const ctx = X.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    G.tapThisFrame = IN.tap();
    if (G.state === 'boot') {
      // pantalla de carga: barra roja de la marca + B-Coin girando
      const pr = X.loaded / Math.max(1, X.total), bw = 180, bx = X.W / 2 - bw / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, X.W, 360);
      X.text('CARGANDO', X.W / 2, 158, { align: 'center', color: '#5d6a8a', shadow: false });
      X.rect(bx, 174, bw, 2, '#1a1e30'); X.rect(bx, 174, Math.round(bw * pr), 2, '#ff2e4a');
      X.text(Math.round(pr * 100) + '%', X.W / 2, 184, { align: 'center', color: '#3a4466', shadow: false });
    } else if (G.state === 'play') drawPlay(ctx);
    else if (NV.Screens[G.state]) NV.Screens[G.state].draw(ctx, G);
    if (G.fadeT > 0) { ctx.fillStyle = 'rgba(7,6,11,' + G.fadeT / FADE + ')'; ctx.fillRect(0, 0, X.W, 360); G.fadeT--; }
    if (G.err && (BOT || params.has('debug'))) { X.rect(0, 0, X.W, 12, '#000'); X.text(G.err, 2, 2, { color: '#ff2e4a' }); }
    X.present();
  }
  window.addEventListener('error', (e) => { G.err = (e.message || 'error') + ' ' + (e.filename || '').split('/').pop() + ':' + e.lineno; });

  let last = performance.now(), acc = 0;
  function loop(now) {
    requestAnimationFrame(loop); // primero: si un cuadro tira error, el juego no queda congelado
    acc += Math.min(100, now - last); last = now;
    let n = 0; while (acc >= 1000 / 60 && n < 4) { update(); acc -= 1000 / 60; n++; }
    draw();
  }

  // ---------------- REGISTRO (formulario) ----------------
  function setupRegister() {
    const go = document.getElementById('regGo');
    const submit = () => {
      const name = document.getElementById('regName').value.trim().replace(/\s+/g, ' ');
      let ig = document.getElementById('regIg').value.trim().replace(/^@+/, '').toLowerCase();
      const ok = document.getElementById('regOk').checked;
      const err = document.getElementById('regErr');
      if (name.length < 2) { err.textContent = 'Poné tu nombre'; return; }
      if (!/^[a-z0-9._]{1,30}$/.test(ig)) { err.textContent = 'Usuario de Instagram inválido'; return; }
      if (!ok) { err.textContent = 'Tenés que aceptar para competir'; return; }
      NV.DB.saveProfile(name.slice(0, 16), ig);
      A.unlock(); A.sfx('select');
      G.go('select');
      if (IN.isTouch && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    };
    go.addEventListener('click', submit);
    document.getElementById('regIg').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    document.getElementById('regName').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('regIg').focus(); });
    document.getElementById('regBack').addEventListener('click', () => G.go('title'));
  }

  // ---------------- ARRANQUE ----------------
  X.resize(); window.addEventListener('resize', X.resize);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && document.activeElement.tagName !== 'INPUT') A.toggleMute(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G.state === 'play' && G.running && !G.paused) { G.paused = true; G.mi = 0; } A.pause(); } else if (G.state !== 'play' || !G.paused) A.resume(); });
  IN.setup(X.disp);
  NV.Stage.init();
  setupRegister();
  requestAnimationFrame(loop);
  NV.DB.init();
  // primer toque: desbloquea el audio y arranca una canción de fondo en el menú
  // (la música del menú arranca al entrar al título, después del splash)
  const firstTouch = () => { A.unlock(); window.removeEventListener('pointerdown', firstTouch); window.removeEventListener('keydown', firstTouch); };
  window.addEventListener('pointerdown', firstTouch); window.addEventListener('keydown', firstTouch);
  X.load(() => {
    const h = params.get('hero');
    if (h && NV.HEROES[h]) { if (!NV.DB.profile()) NV.DB.saveProfile('TEST', 'test'); G.startRun(h); }
    else G.go('gate');
  });
})();
