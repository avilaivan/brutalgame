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
    FX.text(G, how === 'stomp' ? (chain > 1 ? '¡PISOTÓN x' + chain + '!' : '¡PISOTÓN!') : '+' + pts, cx, e.y - 6, how === 'stomp' ? '#f5c542' : '#ffffff', chain > 1 || G.combo >= C.FEVER_AT ? 2 : 1);
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
  //  ROBO-GRINCH — jefe final. Mitad Grinch, mitad robot, con saco de Papá Noel.
  //  Ataca al ritmo de la canción (un ataque cada 2 compases; más seguido en la fase 2) y SIEMPRE avisa antes:
  //   · LÁSER de las gafas: la mira punteada sigue al DJ un momento, se FIJA (queda quieta ~1 s) y recién ahí dispara.
  //   · COHETES: señala el cielo; cada cohete marca en el piso dónde va a caer antes de caer.
  //   · CAÑÓN: el brazo se transforma en cañón, fija una línea de tiro punteada y dispara por esa línea.
  //   · PISOTÓN: levanta la pierna y pisa; manda una onda de sonido por el piso (hay que saltarla).
  //  Ningún ataque persigue al jugador después de fijarse: moverse a tiempo alcanza para esquivar.
  // =====================================================================
  const BD = () => window.BOSS_DATA, BC = C.BOSS;
  // anims[nombre] = [primero, cuadros originales, intercalado]. Intercalado: el original i está en primero + 2i
  // y entre medio hay un cuadro GENERADO (tools/assets_v2.py, flujo óptico) que se muestra en la transición.
  const FR = (name, i = 0) => { const a = BD().anims[name], k = Math.max(0, Math.min(a[1] - 1, i)); return a[0] + (a[2] ? 2 * k : k); };
  // cuadro intermedio generado entre dos poses vecinas (o -1 si no hay o si se descartó por ser "fantasma")
  function midOf(f0, f1) {
    if (Math.abs(f1 - f0) !== 2) return -1;
    const m = (f0 + f1) / 2, D = BD();
    for (const k in D.anims) { const a = D.anims[k]; if (a[2] && m > a[0] && m < a[0] + 2 * a[1] - 1 && (m - a[0]) % 2 === 1) return D.bad && D.bad.indexOf(m) >= 0 ? -1 : m; }
    return -1;
  }
  // puntos de la hoja del jefe (coordenadas dentro de la celda)
  // puntos del jefe: x medida desde su CENTRO, y desde arriba de la celda (no cambian si la hoja se rearma)
  const LENS = [-14, 75];     // las gafas: de acá sale SIEMPRE el láser (solo cambia la dirección)
  const MUZZLE = [-63, 86];   // boca del cañón
  const CORE = [-16, 100];    // núcleo del pecho (brilla en el descanso)
  const GLOW = [-24, 71];     // brillo de las gafas en reposo
  const SHATTER_T = 100; // cuadro de la muerte en el que estalla en pedazos
  const pt = (b, q) => { const B = BD(); return { x: b.cx + q[0], y: b.by - B.h + q[1] + (b.dropY || 0) }; };
  const ph = (b) => (b.phase === 2 ? 1 : 0);

  function gapBeats(b) { const f = U.clamp(b.hp / b.maxHp, 0, 1); return Math.max(1, Math.round(4 * f + 0.4)); }
  NV.Boss = function (A) {
    return { cx: A.bossX, by: A.bossY, hp: BC.HP, maxHp: BC.HP, phase: 1, active: false, dead: false, deathT: 0, flash: 0,
      frame: FR('idle'), prev: FR('idle'), mixT: 0, atk: 'intro', atkT: 0, seq: 0, startBeat: 0,
      aim: null, locked: false, beamT: 0, rockets: [], shots: 0, line: null,
      swatT: 0, swatCd: 0, stompCd: 0, dropY: -340, landed: false, landT: 0 };
  };
  const box = (b) => ({ x: b.cx - 40, y: b.by - 116, w: 74, h: 116 });
  NV.bossBox = box;
  // cambia de pose con una mezcla corta entre el cuadro anterior y el nuevo (animación fluida)
  function pose(b, f, blend = 6) { if (f === b.frame) return; b.prev = b.frame; b.frame = f; b.mixT = b.mixMax = blend; }
  // donde termina un rayo: sigue la línea origen -> objetivo hasta el piso o el borde izquierdo de la arena
  function beamEnd(L0, tx, ty, A) {
    const dx = tx - L0.x, dy = ty - L0.y; let t = 6;
    if (dy > 0.01) t = Math.min(t, (A.floorY - L0.y) / dy);
    if (dx < -0.01) t = Math.min(t, (A.x0 - L0.x) / dx);
    t = Math.max(1, t);
    return { x: L0.x + dx * t, y: L0.y + dy * t };
  }
  // primera superficie donde cae algo soltado desde arriba en x (piso o plataforma)
  function landY(L, x, A) { for (let y = 0; y < A.floorY; y += 4) if (NV.Phys.groundAt(L, x, y)) return Math.floor(y / 16) * 16; return A.floorY; }

  function startAttack(b, G, name) {
    b.atk = name; b.atkT = 0; b.locked = false; b.aim = null; b.beamT = 0; b.line = null; b.shots = 0;
    if (name === 'laser') G.sfx('laser_charge');
    if (name === 'rockets') G.sfx('roar');
    if (name === 'cannon') G.sfx('transform');
  }

  NV.updateBoss = function (b, G) {
    const p = G.player, A = G.L.arena, k = ph(b);
    if (b.flash > 0) b.flash--;
    if (b.mixT > 0) b.mixT--;
    // ---- muerte: cortocircuito, se dobla, cae de rodillas, explota y ESTALLA EN PEDAZOS ----
    if (b.dead) {
      b.deathT++; b.rockets = [];
      const t = b.deathT, B = BD();
      if (t < SHATTER_T) {
        pose(b, FR('die', t < 22 ? 0 : t < 42 ? 1 : t < 62 ? 2 : t < 80 ? 3 : 4), 10);
        if (t % 6 === 0) { FX.boom(G, b.cx + U.rand(-45, 40), b.by - U.rand(10, 105)); G.sfx('kill'); G.shake(2 + t / 30); }
        if (t % 9 === 0) { G.sfx('zap'); for (let i = 0; i < 8; i++) FX.part(G, { x: b.cx + U.rand(-40, 40), y: b.by - U.rand(30, 110), vx: U.rand(-3, 3), vy: U.rand(-3, 1), g: 0.12, color: i % 2 ? '#ffd23d' : '#ffffff', life: 20, max: 20 }); }
        if (t > SHATTER_T - 24) G.shake(6);
      } else if (t === SHATTER_T) {
        // estalla: cada bloque del sprite sale volando como una pieza
        G.sfx('big_boom'); G.sfx('kill'); G.shake(16); G.vib([90, 40, 220]); G.hype = 600; NV.Audio.sfx('cheer'); G.flash('#ffffff', 16);
        const S = B.shatter, ox = b.cx - B.w / 2, oy = b.by - B.h, mx = B.w / 2, my = B.h * 0.55;
        const sx = (S.f % B.cols) * B.w, sy = Math.floor(S.f / B.cols) * B.h;
        b.shards = S.cells.map(([x, y]) => {
          const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy) + 1, pw = U.rand(2.2, 6.5) * (1.2 - Math.min(1, d / 110) * 0.5);
          return { x: ox + x, y: oy + y, vx: (dx / d) * pw + U.rand(-0.8, 0.8), vy: (dy / d) * pw - U.rand(2, 5.5), r: 0, vr: U.rand(-0.35, 0.35), sx: sx + x, sy: sy + y, life: U.rand(70, 130) | 0, hot: Math.random() < 0.3 ? 14 : 0 };
        });
        for (let i = 0; i < 6; i++) FX.boom(G, b.cx + U.rand(-50, 40), b.by - U.rand(10, 110), true);
        G.rings.push({ x: b.cx, y: b.by - 60, r: 10, v: 8, life: 30, max: 30, c: '#ff2e4a' }, { x: b.cx, y: b.by - 60, r: 4, v: 6, life: 34, max: 34, c: '#33e07a' });
        for (let i = 0; i < 40; i++) G.coins.push(NV.Coin(b.cx + U.rand(-30, 30), b.by - U.rand(30, 100), true, true));
        for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2, sp = U.rand(2, 8); FX.part(G, { x: b.cx, y: b.by - 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.1, color: U.pick(['#ffd23d', '#ff8a3d', '#ffffff', '#ff2e4a', '#33e07a']), life: 40, max: 40, size: U.pick([2, 3]) }); }
      }
      if (b.shards) {
        for (const p2 of b.shards) {
          p2.vy += 0.22; p2.x += p2.vx; p2.y += p2.vy; p2.r += p2.vr; p2.life--; if (p2.hot > 0) p2.hot--;
          if (p2.y > A.floorY - 3 && p2.vy > 0) { p2.y = A.floorY - 3; p2.vy *= -0.32; p2.vx *= 0.7; p2.vr *= 0.6; }
          if (p2.hot > 0 && G.frame % 4 === 0) FX.part(G, { x: p2.x, y: p2.y, vx: 0, vy: -0.5, g: -0.01, color: '#ff8a3d', life: 12, max: 12 });
        }
        b.shards = b.shards.filter((p2) => p2.life > 0);
      }
      if (t > SHATTER_T && t < SHATTER_T + 140 && t % 6 === 0) FX.part(G, { x: b.cx + U.rand(-40, 40), y: b.by - U.rand(0, 20), vx: U.rand(-0.2, 0.2), vy: -U.rand(0.5, 1.1), g: -0.005, color: t % 12 ? '#3a3f52' : '#5d6a8a', life: 50, max: 50, size: 3 });
      return;
    }
    // ---- entrada: cae del cielo sobre su tarima ----
    if (!b.landed) {
      if (b.dropping) {
        b.dropV = (b.dropV || 2) + 1.6; b.dropY = Math.min(0, b.dropY + b.dropV); pose(b, FR('stomp', 3), 1);
        if (b.dropY === 0) {
          b.landed = true; b.landT = 34; pose(b, FR('stomp', 4), 1);
          G.sfx('slam'); G.sfx('roar'); G.shake(14); G.vib([90, 40, 160]); G.flash('#ffffff', 10); G.hype = 120;
          for (let i = 0; i < 46; i++) { const a = Math.PI + Math.random() * Math.PI, s = 1 + Math.random() * 5; FX.part(G, { x: b.cx + U.rand(-50, 50), y: b.by, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, g: 0.14, color: U.pick(['#f4f8ff', '#c8d8f0', '#8fb0d6', '#ff2e4a', '#33e07a']), life: 40, max: 40, size: U.pick([2, 3]) }); }
          G.rings.push({ x: b.cx, y: b.by - 6, r: 10, v: 7, life: 26, max: 26, c: '#ff2e4a' }, { x: b.cx, y: b.by - 6, r: 4, v: 5, life: 30, max: 30, c: '#33e07a' });
        }
      }
      return;
    }
    if (b.landT > 0) { if (--b.landT === 12) pose(b, FR('stomp', 5), 8); if (b.landT === 0) pose(b, FR('idle'), 8); }
    if (!b.active) { if (b.landT === 0) pose(b, FR('idle', (G.beat >> 1) & 1), 14); return; }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2; G.shake(8);
      G.say('¡SE CORTÓ LA NAVIDAD!', { scale: 3, life: 100, color: '#ff2e4a', sub: 'ROBO-GRINCH ESTÁ FURIOSO: ATACA CADA VEZ MÁS SEGUIDO' });
      NV.lightsOut(G, 330, '¡SE ACABÓ LA FIESTA!'); b.darkCd = 420; b.talked = 2; // 2ª y última frase de la pelea
    }
    // CORTES DE LUZ durante la pelea: cada tanto (más seguido en la fase 2), con el cartel del Grinch
    if (b.darkCd === undefined) b.darkCd = 600;
    if (!G.dark && --b.darkCd <= 0) {
      // habla solo UNA vez en la fase 1 (el primer corte); los demás cortes son sin cartel
      const line = !b.talked ? '¡APAGUEN TODO!' : null; if (line) b.talked = 1;
      NV.lightsOut(G, b.phase === 2 ? 300 : 240, line);
      b.darkCd = ((b.phase === 2 ? 420 : 720) + U.rand(0, 120)) | 0;
    }

    // ---- elegir ataque: uno por "turno" de la canción ----
    // Cuanto menos vida le queda, menos espera entre un ataque y el siguiente (siempre con su aviso):
    // con la vida llena descansa 4 beats después de cada ataque; casi muerto, 1 beat.
    const idle = b.atk === 'idle' || b.atk === 'intro' || b.atk === 'rest';
    if (b.atk === 'idle' && b.lastAtk !== 'idle') b.nextBeat = G.beat + gapBeats(b);
    b.lastAtk = b.atk;
    if (b.nextBeat === undefined) b.nextBeat = b.startBeat;
    if (G.beatTick && idle && G.beat >= b.nextBeat) {
      const s1 = ['laser', 'rockets', 'cannon', 'stomp', 'laser', 'rest'], s2 = ['laser', 'cannon', 'stomp', 'rockets', 'laser', 'cannon', 'rest'];
      const s = k ? s2 : s1, next = s[b.seq++ % s.length];
      startAttack(b, G, next); b.lastAtk = next;
      if (next === 'rest') b.nextBeat = G.beat + Math.max(2, Math.round(2 + 2 * (b.hp / b.maxHp))); // el descanso también se acorta
    }
    b.atkT++;
    const t = b.atkT;
    let f = FR('idle', (G.beat >> 1) & 1), blend = 12;

    if (b.atk === 'laser') {
      const track = BC.LASER_TRACK[k], lock = BC.LASER_LOCK[k], fire = BC.LASER_FIRE, L0 = pt(b, LENS);
      if (t <= track) {
        // la mira SIGUE al DJ con retraso (nunca queda clavada encima)
        const tx = p.x + 7, ty = p.y + 18;
        if (!b.aim) b.aim = { x: tx - 70, y: ty }; else { b.aim.x += (tx - b.aim.x) * 0.1; b.aim.y += (ty - b.aim.y) * 0.1; }
        f = FR('laser', t < track / 2 ? 0 : 1); blend = 8;
        if (t === track) { b.locked = true; b.end = beamEnd(L0, b.aim.x, b.aim.y, A); G.sfx('lock'); }
      } else if (t <= track + lock) {
        // mira FIJA: ya no se mueve. Este es el tiempo para salir de la línea.
        f = FR('laser', 2); blend = 8;
        const left = track + lock - t;
        if (left === 18) G.sfx('laser_charge');
        if (left === 0) { b.beamT = fire; G.sfx('laser'); G.shake(5); G.vib(40); }
      } else if (b.beamT > 0) {
        b.beamT--; f = FR('laser', 3 + ((t >> 2) & 1)); blend = 3;
        if (NV.U.segDist(p.x + 7, p.y + 18, L0.x, L0.y, b.end.x, b.end.y) < 8) NV.hurtPlayer(p, G, b.cx);
        if (G.frame % 2 === 0) FX.part(G, { x: b.end.x + U.rand(-5, 5), y: b.end.y - 1, vx: U.rand(-1.8, 1.8), vy: U.rand(-2.8, -0.5), g: 0.12, color: G.frame % 4 ? '#ff2e4a' : '#33e07a', life: 18, max: 18 });
        if (b.beamT === 0) { b.locked = false; b.aim = null; }
      } else { b.atk = 'idle'; }
    } else if (b.atk === 'rockets') {
      f = FR('rocket', t < 12 ? 0 : t < 26 ? 1 : 2 + ((t >> 3) & 1)); blend = 7;
      if (t === 26) {
        // marca los lugares UNA vez (donde está el DJ ahora y alrededor) y los cohetes caen ahí, sin corregir
        G.sfx('launch'); G.shake(3);
        const n = BC.ROCKETS[k], warn = BC.ROCKET_WARN[k], used = [];
        for (let i = 0; i < n; i++) {
          let tx = p.x + 7 + (i === 0 ? U.rand(-10, 10) : (i % 2 ? 1 : -1) * U.rand(54, 120) * Math.ceil(i / 2));
          tx = U.clamp(tx, A.x0 + 24, b.cx - 80);
          if (used.some((u) => Math.abs(u - tx) < 34)) tx = U.clamp(tx + (tx > (A.x0 + b.cx) / 2 ? -70 : 70), A.x0 + 24, b.cx - 80);
          used.push(tx);
          b.rockets.push({ x: tx, land: landY(G.L, tx, A), t: 0, warn: warn + i * 12, green: i % 2 === 1 });
        }
        for (let i = 0; i < 3; i++) FX.part(G, { x: b.cx + 20 + i * 8, y: b.by - 150, vx: 0, vy: -7, color: '#ffd23d', life: 20, max: 20, size: 3 });
      }
      if (t > 66) b.atk = 'idle';
    } else if (b.atk === 'cannon') {
      const lock = BC.CANNON_LOCK[k], M = pt(b, MUZZLE), n = BC.CANNON_SHOTS[k];
      f = FR('cannon', t < 7 ? 0 : t < 14 ? 1 : t < 21 ? 2 : 3); blend = 6;
      if (t === 14) {
        // fija la línea de tiro hacia donde está el DJ en este momento (después no la corrige)
        const a = Math.atan2(p.y + 18 - M.y, p.x + 7 - M.x);
        b.line = { a: U.clamp(a, Math.PI * 0.62, Math.PI * 1.25) }; G.sfx('lock');
      }
      const first = 14 + lock;
      if (b.line && t >= first && b.shots < n && (t - first) % 16 === 0) {
        const a = b.line.a + (n === 3 ? (b.shots - 1) * 0.13 : 0), sp = 4.4;
        G.bullets.push({ x: M.x, y: M.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, life: 200, kind: 'plasma', dmg: 1, t: 0 });
        b.shots++; b.fireT = 7; G.sfx('cannon'); G.shake(4);
        for (let i = 0; i < 8; i++) FX.part(G, { x: M.x, y: M.y, vx: Math.cos(a) * U.rand(1, 4) + U.rand(-1, 1), vy: Math.sin(a) * U.rand(1, 4) + U.rand(-1, 1), color: i % 2 ? '#ffd23d' : '#ff8a3d', life: 14, max: 14 });
      }
      if (b.fireT > 0) { b.fireT--; f = FR('cannon', 4); blend = 2; } else if (b.shots > 0) { f = FR('cannon', 5); blend = 5; }
      if (b.shots >= n && b.fireT === 0 && t > first + (n - 1) * 16 + 16) { b.atk = 'idle'; b.line = null; }
    } else if (b.atk === 'stomp') {
      f = FR('stomp', t < 10 ? 0 : t < 24 ? 1 : t < 38 ? 2 : t < 44 ? 3 : t < 62 ? 4 : 5); blend = t >= 38 && t < 50 ? 2 : 7;
      const waveAt = (x, v) => G.bullets.push({ x, y: A.floorY - 8, vx: v, vy: 0, r: 8, life: 260, kind: 'wave', dmg: 1, t: 0, wave: true });
      if (t === 44) {
        G.sfx('slam'); G.shake(11); G.vib(70);
        waveAt(b.cx - 96, -3.0);
        G.rings.push({ x: b.cx - 20, y: b.by - 4, r: 8, v: 5, life: 22, max: 22, c: '#4de2ff' });
        for (let i = 0; i < 16; i++) FX.part(G, { x: b.cx - 20 + U.rand(-30, 30), y: b.by - 2, vx: U.rand(-3, 2), vy: U.rand(-3.5, -0.5), g: 0.2, color: i % 2 ? '#c8d8f0' : '#8fb0d6', life: 30, max: 30 });
      }
      if (k && t === 70) { G.sfx('slam'); G.shake(6); waveAt(b.cx - 96, -3.6); } // fase 2: una segunda onda, más rápida
      if (t > 76) b.atk = 'idle';
    }
    if (b.swatT === 0) pose(b, f, blend);

    // ---- cohetes en el aire ----
    for (const r of b.rockets) {
      r.t++;
      if (r.t === r.warn - 30) G.sfx('whistle');
      if (r.t >= r.warn) {
        r.dead = true; G.sfx('kill'); G.shake(4); FX.boom(G, r.x, r.land - 6, true);
        FX.burst(G, r.x, r.land - 4, r.green ? '#33e07a' : '#ff2e4a', 12, 2.4, 20, 0.1, 2); FX.burst(G, r.x, r.land - 4, '#ffd23d', 8, 1.6, 16, 0.1, 2);
        if (!p.dead && Math.abs(p.x + 7 - r.x) < 21 && p.y + p.h > r.land - 34 && p.y < r.land + 6) NV.hurtPlayer(p, G, r.x);
      }
    }
    b.rockets = b.rockets.filter((r) => !r.dead);

    // ---- contacto / pisotón en la cabeza ----
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
    // MANOTAZO: si te quedás pegado al jefe, levanta el puño (aviso largo) y golpea el piso a su lado
    if (b.swatCd > 0) b.swatCd--;
    const near = Math.abs(p.x + 7 - b.cx) < 92 && p.y + p.h > b.by - 126 && !p.dead;
    if (near && b.swatT === 0 && b.swatCd === 0 && b.atk !== 'rest') { b.swatT = 40; G.sfx('laser_charge'); }
    if (b.swatT > 0) {
      b.swatT--; pose(b, FR('stomp', b.swatT > 8 ? 2 : 4), 4);
      if (b.swatT === 8) {
        G.sfx('slam'); G.shake(6);
        const zone = { x: b.cx - 104, y: b.by - 96, w: 150, h: 96 };
        for (let i = 0; i < 16; i++) FX.part(G, { x: b.cx - 60 + U.rand(-40, 10), y: b.by - U.rand(0, 60), vx: U.rand(-3, -1), vy: U.rand(-1.5, 1.5), color: '#f4f8ff', life: 20, max: 20 });
        if (U.overlap(zone, NV.playerBox(p)) && p.shield <= 0 && NV.hurtPlayer(p, G, b.cx)) { p.vx = -4; p.vy = -4.5; }
        b.swatCd = 150;
      }
    }
  };

  NV.damageBoss = function (b, G, dmg, stomp) {
    if (b.dead || !b.active) return;
    const mult = b.atk === 'rest' ? 2 : 1;
    b.hp -= dmg * mult; b.flash = 4; if (!stomp) G.sfx('boss_hit');
    if (G.frame % 3 === 0 || stomp) FX.text(G, '-' + dmg * mult, b.cx + U.rand(-40, 20), b.by - U.rand(60, 110), mult > 1 ? '#f5c542' : '#ffffff', 1, 26);
    if (mult > 1 && G.frame % 6 === 0) FX.text(G, 'x2', b.cx + U.rand(-30, 30), b.by - 120, '#f5c542');
    if (b.hp <= 0) { G.dark = null; G.chat = null; b.hp = 0; b.dead = true; b.deathT = 0; b.swatT = 0; b.beamT = 0; b.locked = false; b.aim = null; b.line = null; G.sfx('roar'); G.onBossKilled(b); }
  };

  // línea punteada que "camina" hacia el objetivo (aviso de por dónde va a pasar el ataque)
  function dashed(ctx, x0, y0, x1, y1, col, G, gap = 9, size = 3, speed = 0.6) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(d / gap), o = (G.frame * speed) % gap;
    ctx.fillStyle = col;
    for (let i = 0; i <= n; i++) { const tt = (i * gap + o) / d; if (tt > 1) break; ctx.fillRect(Math.round(x0 + (x1 - x0) * tt - size / 2), Math.round(y0 + (y1 - y0) * tt - size / 2), size, size); }
  }
  function reticle(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.fillRect(x - r, y - 1, r - 2, 2); ctx.fillRect(x + 3, y - 1, r - 2, 2); ctx.fillRect(x - 1, y - r, 2, r - 2); ctx.fillRect(x - 1, y + 3, 2, r - 2); }

  NV.drawBoss = function (ctx, b, G, cx, cy) {
    const X = NV.X, A = G.L.arena, k = ph(b);
    if (b.dropY <= -340 && !b.dropping) return; // todavía no llegó
    // ---------- avisos (debajo del jefe) ----------
    if (!b.dead && b.active) {
      // LÁSER: mira punteada desde las gafas
      if (b.atk === 'laser' && b.aim && b.beamT === 0) {
        const L0 = pt(b, LENS), e = b.locked ? b.end : beamEnd(L0, b.aim.x, b.aim.y, A);
        const left = BC.LASER_TRACK[k] + BC.LASER_LOCK[k] - b.atkT;
        const urgent = b.locked && left < 24, on = !urgent || (G.frame >> 1) % 2;
        if (on) {
          ctx.save(); ctx.globalAlpha = b.locked ? 1 : 0.55;
          dashed(ctx, L0.x - cx, L0.y - cy, e.x - cx, e.y - cy, b.locked ? '#ff2e4a' : '#ff9aa8', G, b.locked ? 8 : 12, b.locked ? 3 : 2, b.locked ? 1.2 : 0.5);
          if (b.locked) { ctx.globalAlpha = 0.9; reticle(ctx, Math.round(e.x - cx), Math.round(e.y - cy), 9 + (left > 0 ? Math.round(left / 8) : 0), '#ffffff'); X.rect(e.x - cx - 12, e.y - cy - 1, 24, 2, '#ff2e4a'); }
          ctx.restore();
        }
      }
      // CAÑÓN: línea(s) de tiro fijas
      if (b.atk === 'cannon' && b.line && b.shots < BC.CANNON_SHOTS[k]) {
        const M = pt(b, MUZZLE), n = BC.CANNON_SHOTS[k];
        ctx.save(); ctx.globalAlpha = 0.85;
        for (let i = b.shots; i < n; i++) {
          const a = b.line.a + (n === 3 ? (i - 1) * 0.13 : 0), e = beamEnd(M, M.x + Math.cos(a) * 50, M.y + Math.sin(a) * 50, A);
          dashed(ctx, M.x - cx, M.y - cy, e.x - cx, e.y - cy, i === b.shots ? '#ffd23d' : '#ff8a3d', G, 10, 3, 1);
          if (i === b.shots) reticle(ctx, Math.round(e.x - cx), Math.round(e.y - cy), 8, '#ffd23d');
        }
        ctx.restore();
      }
    }
    // COHETES: marca en el piso + línea punteada de caída + el cohete bajando al final
    for (const r of b.rockets) {
      const sx = Math.round(r.x - cx), sy = Math.round(r.land - cy), left = r.warn - r.t, col = r.green ? '#33e07a' : '#ff2e4a';
      const blink = left < 26 ? (G.frame >> 1) % 2 : (G.frame >> 3) % 2;
      ctx.save();
      ctx.globalAlpha = 0.5; dashed(ctx, sx, 40, sx, sy, col, G, 12, 2, 1.5);
      ctx.globalAlpha = 0.22 + (blink ? 0.2 : 0); ctx.fillStyle = col; ctx.fillRect(sx - 21, sy - 3, 42, 3);       // zona de la explosión
      ctx.globalAlpha = 1; X.rect(sx - 21, sy - 1, 42, 1, blink ? '#ffffff' : col); X.rect(sx - 21, sy - 5, 1, 5, col); X.rect(sx + 20, sy - 5, 1, 5, col);
      const rr = 6 + Math.round((left / r.warn) * 22); NV.ring(ctx, sx, sy - 2, rr, blink ? '#ffffff' : col);     // anillo que se cierra
      ctx.restore();
      if (left < 30) { const yy = -30 + ((30 - left) / 30) * (r.land - cy + 30 - 8); X.spr('rocket', (G.frame >> 2) & 1, sx, yy + 10); for (let j = 1; j < 4; j++) { ctx.globalAlpha = 0.3 - j * 0.08; X.rect(sx - 2, yy - 12 - j * 9, 4, 8, '#ffd23d'); } ctx.globalAlpha = 1; }
    }
    // ---------- la bolsa con los parlantes robados, detrás del jefe ----------
    drawBag(ctx, b, G, cx, cy);
    // ---------- el jefe ----------
    const by = b.by + (b.dropY || 0) - cy, bx = b.cx - cx;
    const breathe = b.dead || !b.landed ? 1 : 1 + Math.sin(G.frame * 0.07) * 0.012 + (b.active && G.phase < 0.12 ? 0.012 : 0);
    const o = { flash: b.flash > 0 || (b.dead && b.deathT < SHATTER_T && (G.frame >> 1) % 2 === 0 && b.deathT % 14 < 4), sy: breathe };
    if (b.dead && b.deathT >= SHATTER_T) { drawShards(ctx, b, cx, cy); return; }
    if (b.dead) { o.sx = 1 + Math.sin(b.deathT * 1.3) * 0.015 * (b.deathT / SHATTER_T); } // tiembla antes de estallar
    const m = b.mixT > 0 ? midOf(b.prev, b.frame) : -1;
    if (m >= 0) X.boss(m, bx, by, o);                     // cuadro intermedio generado
    else if (b.mixT > 0) { o.next = b.frame; o.mix = 1 - b.mixT / (b.mixMax || 6); X.boss(b.prev, bx, by, o); }
    else X.boss(b.frame, bx, by, o);
    if (b.dropping && !b.landed) { ctx.save(); ctx.globalAlpha = 0.35; for (let j = 1; j < 4; j++) X.boss(b.frame, bx, by - j * 26, { alpha: 0.28 - j * 0.07 }); ctx.restore(); } // estela de la caída
    if (b.dead) return;
    // núcleo del pecho en el descanso (doble daño)
    if (b.atk === 'rest' && b.active) { const c = pt(b, CORE); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#9dffbf'; ctx.globalAlpha = 0.45 + 0.4 * Math.sin(G.frame * 0.4); NV.Input.circ(ctx, c.x - cx, c.y - cy, 9); ctx.restore(); if ((G.frame >> 4) % 2) X.text('¡DOBLE DAÑO!', bx - 10, by - 132, { align: 'center', color: '#f5c542', outline: true }); }
    // brillo de las gafas (más fuerte cuando carga el láser)
    if (b.landed) {
      const l = pt(b, b.atk === 'laser' ? LENS : GLOW), charge = b.atk === 'laser' ? (b.locked ? 1 : 0.5) : 0;
      const r = 9 + charge * 9 + (k ? 3 : 0) + Math.sin(G.frame * 0.3) * 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(l.x - cx, l.y - cy, 0, l.x - cx, l.y - cy, r);
      g.addColorStop(0, charge ? 'rgba(255,90,90,.75)' : 'rgba(77,226,255,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(l.x - cx - r, l.y - cy - r, r * 2, r * 2); ctx.restore();
    }
    // ---------- RAYO: dos haces (rojo y verde) que salen de las gafas y llegan al punto fijado ----------
    if (b.beamT > 0 && b.end) {
      const L0 = pt(b, LENS), e = b.end, wob = (G.frame & 1) ? 1 : 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      beam(ctx, L0.x - 3 - cx, L0.y - cy, e.x - 4 - cx, e.y - cy, 7 + wob, '#ff2e4a', 0.55); beam(ctx, L0.x + 3 - cx, L0.y - cy, e.x + 4 - cx, e.y - cy, 7 + wob, '#33e07a', 0.55);
      beam(ctx, L0.x - cx, L0.y - cy, e.x - cx, e.y - cy, 3, '#ffffff', 1);
      ctx.restore();
      X.rect(e.x - 12 - cx, e.y - 3 - cy, 24, 3, '#ffffff');
    }
  };
  // ===================== CORTES DE LUZ + CARTEL DEL ROBO-GRINCH =====================
  // NV.lightsOut(G, cuadros, frase): aparece el cartel tipo chat con la cara enojada del Robo-Grinch,
  // dice la frase y corta la luz: queda un círculo de luz alrededor del DJ. Después la luz vuelve sola.
  // Oscurece solo el escenario: enemigos, jefe, ataques y avisos se dibujan encima y se ven siempre.
  const CHAT_LEAD = 60; // cuadros entre que aparece el cartel y se corta la luz
  NV.lightsOut = function (G, len, line) {
    G.chat = line ? { line, t: 0, life: CHAT_LEAD + 120 } : null; // sin frase: corta la luz sin cartel
    G.dark = { t: -CHAT_LEAD, len };
    G.sfx('alarm');
  };
  NV.updateDark = function (G) {
    if (G.chat && ++G.chat.t > G.chat.life) G.chat = null;
    const d = G.dark; if (!d) return;
    d.t++;
    if (d.t === 0) { G.sfx('blackout'); G.shake(5); G.vib(60); }
    if (d.t === d.len - 24) G.sfx('heal');
    if (d.t >= d.len) { G.dark = null; FX.text(G, '¡VOLVIÓ LA LUZ!', G.player.x + 7, G.player.y - 14, '#f5c542', 1, 60); }
  };
  NV.drawBlackout = function (ctx, G, cx, cy) {
    const d = G.dark; if (!d || d.t < 0) return;
    const t = d.t, left = d.len - t;
    if (t < 36 && (t >> 2) % 2) return;                 // parpadeo al cortarse
    if (left < 30 && (left >> 2) % 2 === 0) return;     // parpadeo cuando vuelve
    const p = G.player, W = NV.X.W, px = p.x + 7 - cx, py = p.y + 16 - cy;
    const g = ctx.createRadialGradient(px, py, 36, px, py, 170);
    g.addColorStop(0, 'rgba(2,2,10,0)'); g.addColorStop(1, 'rgba(2,2,10,.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 360);
  };
  // cartel tipo chat: entra deslizando desde arriba, cara enojada (cuadro en que grita), nombre y la frase escribiéndose
  const ease2 = (v) => 1 - Math.pow(1 - U.clamp(v, 0, 1), 3);
  NV.drawGrinchChat = function (ctx, G) {
    const c = G.chat; if (!c) return;
    const X = NV.X, W = X.W, B = BD(), t = c.t, out = c.life - t;
    const k = Math.min(ease2(t / 14), ease2(out / 14));
    const bw = Math.min(W - 24, 420), bh = 58, bx = Math.round(W / 2 - bw / 2), by = Math.round(-bh - 8 + k * (bh + (G.bossOn ? 74 : 50))); // en la pelea, debajo de la barra de vida del jefe
    X.panel(bx, by, bw, bh, { fill: 'rgba(14,4,8,.95)', border: '#ff2e4a', light: '#ff9aa8', snow: false });
    // cara enojada: recorte de la cabeza del cuadro en que grita, temblando mientras habla
    const f = FR('laser', 4), sx = (f % B.cols) * B.w + B.w / 2 - 30, sy = Math.floor(f / B.cols) * B.h + 50, jit = t < CHAT_LEAD && (t >> 1) % 2 ? 1 : 0;
    X.rect(bx + 6, by + 6, 46, 46, '#3a0a12');
    ctx.save(); ctx.beginPath(); ctx.rect(bx + 6, by + 6, 46, 46); ctx.clip();
    ctx.drawImage(X.img.robogrinch, sx, sy, 50, 48, bx + 4 + jit, by + 5, 50, 48);
    ctx.restore();
    X.rect(bx + 6, by + 51, 46, 1, '#ff2e4a');
    X.text(NV.BOSS_NAME, bx + 60, by + 9, { color: '#ff2e4a' });
    if ((G.frame >> 3) % 2) X.rect(bx + 60 + X.measure(NV.BOSS_NAME, 1) + 6, by + 10, 5, 5, '#ff2e4a'); // punto "en vivo"
    const n = Math.min(c.line.length, Math.floor(t / 2));
    X.text(c.line.slice(0, n), bx + 60, by + 26, { scale: 2, color: '#ffffff', maxW: bw - 68, fancy: true });
    if (t > 1 && t < c.line.length * 2 && (t & 3) === 0) NV.Audio.sfx('move');
  };
  // BOLSA DE PARLANTES ROBADOS: está detrás de Robo-Grinch toda la pelea. Late con el bajo; cuando el jefe
  // cae, rebota al ritmo y suelta notas (la fiesta recupera sus parlantes).
  function drawBag(ctx, b, G, cx, cy) {
    const X = NV.X, A = G.L.arena; if (!A.bagX || !X.img.bag || !X.img.bag.ok) return;
    const x = Math.round(A.bagX - cx), y = Math.round(A.floorY - 64 - cy), free = b.dead && b.deathT > SHATTER_T;
    const hop = free ? Math.round(Math.abs(Math.sin(G.beatPos * Math.PI)) * -5) : 0;
    const sq = 1 + G.bass * (free ? 0.07 : 0.03);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 26, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (free || b.atk === 'rest') { // brillo rojo detrás
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 48);
      g.addColorStop(0, free ? 'rgba(255,210,61,.35)' : 'rgba(255,46,74,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 50, y - 80, 100, 100); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y + hop); ctx.scale(1 / Math.sqrt(sq), sq); X.spr('bag', 0, 0, 0); ctx.restore();
    if (free && G.frame % 14 === 0) FX.text(G, '♪', A.bagX + U.rand(-20, 20), A.floorY - 70, U.pick(['#ffd23d', '#33e07a', '#ff2e4a', '#4de2ff']), 1, 40);
  }
  // pedazos del jefe después de estallar (cada uno es un bloque de 5x5 del último cuadro de la muerte)
  function drawShards(ctx, b, cx, cy) {
    if (!b.shards) return;
    const X = NV.X, S = BD().shatter.b, img = X.img.robogrinch, wht = X.white.robogrinch;
    for (const p of b.shards) {
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 24);
      ctx.translate(Math.round(p.x - cx + S / 2), Math.round(p.y - cy + S / 2)); ctx.rotate(p.r);
      ctx.drawImage(p.hot > 0 ? wht : img, p.sx, p.sy, S, S, -S / 2, -S / 2, S, S);
      ctx.restore();
    }
  }
  function beam(ctx, x0, y0, x1, y1, w, c, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(Math.round(x0), Math.round(y0)); ctx.lineTo(Math.round(x1), Math.round(y1)); ctx.stroke(); ctx.globalAlpha = 1;
  }
})();
