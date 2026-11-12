// HUD: cronómetro grande (lo que importa), vidas, B-Coins, progreso del nivel y jefe
(function () {
  const H = {};
  H.draw = function (ctx, G) {
    const X = NV.X, W = X.W, p = G.player, hero = p.hero;
    // ---------- vida ----------
    // al perder vida el panel tiembla y el corazón perdido parpadea
    if (G.lastHp !== undefined && p.hp < G.lastHp) G.hpLost = 24;
    G.lastHp = p.hp;
    const hs = G.hpLost > 0 ? Math.round(Math.sin(G.hpLost * 1.7) * (G.hpLost / 8)) : 0;
    X.panel(6 + hs, 6, 118, 54, { border: G.hpLost > 0 && (G.hpLost >> 2) % 2 ? '#ff2e4a' : undefined });
    ctx.drawImage(X.img[p.key + '_face'], 10 + hs, 10, 26, 26);
    X.rect(9 + hs, 9, 28, 1, hero.color); X.rect(9 + hs, 36, 28, 1, hero.color); X.rect(9 + hs, 9, 1, 28, hero.color); X.rect(36 + hs, 9, 1, 28, hero.color);
    for (let i = 0; i < NV.CFG.HP; i++) X.spr('heart', i < p.hp ? 0 : 1, 49 + hs + i * 15, 25, { flash: G.hpLost > 0 && i === p.hp && (G.hpLost >> 1) % 2 });
    if (G.hpLost > 0) G.hpLost--;
    X.text(hero.short, 42 + hs, 28, { scale: 1, color: hero.light });
    // barras: ENERGÍA del dash (cian, con marcas de cada dash) y CALOR del arma (amarillo -> rojo)
    const C = NV.CFG, lx = 10 + hs, bx = lx + 30, bw = 76;
    const bar = (y, v, col, label, lcol, blink) => {
      X.text(label, lx, y - 1, { color: lcol, shadow: false });
      X.rect(bx, y, bw, 5, '#0b0a12'); X.rect(bx + 1, y + 1, bw - 2, 3, '#1a1e30');
      if (!blink || (G.frame >> 2) % 2) { X.rect(bx + 1, y + 1, Math.round((bw - 2) * v / 100), 3, col); X.rect(bx + 1, y + 1, Math.round((bw - 2) * v / 100), 1, '#ffffff'); }
    };
    const en = p.energy !== undefined ? p.energy : 100, ready = en >= C.DASH_COST;
    bar(41, en, ready ? '#4de2ff' : '#1a8fb3', 'DASH', ready ? '#4de2ff' : '#5d6a8a', false);
    for (let k = C.DASH_COST; k < 100; k += C.DASH_COST) X.rect(bx + 1 + Math.round((bw - 2) * k / 100), 42, 1, 3, '#0b0a12');
    const ht = p.heat || 0, hc = p.overheat ? '#ff2e4a' : ht > 70 ? '#ff8a3d' : '#f5c542';
    bar(50, ht, hc, 'ARMA', p.overheat ? '#ff2e4a' : '#f5c542', p.overheat || ht > 80);
    if (p.hp === 1 && !p.dead && !(p.shield > 0) && (G.frame >> 4) % 2) X.text('¡ÚLTIMA VIDA!', 10 + hs, 64, { color: '#ff2e4a', outline: true });
    if (p.shield > 0) { const s = Math.ceil(p.shield / 60); X.text('ESCUDO ' + s, 10, 64, { color: '#f5c542', outline: true }); }

    // ---------- cronómetro ----------
    const beatPulse = G.phase < 0.12 ? 1 : 0;
    X.panel(W / 2 - 96, 4, 192, 50, { border: beatPulse ? hero.color : '#3a4466' });
    const t = G.runTime;
    const warn = NV.CFG.TIME_LIMIT - t < 20;
    X.text(NV.U.fmtTime(t), W / 2, 10, { scale: 3, align: 'center', color: warn && (G.frame >> 3) % 2 ? '#ff2e4a' : '#ffffff' });
    const pb = NV.DB.best();
    const d = G.gDelta;
    if (warn) X.text('¡SE ACABA EL TIEMPO!', W / 2, 34, { align: 'center', color: '#ff2e4a' });
    else if (d !== null && d !== undefined && G.running) X.text('VS RÉCORD ' + (d < 0 ? '-' : '+') + Math.abs(d).toFixed(2), W / 2, 34, { align: 'center', color: d < 0 ? '#33e07a' : '#ff2e4a' });
    else X.text(pb ? 'RÉCORD ' + NV.U.fmtTime(pb) : 'SIN RÉCORD TODAVÍA', W / 2, 34, { align: 'center', color: '#8ea2c4' });

    // ---------- B-Coins y puntos ----------
    X.panel(W - 124, 6, 118, 34);
    // al juntar una B-Coin el contador salta y se pone blanco
    const pop = G.coinPop > 0 ? G.coinPop-- : 0;
    X.spr('coin', Math.floor(G.frame / 5), W - 108, 30, { flash: pop > 4 });
    X.text('x' + String(G.coinsGot).padStart(3, '0'), W - 96, 12 - (pop > 4 ? 2 : 0), { scale: 2, color: pop > 0 ? '#ffffff' : '#f5c542' });
    X.text(String(G.score).padStart(7, '0'), W - 12, 30, { align: 'right', color: '#cfd8e6' });

    // ---------- combo / FIEBRE ----------
    if (G.combo >= 2 && G.comboT > 0) {
      const fev = G.combo >= NV.CFG.FEVER_AT, col = fev ? ['#ff4fd8', '#4de2ff', '#f5c542', '#33e07a'][(G.frame >> 2) % 4] : '#4de2ff';
      X.panel(W - 124, 42, 118, 22, { border: fev ? col : '#3a4466' });
      X.text((fev ? 'FIEBRE x' : 'COMBO x') + G.combo, W - 116, 47, { color: col });
      X.rect(W - 116, 58, Math.round(102 * G.comboT / NV.CFG.COMBO_TIME), 2, col);
    }

    // ---------- progreso del nivel ----------
    if (!G.bossOn) {
      // barra de progreso dentro del panel del reloj: tu posición, la del ghost y los checkpoints
      const bw = 148, bx = W / 2 - bw / 2 - 6, by = 46, ax = G.L.arena.x0;
      X.rect(bx, by, bw, 3, '#1a1e30');
      X.rect(bx, by, Math.round(bw * NV.U.clamp(p.x / ax, 0, 1)), 3, hero.color);
      for (const c of G.L.checkpoints) X.rect(bx + Math.round((bw * c.x) / ax) - 1, by - 1, 2, 5, '#8ea2c4');
      const gs = G.ghost && G.running && G.ghost.f[Math.floor(G.runTime * 30)];
      if (gs) X.rect(bx + Math.round(bw * NV.U.clamp(gs[0] / ax, 0, 1)) - 1, by - 2, 2, 7, '#ffffff');
      X.text('★', bx + bw + 4, by - 4, { color: '#f5c542', shadow: false });
    } else if (G.boss) {
      const b = G.boss, bw = 200, bx = W / 2 - bw / 2, by = 60;
      X.text('MECHA-NOEL', bx, by - 1, { color: '#ff2e4a', outline: true });
      X.panel(bx, by + 9, bw, 10, { light: false });
      const fw = Math.round((bw - 4) * b.hp / b.maxHp);
      G.bossShow = Math.max(b.hp, (G.bossShow === undefined ? b.hp : G.bossShow) - 0.35); // estela blanca del daño reciente
      X.rect(bx + 2, by + 11, Math.round((bw - 4) * G.bossShow / b.maxHp), 6, '#ffffff');
      X.rect(bx + 2, by + 11, fw, 6, b.phase === 2 ? '#ff2e4a' : '#33e07a'); X.rect(bx + 2, by + 11, fw, 1, '#ffffff');
    }

    // ---------- avisos ----------
    if (G.banner) {
      const b = G.banner, a = Math.min(1, b.t / 10, b.life / 12);
      X.text(b.s, W / 2, 96, { scale: b.scale || 2, align: 'center', color: b.color || '#f5c542', outline: true, alpha: a });
      if (b.sub) X.text(b.sub, W / 2, 96 + (b.scale || 2) * 9 + 4, { scale: 1, align: 'center', color: b.subColor || '#ffffff', outline: true, alpha: a });
    }
    NV.Input.draw(ctx);
  };
  NV.HUD = H;
})();
