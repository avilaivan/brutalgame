// =====================================================================
//  JUGADOR — los 3 personajes se mueven y disparan igual; cambia el color,
//  la canción y la forma de morir. Controles: mover, saltar, disparar, dash.
//  Pisar a un enemigo común lo elimina.
// =====================================================================
(function () {
  const C = NV.CFG, U = NV.U, IN = NV.Input, FX = NV.FX;
  // Cuadros de cada animación (salen de las hojas nuevas de arte-fuente/ASSETS AGREGADOS)
  const JF = { ivan: { up: 1, peak: 2, fall: 3, land: 4 }, hades: { up: 1, peak: 2, fall: 3, land: 4 }, matias: { up: 2, peak: 3, fall: 4, land: 5 } };
  const SHOOT = { ivan: [1, 2, 3], hades: [2, 1, 0], matias: [2, 3, 4] };          // fogonazo -> retroceso -> humo
  const DASHF = { ivan: [0, 1, 2, 3], hades: [0, 1, 2, 3], matias: [0, 1, 2, 3] };  // arranque, 2 de velocidad, frenada
  const RUN_CYCLE = 30; // cuadros de juego que dura un ciclo completo de carrera (2 pasos)
  const DIE_T = 46;     // cuadros que dura la animación de caída antes del efecto final de cada DJ

  NV.Player = function (key, x, y) {
    return {
      key, hero: NV.HEROES[key], x: x - 7, y: y - 34, w: 14, h: 34, vx: 0, vy: 0, dir: 1,
      hp: C.HP, onGround: false, coyote: 0, jumpBuf: 0, dash: 0, dashDir: 1, airDashUsed: false, dashJump: false,
      shootCd: 0, shootPose: 0, heat: 0, overheat: false, energy: 100, noEnergyT: 0, invuln: 60, hurt: 0, shield: 0, dead: false, deadT: 0,
      anim: 'idle', frame: 0, mix: 0, animT: 0, runPh: 0, landT: 0, ghosts: [], safe: { x, y }, chain: 0,
    };
  };

  NV.updatePlayer = function (p, G, locked) {
    const L = G.L;
    if (p.dead) { p.deadT++; deathFX(p, G); if (p.deadT >= C.RESPAWN_DELAY) G.respawn(); return; }
    if (p.invuln > 0) p.invuln--;
    if (p.shield > 0) {
      p.shield--;
      if (p.shield === 0) { G.sfx('shield_break'); for (let i = 0; i < 14; i++) FX.part(G, { x: p.x + 7, y: p.y + 17, vx: U.rand(-2.5, 2.5), vy: U.rand(-3, 1), g: 0.15, color: i % 2 ? '#f5c542' : '#fff3c4', life: 30, max: 30 }); FX.text(G, 'ESCUDO ROTO', p.x + 7, p.y - 10, '#f5c542'); }
    }
    let ix = locked ? 0 : (IN.held.right ? 1 : 0) - (IN.held.left ? 1 : 0);
    if (p.hurt > 0) { p.hurt--; ix = 0; p.vx = -p.dir * 1.2; p.dash = 0; }
    if (ix && !p.dash) p.dir = ix;

    // ---------- dash ----------
    const fev = G.fever();
    if (p.dash === 0) p.energy = Math.min(100, p.energy + C.DASH_REGEN * (fev ? 1.8 : 1));
    if (p.noEnergyT > 0) p.noEnergyT--;
    if (!locked && p.hurt === 0 && IN.pressed('dash') && p.dash === 0 && (p.onGround || !p.airDashUsed) && p.energy < C.DASH_COST) {
      if (!p.noEnergyT) { G.sfx('denied'); FX.text(G, 'SIN ENERGÍA', p.x + 7, p.y - 12, '#4de2ff', 1, 30); p.noEnergyT = 30; }
    }
    if (!locked && p.hurt === 0 && IN.pressed('dash') && p.dash === 0 && (p.onGround || !p.airDashUsed) && p.energy >= C.DASH_COST) {
      p.energy -= C.DASH_COST;
      p.dash = C.DASH_FRAMES; p.dashDir = ix || p.dir; p.dir = p.dashDir;
      if (!p.onGround) { p.airDashUsed = true; p.vy = 0; }
      G.sfx('dash');
    }
    if (p.dash > 0) {
      p.dash--; p.vx = p.dashDir * C.DASH_SPEED * (G.fever() ? C.FEVER_SPEED : 1);
      if (p.dash % 2 === 0) p.ghosts.push({ x: p.x, y: p.y, a: p.anim, f: p.frame, dir: p.dir, life: 10 });
      if (p.onGround && p.dash % 3 === 0) FX.part(G, { x: p.x + 7 - p.dashDir * 8, y: p.y + p.h - 2, vx: -p.dashDir * 0.5, vy: -0.4, color: '#e9f4ff', life: 14, max: 14 });
    } else if (p.hurt === 0) {
      p.vx = ix * (p.dashJump && !p.onGround ? C.DASH_SPEED * 0.85 : C.RUN) * (G.fever() ? C.FEVER_SPEED : 1);
      // FIEBRE: estela de imágenes del personaje
      if (G.fever() && ix && G.frame % 3 === 0) p.ghosts.push({ x: p.x, y: p.y, a: p.anim, f: p.frame, dir: p.dir, life: 10 });
    }
    if (p.onGround) { p.dashJump = false; p.airDashUsed = false; }

    // ---------- salto ----------
    if (p.onGround) p.coyote = C.COYOTE; else if (p.coyote > 0) p.coyote--;
    if (!locked && IN.pressed('jump')) p.jumpBuf = C.JUMP_BUFFER; else if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.jumpBuf > 0 && p.coyote > 0 && p.hurt === 0) {
      p.vy = C.JUMP_VEL; p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      p.dashJump = p.dash > 0 || IN.held.dash; p.dash = 0;
      G.sfx('jump'); p.sq = 1.16; // se estira al despegar
      for (let i = 0; i < 3; i++) FX.part(G, { x: p.x + 7 + U.rand(-4, 4), y: p.y + p.h, vx: U.rand(-0.6, 0.6), vy: -U.rand(0.1, 0.4), color: '#e9f4ff', life: 10, max: 10 });
    }
    if (!IN.held.jump && p.vy < C.JUMP_CUT) p.vy = C.JUMP_CUT;
    if (!(p.dash > 0 && !p.onGround)) p.vy = Math.min(p.vy + C.GRAVITY, C.MAX_FALL);

    NV.Phys.move(p, L);
    p.sq = (p.sq || 1) + (1 - (p.sq || 1)) * 0.22; // vuelve suave a su forma
    if (p.landed) { p.chain = 0; p.sq = 0.84; p.landT = 7; for (let i = 0; i < 4; i++) FX.part(G, { x: p.x + 7 + U.rand(-6, 6), y: p.y + p.h, vx: U.rand(-0.8, 0.8), vy: -U.rand(0.2, 0.8), color: '#e9f4ff', life: 12, max: 12 }); }
    // último lugar seguro (para volver si se cae a un pozo)
    if (p.onGround && NV.Phys.solidAt(L, p.x + 2, p.y + p.h + 2) && NV.Phys.solidAt(L, p.x + p.w - 2, p.y + p.h + 2)) p.safe = { x: p.x + 7, y: p.y + p.h };
    if (p.y > L.h * 16 + 8) { G.pitFall(); return; }

    // ---------- disparo (mantener = ráfaga) ----------
    if (p.shootCd > 0) p.shootCd--;
    if (p.shootPose > 0) p.shootPose--;
    // calor del arma: baja solo; si llega a 100 se traba hasta enfriarse (más rápido en FIEBRE)
    p.heat = Math.max(0, p.heat - (p.overheat ? C.HEAT_COOL_LOCK : C.HEAT_COOL) * (fev ? 1.6 : 1));
    if (p.overheat) {
      if (G.frame % 4 === 0) FX.part(G, { x: p.x + 7 + p.dir * 12, y: p.y + p.h - 26, vx: U.rand(-0.3, 0.3), vy: -U.rand(0.6, 1.2), color: G.frame % 8 ? '#c8d8f0' : '#8ea2c4', life: 24, max: 24, size: 2 });
      if (p.heat <= C.HEAT_RESUME) { p.overheat = false; G.sfx('cooled'); }
    }
    if (!locked && IN.held.shoot && p.shootCd === 0 && p.hurt === 0 && p.overheat && IN.pressed('shoot')) G.sfx('denied');
    if (!locked && IN.held.shoot && p.shootCd === 0 && p.hurt === 0 && !p.overheat) {
      const mine = G.bullets.filter((b) => b.mine).length;
      if (mine < C.SHOT_MAX) {
        // sale pegado al cañón (si sale 18 px adelante, a quemarropa pasa de largo) y a media altura del cuerpo
        G.bullets.push({ mine: true, x: p.x + 7 + p.dir * 8, y: p.y + p.h - 23, vx: p.dir * C.SHOT_SPEED, vy: 0, r: 6, life: C.SHOT_LIFE, dmg: C.SHOT_DMG, kind: 'shot_' + p.key, t: 0 });
        p.shootCd = C.SHOT_COOLDOWN; p.shootPose = 14; G.sfx('shoot');
        p.heat += C.HEAT_SHOT;
        if (p.heat >= 100) {
          p.heat = 100; p.overheat = true; G.sfx('overheat'); G.shake(2);
          FX.text(G, '¡SOBRECALENTADA!', p.x + 7, p.y - 14, '#ff8a3d', 1, 45);
          for (let i = 0; i < 10; i++) FX.part(G, { x: p.x + 7 + p.dir * 12, y: p.y + p.h - 24, vx: U.rand(-1.5, 1.5), vy: -U.rand(0.5, 2), color: '#ffffff', life: 20, max: 20, size: 2 });
        }
        G.muzzle = { x: p.x + 7 + p.dir * 26, y: p.y + p.h - 23, t: 6, c: p.hero.light, col: p.hero.color, dir: p.dir };
      }
    }

    // ---------- animación ----------
    // frame puede ser fraccionario; mix es cuánto del cuadro siguiente se mezcla encima (cuadro intermedio)
    p.animT++;
    if (p.landT > 0) p.landT--;
    const jf = JF[p.key], N = (n) => NV.X.heroFrames(p.key, n);
    let a = 'idle', f = 0, mix = 0;
    const moving = Math.abs(p.vx) > 0.1;
    // la carrera avanza con la velocidad real: en FIEBRE las piernas van más rápido
    if (moving && p.onGround) p.runPh += Math.abs(p.vx) / C.RUN; else if (!moving) p.runPh = 0;
    const cyc = (name) => { const n = N(name), pos = (p.runPh * n) / RUN_CYCLE; mix = (pos % 1) * 0.6; return Math.floor(pos); };
    if (p.hurt > 0) { a = 'hurt'; f = p.hurt > 8 ? 0 : 1; }
    else if (p.dash > 0) {
      const t = 1 - p.dash / C.DASH_FRAMES, d = DASHF[p.key];
      a = 'dash'; f = t < 0.14 ? d[0] : t > 0.82 && p.onGround ? d[3] : d[1 + ((p.dash >> 1) & 1)];
      if (t >= 0.14 && t <= 0.82) mix = 0.4;
    } else if (!p.onGround) {
      if (p.shootPose > 0) { a = 'runshoot'; f = 2; }
      else { a = 'jump'; f = p.vy < -1.2 ? jf.up : p.vy > 1.2 ? jf.fall : jf.peak; }
    } else if (moving) {
      if (p.shootPose > 0) { a = 'runshoot'; f = cyc('runshoot'); }
      else { a = 'run'; f = cyc('run'); }
    } else if (p.shootPose > 0) { const sh = SHOOT[p.key], e = 14 - p.shootPose; a = 'shoot'; f = sh[e < 4 ? 0 : e < 9 ? 1 : 2]; }
    else if (p.landT > 0) { a = 'jump'; f = jf.land; }
    else { a = 'idle'; f = 0; if (!p.landed) p.sq += Math.sin(p.animT * 0.07) * 0.004; } // respira
    p.anim = a; p.frame = f; p.mix = mix;
    for (const g of p.ghosts) g.life--;
    p.ghosts = p.ghosts.filter((g) => g.life > 0);
  };

  NV.playerBox = (p) => ({ x: p.x + 1, y: p.y + 4, w: p.w - 2, h: p.h - 4 });

  NV.hurtPlayer = function (p, G, srcX, dmg = 1) {
    if (p.dead || p.invuln > 0 || p.shield > 0 || G.state !== 'play') return false;
    p.hp -= dmg; G.shake(5); G.hitstop = 4; G.vib(45); G.breakCombo();
    if (p.hp <= 0) { NV.killPlayer(p, G); return true; }
    p.dir = srcX > p.x + 7 ? 1 : -1; p.hurt = 16; p.invuln = C.INVULN; p.vy = Math.min(p.vy, -2.4);
    G.sfx('hurt'); G.flash('#ff2e4a', 6);
    return true;
  };
  NV.killPlayer = function (p, G) {
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.vx = p.vy = 0; p.hp = 0; G.vib(120);
    G.sfx('die_' + p.key); G.shake(7); G.deaths++;
  };

  // ---------------- MUERTE: distinta para cada personaje ----------------
  function deathFX(p, G) {
    const cx = p.x + 7, cy = p.y + 17, t = p.deadT;
    if (p.key === 'ivan') { // IVAN: estalla en llamas de bajo
      if (t === DIE_T) { FX.boom(G, cx, cy, true); G.flash('#ff8a3d', 8); for (let i = 0; i < 26; i++) FX.part(G, { x: cx + U.rand(-8, 8), y: cy + U.rand(-14, 14), vx: U.rand(-1.5, 1.5), vy: U.rand(-3.5, -0.5), g: -0.03, drag: 0.95, color: U.pick(['#ffd23d', '#ff8a3d', '#ff2e4a', '#fff3c4']), life: 40, max: 40, size: U.pick([2, 3]) }); }
      if (t > DIE_T && t < 72 && t % 3 === 0) FX.part(G, { x: cx + U.rand(-10, 10), y: cy - U.rand(0, 20), vx: U.rand(-0.4, 0.4), vy: U.rand(0.3, 1), g: 0.02, color: '#ff8a3d', life: 30, max: 30, size: 1 });
    } else if (p.key === 'hades') { // HADES: se electrocuta, glitchea y se desintegra en píxeles azules
      if (t === DIE_T) { G.flash('#b4cdff', 8); for (let yy = -16; yy < 18; yy += 3) for (let xx = -7; xx < 8; xx += 3) FX.part(G, { x: cx + xx, y: cy + yy, vx: U.rand(-0.3, 0.3), vy: U.rand(-2.5, -0.6), g: -0.02, color: U.pick(['#4d8dff', '#b4cdff', '#ffffff', '#2559d6']), life: 50, max: 50 }); }
    } else { // MATIAS: implota en ondas de sintetizador verdes
      if (t === DIE_T) { G.flash('#a8ffc8', 8); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; FX.part(G, { x: cx, y: cy, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, drag: 0.93, color: i % 2 ? '#33e07a' : '#a8ffc8', life: 36, max: 36 }); } }
    }
  }

  NV.drawPlayer = function (ctx, p, G, cx, cy) {
    const X = NV.X; const fx = p.x + 7 - cx, fy = p.y + p.h - cy;
    // estela: siluetas del color del DJ que se desvanecen (desenfoque de movimiento del dash y la FIEBRE)
    for (const g of p.ghosts) X.hero(p.key, g.a, g.f, g.x + 7 - cx, g.y + p.h - cy, g.dir < 0, true, (g.life / 10) * 0.3);
    if (p.dead) { drawDeath(ctx, p, G, fx, fy); return; }
    if (p.invuln > 0 && p.hurt === 0 && (G.frame >> 2) % 2 === 0) return;
    const flash = p.hurt > 0 && (G.frame >> 1) % 2 === 0;
    // halo del color del DJ: con la ciudad oscurecida, el personaje se despega del fondo
    { const g = ctx.createRadialGradient(fx, fy - 18, 2, fx, fy - 18, 30); g.addColorStop(0, p.hero.color + '55'); g.addColorStop(1, p.hero.color + '00'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(fx - 30, fy - 48, 60, 60); ctx.restore(); }
    X.hero(p.key, p.anim, p.frame, fx, fy, p.dir < 0, flash, undefined, p.sq, p.mix, p.anim === 'run' || p.anim === 'runshoot');
    if (p.shield > 0) { // escudo dorado
      const blink = p.shield < 120 && (G.frame >> 2) % 2;
      if (!blink) {
        ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.frame * 0.3);
        ring(ctx, fx, fy - 20, 24, '#f5c542'); ring(ctx, fx, fy - 20, 22, '#fff3c4');
        ctx.restore();
        for (let i = 0; i < 3; i++) { const a = G.frame * 0.12 + i * 2.1; X.rect(fx + Math.cos(a) * 23 - 1, fy - 20 + Math.sin(a) * 23 - 1, 3, 3, '#fff3c4'); }
      }
    }
  };
  function ring(ctx, cx, cy, r, c) { ctx.fillStyle = c; for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 2, 2); } }
  NV.ring = ring;

  // Caída animada (golpe, vuela hacia atrás, cae al piso) + el final propio de cada DJ:
  // IVAN estalla en llamas, BB HADES se electrocuta y se desintegra, MATIAS implota en ondas de sintetizador.
  function drawDeath(ctx, p, G, fx, fy) {
    const X = NV.X, t = p.deadT, k = p.key, n = X.heroFrames(k, 'die');
    if (t < DIE_T) {
      const pos = Math.min(n - 1, (t / DIE_T) * n), f = Math.floor(pos), back = -p.dir * Math.min(14, t * 0.5);
      const blink = t < 8 && (t >> 1) % 2 === 0;
      if (k === 'hades' && t > 26) {
        // glitch: el sprite se corta en franjas desplazadas
        const D = window.SPRITE_DATA, a = D.anims[k].die, img = (t >> 1) % 2 ? X.white[k] : X.img[k];
        for (let s = 0; s < 8; s++) {
          const sy = s * 8, off = (Math.random() - 0.5) * ((t - 20) / 2.5);
          ctx.save(); ctx.translate(Math.round(fx + back + off), Math.round(fy)); if (p.dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(img, f * D.cw, a.row * D.ch + sy, D.cw, 8, -D.ax, -D.ay + sy, D.cw, 8); ctx.restore();
        }
        ctx.strokeStyle = '#b4cdff'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); let x = fx + back + U.rand(-14, 14), y = fy - 46; ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += U.rand(-6, 6); y += 10; ctx.lineTo(Math.round(x), Math.round(y)); } ctx.stroke(); }
      } else if (k === 'matias' && t > 30) {
        const sc = 1 - (t - 30) / (DIE_T - 28);
        ctx.save(); ctx.translate(Math.round(fx + back), Math.round(fy - 8)); ctx.scale(sc, sc);
        X.hero(k, 'die', f, 0, 8, p.dir < 0, (t >> 2) % 2 === 0); ctx.restore();
      } else X.hero(k, 'die', f, fx + back, fy, p.dir < 0, blink || (k === 'ivan' && t > DIE_T - 10 && (t >> 1) % 2 === 0), undefined, 1, (pos % 1) * 0.5, false);
    }
    if (k === 'matias') {
      const t0 = t - 26;
      for (let r = 0; r < 3; r++) { const rr = (t0 - r * 8) * 2.2; if (rr > 0 && rr < 70) { ctx.save(); ctx.globalAlpha = 1 - rr / 70; ring(ctx, fx, fy - 12, rr, r % 2 ? '#a8ffc8' : '#33e07a'); ctx.restore(); } }
      if (t0 > 8 && t0 < 46) for (let i = -3; i <= 3; i++) { const h = Math.abs(Math.sin(t0 * 0.3 + i)) * 26 * (1 - t0 / 46); X.rect(fx + i * 7 - 2, fy - h, 4, h, '#33e07a'); }
    }
  }
})();
