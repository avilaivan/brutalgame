// =====================================================================
//  ENEMIGOS 8-bit (siempre en el mismo lugar) — todos se mueven al ritmo
//  de la canción del personaje. Se eliminan con 2 disparos o pisándolos.
// =====================================================================
(function () {
  const U = NV.U, C = NV.CFG, FX = NV.FX;
  const SIZE = { snowman: [22, 30], nutcracker: [16, 40], skull: [20, 20], elf: [16, 26] };
  const HP = { snowman: 2, nutcracker: 3, skull: 1, elf: 2 };

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
      case 'snowman':
        if (e.patrol) { e.vx = e.dir * 0.6; if (e.x < e.patrol[0]) e.dir = 1; if (e.x + e.w > e.patrol[1]) e.dir = -1; }
        if (G.beatTick && e.onGround) e.vy = -1.8;           // salta en cada beat
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL);
        NV.Phys.move(e, L); if (e.hitL) e.dir = 1; if (e.hitR) e.dir = -1;
        e.frame = (e.t >> 3) & 1; break;
      case 'nutcracker':
        e.dir = dx > 0 ? 1 : -1;
        if (G.beatTick && near && Math.abs(dy) < 140) {
          const b = G.beat & 3;
          if (b === 3) e.shootT = -1; // apunta
          if (b === 0) { e.shootT = 10; G.bullets.push({ x: ecx + e.dir * 14, y: e.y + 21, vx: e.dir * 2.6, vy: 0, r: 2, life: 220, kind: 'elaser', dmg: 1, t: 0 }); }
        }
        if (e.shootT > 0) e.shootT--;
        e.frame = e.shootT > 0 ? 3 : e.shootT < 0 ? 2 : (G.beat & 1);
        e.vy = Math.min(e.vy + C.GRAVITY, C.MAX_FALL); NV.Phys.move(e, L); break;
      case 'skull': {
        const bp = G.beatPos;
        const range = e.patrol ? (e.patrol[1] - e.patrol[0]) / 2 : 40;
        const mid = e.patrol ? (e.patrol[0] + e.patrol[1]) / 2 - e.w / 2 : e.home.x;
        const nx = mid + Math.sin((bp * Math.PI) / 4) * range;
        e.dir = nx > e.x ? 1 : -1; e.x = nx; e.y = e.home.y + Math.sin(bp * Math.PI) * 6;
        e.frame = (e.t >> 3) % 3; break;
      }
      case 'elf':
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
    if (!p.dead && U.overlap(e, NV.playerBox(p))) {
      const feetPrev = p.y + p.h - p.vy;
      if (p.shield > 0) { NV.killEnemy(e, G, 'shield'); }
      else if (p.vy > 0.4 && feetPrev <= e.y + 8) {
        p.vy = NV.Input.held.jump ? C.STOMP_BOUNCE_HELD : C.STOMP_BOUNCE; p.airDashUsed = false; p.dashJump = false;
        p.chain++; NV.killEnemy(e, G, 'stomp');
      } else NV.hurtPlayer(p, G, ecx);
    }
  };

  NV.damageEnemy = function (e, G, dmg) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 5; G.sfx('hit');
    if (e.hp <= 0) NV.killEnemy(e, G, 'shot');
  };
  NV.killEnemy = function (e, G, how) {
    if (e.dead) return;
    e.dead = true; const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    G.sfx(how === 'stomp' ? 'stomp' : 'kill'); G.shake(how === 'stomp' ? 3 : 2); G.hitstop = 3; G.vib(how === 'stomp' ? 18 : 10);
    FX.boom(G, cx, cy); FX.burst(G, cx, cy, '#ffd23d', 10, 2.4, 20, 0.05, 2);
    const chain = G.player.chain || 1;
    const pts = how === 'stomp' ? C.STOMP_PTS * chain : C.KILL_PTS;
    G.score += pts; G.kills++;
    FX.text(G, how === 'stomp' ? (chain > 1 ? '¡PISOTÓN x' + chain + '!' : '¡PISOTÓN!') : '+' + pts, cx, e.y - 6, how === 'stomp' ? '#f5c542' : '#ffffff', 1);
    for (let i = 0; i < 2; i++) G.coins.push(NV.Coin(cx, cy, true));
  };

  NV.drawEnemy = function (e, cx, cy) {
    NV.X.spr(e.type, e.frame, e.x + e.w / 2 - cx, e.y + e.h - cy + (e.type === 'skull' ? 4 : 0) + (e.type === 'nutcracker' ? 2 : 0) + (e.type === 'snowman' ? 2 : 0) + (e.type === 'elf' ? 1 : 0), { flip: e.dir < 0, flash: e.flash > 0 });
  };

  // =====================================================================
  //  CYBER-GRINCH — jefe final. Ataques al ritmo (1 ataque por compás):
  //  LÁSER de sus lentes (apunta y dispara), LLUVIA de adornos, PISOTÓN con onda.
  // =====================================================================
  const GM = () => window.ART_DATA.sprites.grinch;
  NV.Boss = function (A) {
    return { cx: A.bossX, by: A.bossY, w: 84, h: 118, hp: 70, maxHp: 70, phase: 1, active: false, dead: false, deathT: 0,
      frame: 0, flash: 0, atk: 'intro', bar: -1, startBeat: 0, aims: [], beams: 0, seq: 0, hurtT: 0 };
  };
  const box = (b) => ({ x: b.cx - b.w / 2, y: b.by - b.h, w: b.w, h: b.h });
  NV.bossBox = box;
  function lens(b, which) { const m = GM(); const l = which ? m.lensR : m.lensL; return { x: b.cx - m.w / 2 + l[0] + 3, y: b.by - m.h + l[1] }; }

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
    if (b.phase === 1 && b.hp <= b.maxHp / 2) { b.phase = 2; G.sfx('roar'); G.shake(8); FX.text(G, '¡FURIA!', b.cx, b.by - 140, '#ff2e4a', 2, 80); }

    // ---- elegir ataque al comienzo de cada compás ----
    if (G.beatTick) {
      const rel = G.beat - b.startBeat, inBar = ((rel % 4) + 4) % 4;
      if (inBar === 0) {
        const seq1 = ['laser', 'rain', 'slam', 'laser', 'rest'], seq2 = ['laser', 'slam', 'laser', 'rain'];
        const s = b.phase === 1 ? seq1 : seq2; b.atk = s[b.seq++ % s.length]; b.inBar = 0;
      } else b.inBar = inBar;
      onBeat(b, G, b.inBar);
    }
    // ---- láser: apuntar y disparar ----
    if (b.atk === 'laser') {
      if (b.aimLive) { const t = p.x + 7; b.aims = [{ x: t, y: A.floorY }, { x: t + (p.vx || 0) * 24 + 26 * (p.dir || 1), y: A.floorY }]; }
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
    b.frame = b.atk === 'laser' ? (b.beams > 0 ? 3 : b.aimLive ? 2 : 0) : b.atk === 'slam' && b.inBar === 0 ? 4 : (G.beat & 1);
    // contacto / pisotón en la cabeza
    const bb = box(b);
    if (!p.dead && U.overlap(bb, NV.playerBox(p))) {
      const feetPrev = p.y + p.h - p.vy;
      if (p.vy > 0.4 && feetPrev <= bb.y + 22) { p.vy = C.STOMP_BOUNCE_HELD; NV.damageBoss(b, G, 3, true); G.sfx('stomp'); FX.text(G, '¡PISOTÓN!', p.x + 7, p.y - 6, '#f5c542'); }
      else if (p.shield <= 0) NV.hurtPlayer(p, G, b.cx);
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
        const tx = U.clamp(p.x + 7 + (i ? U.rand(-90, 90) : U.rand(-20, 20)), A.x0 + 20, A.x1 - 180);
        const fall = NV.Audio.beatLen() * 60; // llega justo en el próximo beat
        G.bullets.push({ x: tx, y: -10, vx: 0, vy: (A.floorY + 10) / fall, r: 5, life: fall + 4, kind: 'ornament', dmg: 1, bomb: true, green: i === 1, rain: true, t: 0 });
        G.marks.push({ x: tx, life: fall });
      }
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
    X.spr('grinch', b.frame, b.cx - cx, b.by - cy, { flash: b.flash > 0 || (b.dead && (G.frame >> 1) % 2 && b.deathT < 110) });
    if (glow) { const m = GM(); ctx.save(); ctx.fillStyle = '#9dffbf'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.frame * 0.4); NV.Input.circ(ctx, b.cx - m.w / 2 + m.core[0] - cx, b.by - m.h + m.core[1] - cy, 7); ctx.restore(); }
  };
  function beam(ctx, x0, y0, x1, y1, w, c, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(Math.round(x0), Math.round(y0)); ctx.lineTo(Math.round(x1), Math.round(y1)); ctx.stroke(); ctx.globalAlpha = 1;
  }
})();
