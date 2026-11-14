// B-Coins e ítems (las monedas suman puntos; el reloj es lo que manda)
(function () {
  const U = NV.U, C = NV.CFG, FX = NV.FX;
  NV.Coin = (x, y, dyn, shower) => ({ x, y, vx: dyn ? U.rand(-2, 2) : 0, vy: dyn ? U.rand(-4.5, -2.5) : 0, dyn: !!dyn, t: dyn ? 0 : Math.random() * 60, dead: false, shower: !!shower });
  NV.updateCoin = function (c, G) {
    c.t++;
    const p = G.player; const px = p.x + 7, py = p.y + 17;
    if (c.dyn) {
      if (c.t < 22) { c.vy += 0.22; c.x += c.vx; c.y += c.vy; }
      else { const d = Math.hypot(px - c.x, py - c.y) || 1, s = Math.min(9, 2 + c.t * 0.15); c.x += ((px - c.x) / d) * s; c.y += ((py - c.y) / d) * s; }
    } else {
      const d = U.dist(c.x, c.y, px, py);
      if (d < 40) { c.x += (px - c.x) * 0.2; c.y += (py - c.y) * 0.2; }
    }
    if (!p.dead && U.dist(c.x, c.y, px, py) < 15 && (!c.dyn || c.t > 10)) { c.dead = true; G.getCoin(c.x, c.y); }
  };
  NV.drawCoin = function (c, cx, cy, frame) {
    NV.X.spr('coin', Math.floor((c.t + frame) / 5), c.x - cx, c.y - cy + 8 + (c.dyn ? 0 : Math.round(Math.sin(c.t * 0.08) * 1.5)));
  };

  NV.Item = (type, x, y) => ({ type, x, y, t: 0, dead: false });
  NV.updateItem = function (it, G) {
    it.t++;
    const p = G.player;
    if (!p.dead && U.overlap({ x: it.x - 9, y: it.y - 9, w: 18, h: 18 }, NV.playerBox(p))) { it.dead = true; G.getItem(it); }
  };
  NV.drawItem = function (it, cx, cy, G) {
    const bob = Math.round(Math.sin(it.t * 0.08) * 2);
    const name = it.type === 'mega' ? 'mega' : it.type === 'shield' ? 'shield' : 'heart';
    const fr = it.type === 'mega' ? Math.floor(it.t / 7) : it.type === 'shield' ? (it.t >> 4) & 1 : 0;
    const sc = it.type === 'heart' ? 2 : 1;
    if (it.type !== 'heart' || true) { const ctx = NV.X.ctx; ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(it.t * 0.1); ctx.fillStyle = it.type === 'shield' ? '#f5c542' : it.type === 'heart' ? '#ff2e4a' : '#fff3c4'; NV.Input.circ(ctx, it.x - cx, it.y - cy + bob, 13); ctx.restore(); }
    NV.X.spr(name, fr, it.x - cx, it.y - cy + bob + (name === 'heart' ? 11 : name === 'mega' ? 13 : 10), { scale: sc });
  };
})();
