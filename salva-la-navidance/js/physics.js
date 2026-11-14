// Colisiones contra el mapa, partículas y textos flotantes
(function () {
  const T = NV.T;
  const P = {};
  P.move = function (e, L) {
    e.hitL = e.hitR = e.hitCeil = false;
    const was = e.onGround; e.onGround = false;
    e.x += e.vx;
    const ty0 = Math.floor(e.y / 16), ty1 = Math.floor((e.y + e.h - 1) / 16);
    if (e.vx > 0) { const tx = Math.floor((e.x + e.w) / 16); for (let ty = ty0; ty <= ty1; ty++) if (NV.isSolid(NV.tileAt(L, tx, ty))) { e.x = tx * 16 - e.w; e.vx = 0; e.hitR = true; break; } }
    else if (e.vx < 0) { const tx = Math.floor(e.x / 16); for (let ty = ty0; ty <= ty1; ty++) if (NV.isSolid(NV.tileAt(L, tx, ty))) { e.x = (tx + 1) * 16; e.vx = 0; e.hitL = true; break; } }
    const prevB = e.y + e.h;
    e.y += e.vy;
    const tx0 = Math.floor((e.x + 1) / 16), tx1 = Math.floor((e.x + e.w - 2) / 16);
    if (e.vy >= 0) {
      const ty = Math.floor((e.y + e.h) / 16);
      for (let tx = tx0; tx <= tx1; tx++) {
        const v = NV.tileAt(L, tx, ty);
        if (NV.isSolid(v) || (v === T.ONEWAY && prevB <= ty * 16 + 1)) { e.y = ty * 16 - e.h; e.vy = 0; e.onGround = true; break; }
      }
    } else {
      const ty = Math.floor(e.y / 16);
      for (let tx = tx0; tx <= tx1; tx++) if (NV.isSolid(NV.tileAt(L, tx, ty))) { e.y = (ty + 1) * 16; e.vy = 0; e.hitCeil = true; break; }
    }
    e.landed = e.onGround && !was;
  };
  P.groundAt = (L, x, y) => { const v = NV.tileAt(L, Math.floor(x / 16), Math.floor(y / 16)); return NV.isSolid(v) || v === T.ONEWAY; };
  P.solidAt = (L, x, y) => NV.isSolid(NV.tileAt(L, Math.floor(x / 16), Math.floor(y / 16)));
  NV.Phys = P;

  // ---------------- partículas ----------------
  NV.FX = {
    burst(G, x, y, color, n = 8, sp = 2, life = 22, g = 0.05, size = 2) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random());
        G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, color, g, size });
      }
    },
    part(G, o) { G.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, size: 2, life: 20, max: 20, color: '#fff' }, o)); },
    boom(G, x, y, big) { G.booms.push({ x, y, t: 0, big: !!big }); },
    text(G, s, x, y, color = '#fff', scale = 1, life = 50) { G.texts.push({ s, x, y, color, scale, life, max: life }); },
    update(G) {
      for (const p of G.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag || 0.97; p.life--; }
      G.parts = G.parts.filter((p) => p.life > 0);
      for (const b of G.booms) b.t++;
      G.booms = G.booms.filter((b) => b.t < 24);
      for (const t of G.texts) { t.y -= 0.45; t.life--; }
      G.texts = G.texts.filter((t) => t.life > 0);
    },
    draw(ctx, G, cx, cy) {
      for (const p of G.parts) {
        ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
        ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (const b of G.booms) NV.X.spr('boom', Math.floor(b.t / 4), b.x - cx, b.y - cy + 17, { scale: b.big ? 2 : 1 });
    },
    drawTexts(G, cx, cy) {
      // los textos aparecen con un "pop" (crecen y vuelven a su tamaño en 6 cuadros)
      const ctx = NV.X.ctx;
      for (const t of G.texts) {
        const age = t.max - t.life, pop = age < 6 && NV.OPT.fx ? 1 + ((6 - age) / 6) * 0.6 : 1, x = Math.round(t.x - cx), y = Math.round(t.y - cy);
        if (pop > 1) { ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); NV.X.text(t.s, 0, 0, { scale: t.scale, align: 'center', color: t.color, outline: true }); ctx.restore(); }
        else NV.X.text(t.s, x, y, { scale: t.scale, align: 'center', color: t.color, outline: true, alpha: Math.min(1, t.life / 15) });
      }
    },
  };
})();
