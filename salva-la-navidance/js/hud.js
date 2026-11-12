// HUD: cronómetro grande (lo que importa), vidas, B-Coins, progreso del nivel y jefe
(function () {
  const H = {};
  H.draw = function (ctx, G) {
    const X = NV.X, W = X.W, p = G.player, hero = p.hero;
    // ---------- vida ----------
    X.panel(6, 6, 118, 34);
    ctx.drawImage(X.img[p.key + '_face'], 10, 10, 26, 26);
    X.rect(9, 9, 28, 1, hero.color); X.rect(9, 36, 28, 1, hero.color); X.rect(9, 9, 1, 28, hero.color); X.rect(36, 9, 1, 28, hero.color);
    for (let i = 0; i < NV.CFG.HP; i++) X.spr('heart', i < p.hp ? 0 : 1, 49 + i * 15, 25, {});
    X.text(hero.short, 42, 28, { scale: 1, color: hero.light });
    if (p.shield > 0) { const s = Math.ceil(p.shield / 60); X.text('ESCUDO ' + s, 42, 44, { color: '#f5c542', outline: true }); }

    // ---------- cronómetro ----------
    const beatPulse = G.phase < 0.12 ? 1 : 0;
    X.panel(W / 2 - 86, 4, 172, 42, { border: beatPulse ? hero.color : '#3a4466' });
    const t = G.runTime;
    const warn = NV.CFG.TIME_LIMIT - t < 20;
    X.text(NV.U.fmtTime(t), W / 2, 10, { scale: 3, align: 'center', color: warn && (G.frame >> 3) % 2 ? '#ff2e4a' : '#ffffff' });
    const pb = NV.DB.best();
    X.text(pb ? 'TU MEJOR ' + NV.U.fmtTime(pb) : 'TERMINÁ EL NIVEL LO MÁS RÁPIDO POSIBLE', W / 2, 35, { align: 'center', color: '#8ea2c4' });

    // ---------- B-Coins y puntos ----------
    X.panel(W - 124, 6, 118, 34);
    X.spr('coin', Math.floor(G.frame / 5), W - 108, 30, { scale: beatPulse ? 1 : 1 });
    X.text('x' + String(G.coinsGot).padStart(3, '0'), W - 96, 12, { scale: 2, color: '#f5c542' });
    X.text(String(G.score).padStart(7, '0'), W - 12, 30, { align: 'right', color: '#cfd8e6' });

    // ---------- progreso del nivel ----------
    if (!G.bossOn) {
      const bw = 172, bx = W / 2 - bw / 2, by = 50;
      X.rect(bx, by, bw, 3, '#1a1e30');
      const prog = NV.U.clamp((p.x) / G.L.arena.x0, 0, 1);
      X.rect(bx, by, Math.round(bw * prog), 3, hero.color);
      for (const c of G.L.checkpoints) X.rect(bx + Math.round((bw * c.x) / G.L.arena.x0) - 1, by - 1, 2, 5, '#8ea2c4');
      X.text('★', bx + bw + 4, by - 3, { color: '#f5c542', shadow: false });
    } else if (G.boss) {
      const b = G.boss, bw = 200, bx = W / 2 - bw / 2, by = 52;
      X.text('CYBER-GRINCH', bx, by - 1, { color: '#7cff4d', outline: true });
      X.panel(bx, by + 9, bw, 10, { light: false });
      const fw = Math.round((bw - 4) * b.hp / b.maxHp);
      X.rect(bx + 2, by + 11, fw, 6, b.phase === 2 ? '#ff2e4a' : '#7cff4d'); X.rect(bx + 2, by + 11, fw, 1, '#ffffff');
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
