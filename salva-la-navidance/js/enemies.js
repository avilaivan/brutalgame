// =====================================================================
//  ENEMIGOS 8-bit (siempre en el mismo lugar) — todos se mueven al ritmo
//  de la canción del personaje. Se eliminan con 2 disparos o pisándolos.
// =====================================================================
(function () {
  const U = NV.U, C = NV.CFG, FX = NV.FX;
  const SIZE = { patovica: [22, 30], regalo: [16, 40], esfera: [20, 20], duende: [16, 26] };
  const HP = { patovica: 2, regalo: 3, esfera: 1, duende: 2 };

  NV.Enemy = function (d) {
    const [w, h] = SIZE[d.type];
    return { type: d.type, w, h, x: d.x - w / 2, y: d.y - h, vx: 0, vy: 0, dir: -1, hp: HP[d.type], flash: 0, dead: false, t: 0,
      patrol: d.patrol, home: { x: d.x - w / 2, y: d.y - h }, frame: 0, shootT: 0, onGround: false };
  };

  NV.updateEnemy = function (e, G) {
    const p = G.player, L = G.L;
    e.t++; if (e.flash > 0) e.flash--;
    const pcx = p.x + 7, ecx = e.x + e.w / 2, dx = pcx - ecx, dy = (p.y + 17) - (e.y + e.h / 2);
    const near = Math.abs(dx) < NV.X.W * 0.6;
    switch (e.type) {
      case 'patovica':
        if (e.patrol) { e.vx = e.dir * 0.6; if (e.x < e.patrol[0]) e.dir = 1; if (e.x + e.w > e.patrol[1]) e.dir = -1; }
        if (G.beatTick && e.onGround) e.vy = -1.8;           // salta en cada beat
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL);
        NV.Phys.move(e, L); if (e.hitL) e.dir = 1; if (e.hitR) e.dir = -1;
        e.frame = (e.t >> 3) & 1; break;
      case 'regalo':
        e.dir = dx > 0 ? 1 : -1;
        if (G.beatTick && near && Math.abs(dy) < 140) {
          const b = G.beat & 3;
          if (b === 3) e.shootT = -1; // apunta
          if (b === 0) { e.shootT = 10; G.bullets.push({ x: ecx + e.dir * 14, y: e.y + 21, vx: e.dir * 2.6, vy: 0, r: 2, life: 220, kind: 'elaser', dmg: 1, t: 0 }); }
        }
        if (e.shootT > 0) e.shootT--;
        e.frame = e.shootT > 0 ? 3 : e.shootT < 0 ? 2 : (G.beat & 1);
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL); NV.Phys.move(e, L); break;
      case 'esfera': {
        const bp = G.beatPos;
        const range = e.patrol ? (e.patrol[1] - e.patrol[0]) / 2 : 40;
        const mid = e.patrol ? (e.patrol[0] + e.patrol[1]) / 2 - e.w / 2 : e.home.x;
        const nx = mid + Math.sin((bp * Math.PI) / 4) * range;
        e.dir = nx > e.x ? 1 : -1; e.x = nx; e.y = e.home.y + Math.sin(bp * Math.PI) * 6;
        e.frame = (e.t >> 3) % 3; break;
      }
      case 'duende':
        e.dir = dx > 0 ? 1 : -1;
        if (G.beatTick && e.onGround && (G.beat & 1) === 0) e.vy = -3.4;
        if (G.beatTick && near && (G.beat & 3) === 1) {
          G.bullets.push({ x: ecx, y: e.y + 2, vx: U.clamp(dx / 52, -2.6, 2.6), vy: -4.2, g: 0.17, r: 4, life: 200, kind: 'ornament', dmg: 1, bomb: true, green: (G.beat & 4) > 0, t: 0 });
          e.throwT = 12;
        }
        if (e.throwT > 0) e.throwT--;
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL); NV.Phys.move(e, L);
        e.frame = e.throwT > 0 ? 1 : e.onGround ? 0 : 2; break;
    }

    // ---- contacto con el jugador: pisotón o daño ----
    // al caer, la caja para pisar es más ancha (el sprite es más ancho que el cuerpo): pisar se siente justo
    const pb = NV.playerBox(p), stompBox = { x: pb.x - 5, y: pb.y, w: pb.w + 10, h: pb.h + 2 };
    const falling = p.vy > 0.4;
    if (!p.dead && U.overlap(e, falling ? stompBox : pb)) {
      const feetPrev = p.y + p.h - p.vy;
      if (p.shield > 0) { NV.killEnemy(e, G, 'shield'); }
      else if (falling && feetPrev <= e.y + 10) {
        p.vy = NV.Input.held.jump ? C.STOMP_BOUNCE_HELD : C.STOMP_BOUNCE; p.airDashUsed = false; p.dashJump = false;
        p.chain++; NV.killEnemy(e, G, 'stomp');
      } else NV.hurtPlayer(p, G, ecx);
    }
  };

  NV.damageEnemy = function (e, G, dmg) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 5; G.sfx('hit');
    // chispas del impacto + pequeño retroceso
    const hx = e.x + e.w / 2 - Math.sign(e.x + e.w / 2 - G.player.x - 7) * e.w / 2;
    FX.burst(G, hx, e.y + e.h / 2, '#ffffff', 5, 1.8, 10, 0, 1); FX.burst(G, hx, e.y + e.h / 2, G.player.hero.light, 4, 1.2, 12, 0, 2);
    if (e.type !== 'esfera') e.x += Math.sign(e.x + e.w / 2 - G.player.x - 7) * 2;
    if (e.hp <= 0) NV.killEnemy(e, G, 'shot');
  };
  const XMAS = ['#ff2e4a', '#33e07a', '#f5c542', '#ffffff', '#4de2ff'];
  NV.killEnemy = function (e, G, how) {
    if (e.dead) return;
    e.dead = true; const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    G.sfx(how === 'stomp' ? 'stomp' : 'kill'); G.shake(how === 'stomp' ? 3 : 2); G.hitstop = 3; G.vib(how === 'stomp' ? 18 : 10);
    FX.boom(G, cx, cy);
    // estallido navideño: nieve, estrellas doradas y papelitos de colores
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.6; FX.part(G, { x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 0.08, color: XMAS[i % XMAS.length], life: 26, max: 26, size: i % 3 ? 2 : 3 }); }
    FX.burst(G, cx, cy, '#f4f8ff', 8, 1.2, 30, -0.01, 1);
    // el enemigo sale volando y girando (en vez de desaparecer)
    G.corpses = G.corpses || [];
    G.corpses.push({ type: e.type, frame: e.frame, x: cx, y: cy, h: e.h, vx: Math.sign(cx - G.player.x - 7) * 1.8, vy: how === 'stomp' ? -2 : -4.2, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * 0.25, t: 0, flip: e.dir < 0 });
    const chain = G.player.chain || 1;
    const pts = how === 'stomp' ? C.STOMP_PTS * chain : C.KILL_PTS;
    G.score += pts; G.kills++; G.addCombo(cx, e.y);
    FX.text(G, how === 'stomp' ? (chain > 1 ? '¡PISOTÓN x' + chain + '!' : '¡PISOTÓN!') : '+' + pts, cx, e.y - 6, how === 'stomp' ? '#f5c542' : '#ffffff', 1);
    for (let i = 0; i < 2; i++) G.coins.push(NV.Coin(cx, cy, true));
  };

  // enemigos derrotados: giran y caen fuera de pantalla
  NV.updateCorpses = function (G) {
    if (!G.corpses) return;
    for (const c of G.corpses) { c.t++; c.x += c.vx; c.y += c.vy; c.vy += 0.3; c.rot += c.vr; }
    G.corpses = G.corpses.filter((c) => c.t < 70);
  };
  NV.drawCorpses = function (ctx, G, cx, cy) {
    if (!G.corpses) return;
    for (const c of G.corpses) {
      ctx.save(); ctx.translate(Math.round(c.x - cx), Math.round(c.y - cy)); ctx.rotate(c.rot); ctx.globalAlpha = Math.min(1, (70 - c.t) / 20);
      NV.X.spr(c.type, c.frame, 0, c.h / 2, { flip: c.flip, flash: c.t < 4 });
      ctx.restore();
    }
  };

  NV.drawEnemy = function (e, cx, cy) {
    NV.X.spr(e.type, e.frame, e.x + e.w / 2 - cx, e.y + e.h - cy + (e.type === 'esfera' ? 4 : 0) + (e.type === 'regalo' ? 2 : 0) + (e.type === 'patovica' ? 2 : 0) + (e.type === 'duende' ? 1 : 0), { flip: e.dir < 0, flash: e.flash > 0 });
  };

  // =====================================================================
  //  DON GRUÑÓN — jefe final (bicho verde que se robó los parlantes). Ataques al ritmo (1 por compás):
  //  LÁSER de sus anteojos (apunta y dispara), LLUVIA de bolas de Navidad, PISOTÓN con onda de nieve.
  // =====================================================================
  const GM = () => window.ART_DATA.sprites.grunon;
  NV.Boss = function (A) {
    return { cx: A.bossX, by: A.bossY, w: 100, h: 118, hp: 100, maxHp: 100, swatT: 0, swatCd: 0, stompCd: 0, phase: 1, active: false, dead: false, deathT: 0,
      frame: 0, flash: 0, atk: 'intro', bar: -1, startBeat: 0, aims: [], beams: 0, seq: 0, hurtT: 0 };
  };
  const box = (b) => ({ x: b.cx - b.w / 2, y: b.by - b.h, w: b.w, h: b.h });
  NV.bossBox = box;
  // donde termina un rayo: sigue la línea ojo -> objetivo hasta el piso o el borde izquierdo de la arena
  function beamEnd(L0, tx, ty, A) {
    const dx = tx - L0.x, dy = ty - L0.y; let t = 4;
    if (dy > 0.01) t = Math.min(t, (A.floorY - L0.y) / dy);
    if (dx < -0.01) t = Math.min(t, (A.x0 - L0.x) / dx);
    t = Math.max(1, t);
    return { x: L0.x + dx * t, y: L0.y + dy * t };
  }
  // primera superficie donde cae algo soltado desde arriba en x (piso o plataforma)
  function landY(L, x, A) { for (let y = 0; y < A.floorY; y += 4) if (NV.Phys.groundAt(L, x, y)) return Math.floor(y / 16) * 16; return A.floorY; }
  // ojos del cuadro actual (cada pose tiene los anteojos en otro lugar)
  function eyes(m, frame) { const f = m.lenses && m.lenses[frame]; return f ? [[f[0], f[1]], [f[2], f[3]]] : [m.lensL, m.lensR]; }
  function lens(b, which) { const m = GM(); const l = eyes(m, b.frame)[which ? 1 : 0]; return { x: b.cx - m.w / 2 + l[0], y: b.by - m.h + l[1] }; }

  NV.updateBoss = function (b, G) {
    const p = G.player, A = G.L.arena;
    if (b.flash > 0) b.flash--;
    if (b.dead) {
      b.deathT++; b.frame = 5;
      if (b.deathT % 7 === 0 && b.deathT < 110) { FX.boom(G, b.cx + U.rand(-50, 50), b.by - U.rand(10, 110)); G.sfx('kill'); G.shake(3); }
      if (b.deathT === 110) { G.sfx('big_boom'); G.shake(12); G.vib([80, 40, 200]); G.hype = 600; NV.Audio.sfx('cheer'); G.flash('#ffffff', 14); FX.boom(G, b.cx, b.by - 60, true); for (let i = 0; i < 40; i++) G.coins.push(NV.Coin(b.cx + U.rand(-30, 30), b.by - U.rand(30, 100), true, true)); }
      return;
    }
    if (!b.active) { b.frame = (G.beat & 1); return; }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) { b.phase = 2; b.blackT = 0; G.sfx('blackout'); G.shake(8); G.say('¡SE CORTÓ LA NAVIDAD!', { scale: 3, life: 90, color: '#ff2e4a', sub: 'SE APAGARON LAS LUCES · ATACA MÁS RÁPIDO' }); }
    if (b.phase === 2) b.blackT = (b.blackT || 0) + 1;

    // ---- elegir ataque al comienzo de cada compás ----
    if (G.beatTick) {
      const rel = G.beat - b.startBeat, inBar = ((rel % 4) + 4) % 4;
      if (inBar === 0) {
        const seq1 = ['laser', 'rain', 'volley', 'slam', 'laser', 'rest'], seq2 = ['laser', 'volley', 'slam', 'laser', 'rain', 'volley', 'laser', 'rest'];
        const s = b.phase === 1 ? seq1 : seq2; b.atk = s[b.seq++ % s.length]; b.inBar = 0;
      } else b.inBar = inBar;
      onBeat(b, G, b.inBar);
    }
    // ---- láser: apuntar y disparar ----
    if (b.atk === 'laser') {
      if (b.aimLive) {
        // apunta al CUERPO del jugador (antes apuntaba siempre al piso de la arena: en una plataforma el rayo pasaba por debajo)
        const tx = p.x + 7, ty = p.y + 17;
        b.aims = [beamEnd(lens(b, 0), tx, ty, A), beamEnd(lens(b, 1), tx + (p.vx || 0) * 22 + 22 * (p.dir || 1), ty, A)];
      }
      if (b.beams > 0) {
        b.beams--;
        for (let i = 0; i < 2; i++) {
          const L0 = lens(b, i), tg = b.aims[i];
          if (NV.U.segDist(p.x + 7, p.y + 17, L0.x, L0.y, tg.x, tg.y) < 9) NV.hurtPlayer(p, G, b.cx);
          if (G.frame % 2 === 0) FX.part(G, { x: tg.x + U.rand(-4, 4), y: tg.y - 1, vx: U.rand(-1.5, 1.5), vy: U.rand(-2.5, -0.5), g: 0.12, color: i ? '#33e07a' : '#ff2e4a', life: 18, max: 18 });
        }
      }
    }
    // frame
    b.frame = b.atk === 'laser' ? (b.beams > 0 ? 3 : b.aimLive ? 2 : 0) : (b.atk === 'slam' && b.inBar === 0) || b.atk === 'volley' ? 4 : b.phase === 2 ? 6 : (G.beat & 1);
    // contacto / pisotón en la cabeza
    const bb = box(b);
    if (b.stompCd > 0) b.stompCd--;
    if (!p.dead && U.overlap(bb, NV.playerBox(p))) {
      const feetPrev = p.y + p.h - p.vy;
      if (p.vy > 0.4 && feetPrev <= bb.y + 22 && b.stompCd === 0) {
        // pisotón: 2 de daño y te despide hacia atrás (no se puede rebotar sin parar sobre la cabeza)
        p.vy = C.STOMP_BOUNCE_HELD; p.x = Math.min(p.x, bb.x - p.w); p.vx = -3; b.stompCd = 50;
        NV.damageBoss(b, G, 2, true); G.sfx('stomp'); FX.text(G, '¡PISOTÓN!', p.x + 7, p.y - 6, '#f5c542');
      } else if (p.shield <= 0) { NV.hurtPlayer(p, G, b.cx); p.x = Math.min(p.x, bb.x - p.w - 2); }
    }
    // MANOTAZO: si te quedás pegado al jefe, levanta el brazo (aviso) y barre a los costados
    if (b.swatCd > 0) b.swatCd--;
    const near = Math.abs(p.x + 7 - b.cx) < 100 && p.y + p.h > b.by - 130 && !p.dead;
    if (near && b.swatT === 0 && b.swatCd === 0 && b.atk !== 'rest') { b.swatT = 26; G.sfx('laser_charge'); }
    if (b.swatT > 0) {
      b.swatT--; b.frame = 4;
      if (b.swatT === 6) {
        G.sfx('slam'); G.shake(6);
        const zone = { x: b.cx - 110, y: b.by - 100, w: 220, h: 100 };
        for (let i = 0; i < 16; i++) FX.part(G, { x: b.cx - 60 + U.rand(-50, 0), y: b.by - U.rand(0, 90), vx: U.rand(-3, -1), vy: U.rand(-1.5, 1.5), color: '#f4f8ff', life: 20, max: 20 });
        if (U.overlap(zone, NV.playerBox(p)) && p.shield <= 0 && NV.hurtPlayer(p, G, b.cx)) { p.vx = -4; p.vy = -4.5; }
        b.swatCd = 110;
      }
    }
  };

  function onBeat(b, G, inBar) {
    const p = G.player, A = G.L.arena;
    if (b.atk === 'laser') {
      const twice = b.phase === 2;
      if (inBar === 0 || (twice && inBar === 2)) { b.aimLive = true; G.sfx('laser_charge'); }
      if (inBar === 1 || (twice && inBar === 3)) { b.aimLive = false; b.beams = Math.round(NV.Audio.beatLen() * 60 * 0.7); G.sfx('laser'); G.shake(4); }
      if (!twice && inBar >= 2) { b.aimLive = false; }
    } else b.aimLive = false;
    if (b.atk === 'rain') {
      if (inBar === 0) G.sfx('roar');
      const n = b.phase === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const tx = U.clamp(p.x + 7 + (i ? U.rand(-90, 90) : U.rand(-20, 20)), A.x0 + 20, b.cx - 70);
        const fall = NV.Audio.beatLen() * 60; // llega justo en el próximo beat
        const land = landY(G.L, tx, A);
        G.bullets.push({ x: tx, y: -10, vx: 0, vy: (land + 10) / fall, r: 5, life: fall + 4, kind: 'ornament', dmg: 1, bomb: true, green: i === 1, rain: true, landY: land, t: 0 });
        G.marks.push({ x: tx, y: land, life: fall });
      }
    }
    if (b.atk === 'volley' && inBar >= 1) {
      // RÁFAGA: bastones de caramelo apuntados a donde estás (también a las plataformas)
      const n = b.phase === 2 ? 3 : 2, hx = b.cx + 50, hy = b.by - 96;
      const ang0 = Math.atan2(p.y + 17 - hy, p.x + 7 - hx);
      for (let i = 0; i < n; i++) {
        const a = ang0 + (i - (n - 1) / 2) * 0.16, sp = 3.6;
        G.bullets.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, life: 200, kind: 'elaser', dmg: 1, t: 0 });
      }
      G.sfx('shoot'); G.shake(2);
    }
    if (b.atk === 'slam') {
      if (inBar === 1 || (b.phase === 2 && inBar === 3)) {
        G.sfx('slam'); G.shake(10);
        G.bullets.push({ x: b.cx - 50, y: A.floorY - 7, vx: -3.1, vy: 0, r: 7, life: 240, kind: 'wave', dmg: 1, t: 0, wave: true });
        for (let i = 0; i < 12; i++) FX.part(G, { x: b.cx - 50 + U.rand(-10, 10), y: A.floorY - 60, vx: U.rand(-2, 1), vy: U.rand(-3, 0), g: 0.2, color: '#8fb0d6', life: 30, max: 30 });
      }
    }
  }

  NV.damageBoss = function (b, G, dmg, stomp) {
    if (b.dead || !b.active) return;
    const mult = b.atk === 'rest' ? 2 : 1;
    b.hp -= dmg * mult; b.flash = 4; if (!stomp) G.sfx('boss_hit');
    if (G.frame % 3 === 0 || stomp) FX.text(G, '-' + dmg * mult, b.cx + U.rand(-40, 20), b.by - U.rand(60, 110), mult > 1 ? '#f5c542' : '#ffffff', 1, 26);
    if (mult > 1 && G.frame % 6 === 0) FX.text(G, 'x2', b.cx + U.rand(-30, 30), b.by - 120, '#f5c542');
    if (b.hp <= 0) { b.hp = 0; b.dead = true; b.deathT = 0; G.sfx('roar'); G.onBossKilled(b); }
  };

  NV.drawBoss = function (ctx, b, G, cx, cy) {
    const X = NV.X;
    // láseres
    if (b.atk === 'laser' && !b.dead) {
      for (let i = 0; i < 2; i++) {
        const L0 = lens(b, i), tg = b.aims[i]; if (!tg) continue;
        const col = i ? '#33e07a' : '#ff2e4a', light = i ? '#c8ffd8' : '#ffd0d6';
        if (b.aimLive) { // línea de mira punteada
          ctx.fillStyle = col; const n = 40;
          for (let s = 0; s < n; s += 2) { const t = s / n; ctx.fillRect(Math.round(L0.x + (tg.x - L0.x) * t - cx), Math.round(L0.y + (tg.y - L0.y) * t - cy), 2, 2); }
          if ((G.frame >> 2) % 2) { X.rect(tg.x - 8 - cx, tg.y - 2 - cy, 16, 2, col); }
        }
        if (b.beams > 0) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          beam(ctx, L0.x - cx, L0.y - cy, tg.x - cx, tg.y - cy, 7, col, 0.5); beam(ctx, L0.x - cx, L0.y - cy, tg.x - cx, tg.y - cy, 3, light, 1);
          ctx.restore();
          X.rect(tg.x - 10 - cx, tg.y - 3 - cy, 20, 3, '#ffffff');
        }
      }
    }
    if (b.dead && b.deathT > 130) return;
    const glow = b.atk === 'rest' && !b.dead;
    X.spr('grunon', b.frame, b.cx - cx, b.by - cy, { flash: b.flash > 0 || (b.dead && (G.frame >> 1) % 2 && b.deathT < 110) });
    if (glow) { const m = GM(); ctx.save(); ctx.fillStyle = '#9dffbf'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.frame * 0.4); NV.Input.circ(ctx, b.cx - m.w / 2 + m.core[0] - cx, b.by - m.h + m.core[1] - cy, 7); ctx.restore(); }
    if (b.dead) return;
    // brillo de los ojos y arcos eléctricos entre los aisladores (más intensos en el apagón total)
    const m = GM(), ox = b.cx - m.w / 2 - cx, oy = b.by - m.h - cy;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    eyes(m, b.frame).forEach((l, i) => {
      const r = 14 + (b.aimLive ? 6 : 0) + (b.phase === 2 ? 4 : 0) + Math.sin(G.frame * 0.3) * 2;
      const g = ctx.createRadialGradient(ox + l[0], oy + l[1], 0, ox + l[0], oy + l[1], r);
      g.addColorStop(0, i ? 'rgba(51,224,122,.55)' : 'rgba(255,46,74,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(ox + l[0] - r, oy + l[1] - r, r * 2, r * 2);
    });
    if (G.frame % (b.phase === 2 ? 3 : 7) < 2) {
      ctx.strokeStyle = '#bff6ff'; ctx.lineWidth = 1; ctx.beginPath();
      let x = ox + 48, y = oy + 2; ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += 8; y = oy + 2 + U.rand(-6, 4); ctx.lineTo(Math.round(x), Math.round(y)); }
      ctx.stroke();
    }
    ctx.restore();
  };
  // SE CORTÓ LA NAVIDAD (fase 2): se apagan las luces; queda un círculo de luz alrededor del DJ
  // y los ojos del jefe. Oscurece solo el escenario: jefe, ataques y avisos se dibujan encima.
  NV.drawBlackout = function (ctx, G, cx, cy) {
    const b = G.boss; if (!b || b.phase !== 2 || b.dead) return;
    const p = G.player, W = NV.X.W, t = b.blackT || 0;
    if (t < 40 && (t >> 2) % 2) return; // parpadeo al cortarse la luz
    const px = p.x + 7 - cx, py = p.y + 16 - cy;
    const g = ctx.createRadialGradient(px, py, 30, px, py, 150);
    g.addColorStop(0, 'rgba(2,2,10,0)'); g.addColorStop(1, 'rgba(2,2,10,.82)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 360);
  };
  function beam(ctx, x0, y0, x1, y1, w, c, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(Math.round(x0), Math.round(y0)); ctx.lineTo(Math.round(x1), Math.round(y1)); ctx.stroke(); ctx.globalAlpha = 1;
  }
})();
