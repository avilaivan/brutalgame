// =====================================================================
//  ESCENARIO: ciudad nevada con neón + luces de boliche audio-rítmicas
//  (cabezales móviles, láseres, guirnaldas y bafles que laten con la canción)
// =====================================================================
(function () {
  const S = {}; const T = NV.T;
  const COLS = ['#ff2e4a', '#4de2ff', '#ff4fd8', '#33e07a', '#f5c542', '#7a5cff'];
  const ci = (n, len = COLS.length) => COLS[(((Math.floor(n) % len) + len) % len)];
  let snow = [];
  S.init = function () {
    snow = []; for (let i = 0; i < 150; i++) snow.push({ x: Math.random() * 800, y: Math.random() * 360, s: 0.3 + Math.random(), z: 0.3 + Math.random() * 0.7 });
  };
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

  function rep(ctx, img, f, y, camX, W) {
    const w = img.width; let ox = -((camX * f) % w); if (ox > 0) ox -= w;
    for (let x = ox; x < W; x += w) ctx.drawImage(img, Math.round(x), y);
    return ox;
  }

  S.drawBack = function (ctx, G, camX) {
    const X = NV.X, I = X.img, W = X.W, A = NV.Audio, LD = window.ART_DATA.lights;
    const bass = G.bass, beat = G.beat;
    for (let x = 0; x < W; x += 640) ctx.drawImage(I.sky, x, 0);
    // resplandor del cielo con los graves
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.08 + bass * 0.12;
    const g = ctx.createLinearGradient(0, 200, 0, 360); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, ci(beat >> 2));
    ctx.fillStyle = g; ctx.fillRect(0, 200, W, 160); ctx.restore();
    // láseres en el cielo en los momentos de más energía
    if (G.onset > 0.55 && bass > 0.5) drawSkyLasers(ctx, G, W);
    const fo = rep(ctx, I.far, 0.12, 60, camX, W);
    // antenas que titilan
    if ((beat & 1) === 0) for (const [bx, by] of LD.far_blink) { for (let ox = fo; ox < W; ox += I.far.width) { const x = ox + bx; if (x > -2 && x < W) X.rect(x, 60 + by, 2, 2, '#ff2e4a'); } }
    const mo = rep(ctx, I.mid, 0.25, 30, camX, W);
    // neones y lamparitas del cartel BRUTAL. al ritmo
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let ox = mo; ox < W; ox += I.mid.width) {
      for (const n of LD.mid_neon) {
        const x = ox + n.x; if (x > W || x + n.w < 0) continue;
        ctx.globalAlpha = 0.06 + bass * 0.22; ctx.fillStyle = { CY: '#4de2ff', PK: '#ff4fd8', G: '#33e07a', W: '#ffffff', R: '#ff2e4a' }[n.c] || '#fff';
        ctx.fillRect(Math.round(x - 3), 30 + n.y - 3, n.w + 6, n.h + 6);
      }
    }
    ctx.restore();
    for (let ox = mo; ox < W; ox += I.mid.width) LD.mid_bulbs.forEach(([bx, by], i) => {
      const x = ox + bx; if (x < -3 || x > W) return;
      const on = (((i + beat) % 3) + 3) % 3 !== 0; X.rect(x - 1, 30 + by - 1, 3, 3, on ? ci(i + (beat >> 1), 5) : '#2a2238');
    });
    const no = rep(ctx, I.near, 0.55, 0, camX, W);
    // pantallas de las consolas
    for (let ox = no; ox < W; ox += I.near.width) for (const [sx, sy, sw, sh] of LD.near_consoles) {
      const x = ox + sx; if (x > W || x + sw < 0) continue;
      for (let r = 0; r < 3; r++) { const w = ((hash(sx, r + (beat >> 1)) % (sw - 6)) | 0) + 4; X.rect(x + 2, sy + 3 + r * 5, w, 2, '#ff8a3d'); }
    }
    // Durante la partida la ciudad del fondo va más oscura: así el piso, las plataformas y los personajes
    // resaltan. Las luces de boliche, láseres y guirnaldas se dibujan DESPUÉS, así que quedan igual de brillantes.
    if (G.state === 'play' && NV.CFG.BG_DIM > 0) { ctx.fillStyle = 'rgba(4,3,12,' + NV.CFG.BG_DIM + ')'; ctx.fillRect(0, 0, W, 360); }
    S.drawDisco(ctx, G); // la luna disco, en el lugar de la luna del cielo; va después del oscurecido para que brille
  };

  // ===================== LUNA DISCO (reemplaza a la luna) =====================
  // Esfera de espejitos en 8-bit en el lugar exacto de la luna del cielo: gira, cada faceta refleja la luz según
  // hacia dónde mira, algunas destellan al ritmo y tiene el halo suave que tenía la luna.
  const DR = 20, DS = DR * 2 + 2;
  let discoCv = null, discoCtx = null;
  function discoSphere(G) {
    if (!discoCv) { discoCv = document.createElement('canvas'); discoCv.width = discoCv.height = DS; discoCtx = discoCv.getContext('2d'); }
    const g = discoCtx, t = G.frame / 60, rot = t * 0.9, beat = G.beat, bp = G.beatPos || 0;
    g.clearRect(0, 0, DS, DS);
    const NL = 14, NT = 9;                                  // facetas: 14 a lo ancho (por media vuelta) y 9 de alto
    const L = [-0.55, -0.6, 0.58];                          // luz desde arriba a la izquierda
    for (let py = 0; py < DS; py++) for (let px = 0; px < DS; px++) {
      const nx = (px + 0.5 - DS / 2) / DR, ny = (py + 0.5 - DS / 2) / DR, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lon = Math.atan2(nx, nz) + rot, lat = Math.asin(ny);
      const fu = ((lon / Math.PI) * NL % NL + NL) % NL, fv = (lat / Math.PI + 0.5) * NT;
      const iu = Math.floor(fu), iv = Math.floor(fv), du = fu - iu, dv = fv - iv;
      let c;
      if (du < 0.14 || dv < 0.14) c = '#1c1d2c';                       // junta entre espejitos
      else {
        const lit = Math.max(0, -(nx * L[0] + ny * L[1]) + nz * L[2]);
        const h = ((iu * 73 + iv * 151) % 97) / 97;
        const flash = (h * 7.3 + bp * 0.5) % 1;
        if (flash < 0.07 && lit > 0.15) c = COLS[(iu + iv + beat) % COLS.length];   // destello de color
        else if (flash > 0.93 && lit > 0.35) c = '#ffffff';
        else { const k = Math.min(1, 0.22 + lit * 0.9 + (h - 0.5) * 0.25); const v = Math.round(60 + k * 175); c = 'rgb(' + (v - 8) + ',' + (v - 4) + ',' + Math.min(255, v + 18) + ')'; }
      }
      g.fillStyle = c; g.fillRect(px, py, 1, 1);
    }
    // borde oscuro de 1 píxel (lectura 8-bit)
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#0b0a12'; g.beginPath(); g.arc(DS / 2, DS / 2, DR + 1, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over';
    return discoCv;
  }
  S.drawDisco = function (ctx, G) {
    const W = NV.X.W, X = NV.X, t = G.frame, bass = G.bass || 0;
    for (let ox = 0; ox < W; ox += 640) {          // el cielo se repite cada 640 px, la luna iba en (520, 62)
      const cx = ox + 520, cy = 54; if (cx - 40 > W) continue;
      // halo suave, como el de la luna
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(cx, cy, DR * 0.8, cx, cy, DR * 2.1);
      halo.addColorStop(0, 'rgba(190,205,255,' + (0.16 + bass * 0.06) + ')'); halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo; ctx.fillRect(cx - 44, cy - 44, 88, 88); ctx.restore();
      ctx.drawImage(discoSphere(G), cx - DS / 2, cy - DS / 2);
      // destellos: crucecitas 8-bit que titilan sobre la bola
      for (let i = 0; i < 3; i++) {
        const ph = (t + i * 29) % 58; if (ph > 12) continue;
        const k = Math.round(ph < 6 ? ph / 2 : (12 - ph) / 2), a = i * 2.3 + Math.floor((t + i * 29) / 58) * 1.9;
        const sx = Math.round(cx + Math.cos(a) * DR * 0.55), sy = Math.round(cy + Math.sin(a) * DR * 0.5);
        X.rect(sx - k, sy, k * 2 + 1, 1, '#ffffff'); X.rect(sx, sy - k, 1, k * 2 + 1, '#ffffff');
      }
    }
  };

  // PLATAFORMAS CON EL NEÓN DEL DJ: la nieve de arriba queda blanca; la base toma el color del personaje
  // (rojo Ivan, azul BB Hades, verde Matias). Se arma una copia de la hoja de tiles por partida.
  S.setHero = function (key) {
    const src = NV.X.img.tiles, h = NV.HEROES[key]; if (!src || !h) { S.tiles = null; return; }
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const R = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
    // plataformas flotantes (tile 6): base completa de neón
    const px = 6 * 16;
    R(px, 4, 16, 12, h.dark); R(px, 4, 16, 1, h.light); R(px, 5, 16, 3, h.color); R(px, 8, 16, 1, '#0b0a12');
    for (let x = 1; x < 16; x += 4) { R(px + x, 11, 2, 2, h.color); R(px + x, 11, 1, 1, h.light); }
    R(px, 15, 16, 1, '#0b0a12');
    // piso (tiles 0-2): filo de neón debajo de las lucecitas
    for (let t = 0; t < 3; t++) { R(t * 16, 9, 16, 1, h.color); R(t * 16, 10, 16, 1, h.dark); }
    S.tiles = c; chunks.clear();
  };

  function drawSkyLasers(ctx, G, W) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * G.onset;
    const bp = G.beatPos;
    for (let i = 0; i < 6; i++) {
      const ox = i < 3 ? 0 : W, a = (i < 3 ? -0.2 : Math.PI + 0.2) + Math.sin(bp * 0.8 + i) * 0.35 * (i < 3 ? 1 : -1);
      ctx.strokeStyle = ci(i + (G.beat >> 2)); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, 250); ctx.lineTo(ox + Math.cos(a) * 900, 250 + Math.sin(a) * 900); ctx.stroke();
    }
    ctx.restore();
  }

  // Cabezales móviles colgados de un truss: barren el escenario al ritmo
  const cones = {};
  function cone(col) {
    if (cones[col]) return cones[col];
    const c = document.createElement('canvas'); c.width = 320; c.height = 88; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 320, 0); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 44); g.lineTo(320, 0); g.lineTo(320, 88); g.closePath(); g.fill();
    return (cones[col] = c);
  }
  S.drawLights = function (ctx, G, camX) {
    const X = NV.X, W = X.W;
    const bass = G.bass, bp = G.beatPos, beat = G.beat;
    const off = -((camX * 0.9) % 128);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let i = 0;
    for (let x = off - 64; x < W + 64; x += 128, i++) {
      const id = Math.floor((camX * 0.9 + x) / 128);
      const lx = x + 10, ly = 66;
      const I = G.intensity || 0;
      const ang = Math.PI / 2 + Math.sin((bp * Math.PI) / (2 - I) + id * 1.7) * (0.55 + I * 0.3);
      const half = 18 + bass * 26 + I * 14;
      const col = ci(id + (beat >> 2));
      ctx.globalAlpha = Math.min(0.75, 0.12 + bass * 0.3 + G.onset * 0.15 + I * 0.15);
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang); ctx.scale(1, half / 44); ctx.drawImage(cone(col), 0, -44); ctx.restore();
      // mancha de luz en el piso
      const fy = NV.GR * 16 - G.camY; const t = (fy - ly) / Math.max(0.1, Math.sin(ang)); const fx = lx + Math.cos(ang) * t;
      ctx.globalAlpha = 0.12 + bass * 0.2; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(Math.round(fx), fy, 22 + bass * 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  // LÁSERES DE ESCENARIO: abanicos que barren al ritmo; aparecen y se multiplican a medida que avanza la fiesta
  S.drawLasers = function (ctx, G) {
    const I = G.intensity || 0, drop = G.drop > 0;
    if (I < 0.2 && !drop) return;
    const W = NV.X.W, bp = G.beatPos, n = drop ? 10 : Math.round(2 + I * 8), pw = Math.min(1, (I - 0.2) * 2 + G.bass * 0.6 + (drop ? 1 : 0));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) { // dos emisores en el truss
      const ox = k ? W * 0.78 : W * 0.22, oy = 70;
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * (0.16 + I * 0.06) + Math.sin(bp * Math.PI / 2 + k * 2) * (0.5 + I * 0.4);
        ctx.globalAlpha = 0.28 * pw; ctx.strokeStyle = ci(i + (G.beat >> 1) + k * 3);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 520, oy + Math.sin(a) * 520); ctx.stroke();
      }
    }
    ctx.restore();
  };
  // niebla de colores al nivel del público, late con los graves
  S.drawHaze = function (ctx, G) {
    const I = G.intensity || 0; if (I < 0.1) return;
    const W = NV.X.W; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.06 + G.bass * 0.12) * I; ctx.drawImage(hazeImg(ci(G.beat >> 2)), 0, 230, W, 130); ctx.restore();
  };
  const hazes = {};
  function hazeImg(col) {
    if (hazes[col]) return hazes[col];
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (hazes[col] = c);
  }
  // ESTROBOSCÓPICO: flashes blancos en los golpes fuertes cuando la fiesta está a full (se apaga con "destellos")
  S.drawStrobe = function (ctx, G) {
    if (!NV.OPT.fx) return;
    const I = G.intensity || 0, drop = G.drop > 0;
    const on = (drop && G.frame % 6 < 2) || (I > 0.6 && G.onset > 0.6 && G.phase < 0.08 && (G.beat & 1) === 0);
    if (!on) return;
    ctx.save(); ctx.globalAlpha = drop ? 0.18 : 0.1; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, NV.X.W, 360); ctx.restore();
  };

  S.drawTruss = function (ctx, G, camX) {
    const X = NV.X, W = X.W;
    const toff = -((camX * 0.9) % 32);
    for (let x = toff - 32; x < W; x += 32) ctx.drawImage(X.img.deco_truss, Math.round(x), 44);
    const off = -((camX * 0.9) % 128);
    for (let x = off - 64; x < W + 64; x += 128) X.spr('movinghead', 0, x + 10, 72);
  };

  // Tiles: el nivel no cambia, así que se dibuja en bloques de 256 px la primera vez que aparecen
  // y después cada bloque es 1 drawImage (antes: ~900 drawImage por cuadro). Se guardan pocos bloques
  // para no gastar memoria en celulares. El portón del jefe se dibuja aparte porque titila.
  const CHW = 256, chunks = new Map(), MAXCH = 8;
  function tileIdx(L, tx, ty, v) {
    if (v === T.SOLID) {
      const above = ty > 0 ? L.t[(ty - 1) * L.w + tx] : 0;
      if (above !== T.SOLID && above !== T.CRATE) return hash(tx, 1) % 7 === 0 ? 2 : hash(tx, 2) % 2;
      const ab2 = ty > 1 ? L.t[(ty - 2) * L.w + tx] : 0; return (ab2 === T.SOLID && ty > NV.GR + 1) ? 7 : [3, 3, 3, 4, 5][hash(tx, ty) % 5];
    }
    return v === T.ONEWAY ? 6 : v === T.CRATE ? 9 : -1;
  }
  function chunk(L, ci) {
    let m = chunks.get(L); if (!m) { chunks.clear(); m = new Map(); chunks.set(L, m); }
    if (m.has(ci)) { const c = m.get(ci); m.delete(ci); m.set(ci, c); return c; } // LRU
    const c = document.createElement('canvas'); c.width = CHW; c.height = L.h * 16; const g = c.getContext('2d');
    const tiles = S.tiles || NV.X.img.tiles, tx0 = ci * (CHW / 16);
    for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx < Math.min(L.w, tx0 + CHW / 16); tx++) {
      const v = L.t[ty * L.w + tx]; if (!v) continue; const idx = tileIdx(L, tx, ty, v);
      if (idx >= 0) g.drawImage(tiles, idx * 16, 0, 16, 16, (tx - tx0) * 16, ty * 16, 16, 16);
    }
    m.set(ci, c); if (m.size > MAXCH) m.delete(m.keys().next().value);
    return c;
  }
  // PISO de los menús: el mismo piso nevado del juego, a la misma altura (ahí pegan las luces)
  S.drawMenuFloor = function (ctx, G, camX) {
    const tiles = NV.X.img.tiles, W = NV.X.W, top = NV.GR * 16 - G.camY;
    const x0 = Math.floor(camX / 16) - 1;
    for (let tx = x0; tx <= x0 + Math.ceil(W / 16) + 2; tx++) {
      const sx = Math.round(tx * 16 - camX);
      ctx.drawImage(tiles, (hash(tx, 1) % 7 === 0 ? 2 : hash(tx, 2) % 2) * 16, 0, 16, 16, sx, top, 16, 16);
      for (let ty = 1; top + ty * 16 < 360; ty++) ctx.drawImage(tiles, (ty > 1 ? 7 : [3, 3, 3, 4, 5][hash(tx, ty) % 5]) * 16, 0, 16, 16, sx, top + ty * 16, 16, 16);
    }
  };
  S.drawTiles = function (ctx, L, camX, camY) {
    const X = NV.X, W = X.W;
    const c0 = Math.max(0, Math.floor(camX / CHW)), c1 = Math.floor((camX + W) / CHW);
    for (let ci = c0; ci <= c1; ci++) ctx.drawImage(chunk(L, ci), Math.round(ci * CHW - camX), Math.round(-camY));
    if (NV.G.bossOn) { // portón del jefe (animado)
      const tx = L.arena.gateX, sx = Math.round(tx * 16 - camX);
      if (sx > -16 && sx < W) for (let ty = 0; ty < NV.GR; ty++) {
        const sy = Math.round(ty * 16 - camY), a = (NV.G.frame >> 2) % 2;
        X.rect(sx, sy, 16, 16, '#1a0006'); X.rect(sx + 3, sy, 2, 16, a ? '#ff2e4a' : '#ff9aa8'); X.rect(sx + 11, sy, 2, 16, a ? '#ff9aa8' : '#ff2e4a');
      }
    }
  };

  // Decoración del nivel (bafles, árboles, consolas, guirnaldas)
  S.drawDeco = function (ctx, G, camX, camY) {
    const X = NV.X, W = X.W, L = G.L, bass = G.bass, beat = G.beat;
    for (const d of L.deco) {
      const img = X.img['deco_' + d.type]; if (!img) continue;
      const sx = Math.round(d.x - camX), sy = Math.round(d.y - camY - img.height);
      if (sx > W || sx + img.width < 0) continue;
      if (d.type !== 'speaker') ctx.drawImage(img, sx, sy);
      if (d.type === 'speaker') {
        // BAFLE dibujado entero acá: caja de 32 px y conos simétricos respecto del centro EXACTO de la caja
        // (la parte de arriba la tapa la tarima, por eso el cuerpo empieza 16 px más abajo). Sin cinta roja.
        const bx = sx, by = sy + 16, bw = 32, bh = img.height - 16, mx = bx + 16;
        X.rect(bx, by, bw, bh, '#2a2e40'); X.rect(bx + 1, by, bw - 2, bh - 1, '#0e0d18'); X.rect(bx + 2, by, bw - 4, 1, '#1c1c2c');
        const cone = (cy, r, ring) => { // círculo de diámetro par centrado entre los píxeles 15 y 16
          for (let y = 0; y < r; y++) { const w = Math.round(Math.sqrt(r * r - (y + 0.5) * (y + 0.5))); ctx.fillStyle = ring; ctx.fillRect(mx - w, cy - y - 1, w * 2, 1); ctx.fillRect(mx - w, cy + y, w * 2, 1); }
        };
        const pulse = bass * 2.2;
        for (const [cy, r] of [[by + 13, 6], [by + 33, 10]]) {
          const rr = Math.round(r + pulse);
          cone(cy, rr + 2, '#3a3f5c'); cone(cy, rr, '#08080d'); cone(cy, Math.max(2, Math.round(rr * 0.45)), '#2a2e40'); cone(cy, 2, '#6a7096');
        }
        X.rect(mx - 1, by + bh - 4, 2, 2, NV.G.player ? NV.G.player.hero.color : '#ff2e4a'); // led del color del DJ
      } else if (d.type === 'tree') {
        window.ART_DATA.deco.tree_bulbs.forEach(([bx, by], i) => X.rect(sx + bx, sy + by, 2, 2, (i + beat) % 2 ? ci(i + (beat >> 1), 5) : '#1a2a1a'));
      } else if (d.type === 'console') {
        for (let r = 0; r < 2; r++) X.rect(sx + 6, sy + 13 + r * 5, 6 + (hash(d.x, r + beat) % 18), 2, '#ff8a3d');
      } else if (d.type === 'lamp') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.moveTo(sx + 2, sy + 7); ctx.lineTo(sx - 18, sy + 52); ctx.lineTo(sx + 30, sy + 52); ctx.lineTo(sx + 10, sy + 7); ctx.fill(); ctx.restore();
      }
    }
    // guirnaldas
    for (const g of L.garlands) {
      if (g.x1 - camX < 0 || g.x0 - camX > W) continue;
      let i = 0;
      for (let x = g.x0; x <= g.x1; x += 4, i++) {
        const t = (x - g.x0) / (g.x1 - g.x0), y = g.y + Math.sin(t * Math.PI) * 18;
        X.rect(x - camX, y - camY, 1, 1, '#1c4a2a');
        if (i % 3 === 0) { const k = i / 3; const on = (k + beat) % 2 === 0; X.rect(x - camX - 1, y - camY + 1, 3, 3, on ? ci(k + (beat >> 1), 5) : '#2a2238'); }
      }
    }
  };

  // Color de cada zona: tiñe solo el fondo (no los tiles ni personajes) y cambia suave al avanzar
  const ZONE_TINT = [[120, 200, 255], [245, 197, 66], [255, 46, 74], [51, 224, 122]]; // ruta 5 nevada, centro navideño, autódromo, jefe
  let tint = ZONE_TINT[0].slice();
  S.drawTint = function (ctx, G) {
    const L = G.L, p = G.player; if (!L || !p) return;
    let z = 0; for (let i = 0; i < L.zones.length; i++) if (p.x >= L.zones[i].x) z = i;
    if (G.bossOn) z = 3;
    for (let k = 0; k < 3; k++) tint[k] += (ZONE_TINT[z][k] - tint[k]) * 0.03;
    ctx.save(); ctx.globalAlpha = 0.09;
    ctx.fillStyle = 'rgb(' + tint.map(Math.round).join(',') + ')'; ctx.fillRect(0, 0, NV.X.W, 360); ctx.restore();
  };

  // Público de la fiesta en primer plano: siluetas que saltan al beat, manos arriba con los graves
  // y luces de celulares. Se mueve más rápido que la cámara para dar profundidad.
  // Siluetas del público precalculadas por tipo (fila, cabeza, hombros, gorro/vincha/nada)
  const PH = 16, people = {};
  function person(row, hr, sh, hat) {
    const key = row.s + '|' + hr + '|' + sh + '|' + hat;
    if (people[key]) return people[key];
    const c = document.createElement('canvas'); c.width = sh * 2 + 12; c.height = PH + 44;
    const g = c.getContext('2d'), x = c.width / 2, y = PH;
    const R = (a, b, w, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(a), Math.round(b), w, hh); };
    g.fillStyle = row.col;
    NV.Input.circ(g, x - sh + 4, y + hr + 5, 4); NV.Input.circ(g, x + sh - 4, y + hr + 5, 4); // hombros
    g.fillRect(x - sh, y + hr + 5, sh * 2, 30);  // torso (lo de abajo queda fuera de pantalla)
    g.fillRect(x - 2, y + hr - 2, 5, 8);         // cuello
    NV.Input.circ(g, x, y, hr);                  // cabeza
    if (hat === 1) { // gorro de Papá Noel
      g.fillStyle = row.s === 1 ? '#b3132b' : '#5c0815'; g.beginPath(); g.moveTo(x - hr, y - hr + 2); g.lineTo(x + hr, y - hr + 2); g.lineTo(x + hr + 4, y - hr * 2 - 2); g.closePath(); g.fill();
      const fur = row.s === 1 ? '#f4f8ff' : '#7a86a0'; R(x - hr, y - hr + 1, hr * 2, 2, fur); R(x + hr + 2, y - hr * 2 - 4, 3, 3, fur);
    } else if (hat === 2) { // vincha de reno
      const ac = row.s === 1 ? '#7a4a35' : '#3a2420';
      R(x - hr - 1, y - hr - 5, 2, 6, ac); R(x - hr - 3, y - hr - 5, 2, 2, ac); R(x + hr - 1, y - hr - 5, 2, 6, ac); R(x + hr + 1, y - hr - 5, 2, 2, ac);
    }
    return (people[key] = c);
  }
  S.drawCrowd = function (ctx, G, camX, opts = {}) {
    const X = NV.X, W = X.W, base = opts.y || 364;
    const beat = G.beat, ph = G.phase, bass = G.bass, rim = ci(beat >> 2), hop = (1 - ph) * (1 - ph);
    // fila de atrás (más chica, más lenta, teñida) y fila de adelante (grande, negra)
    for (const row of [{ f: 1.15, sp: 18, s: 0.75, col: '#120e22', seed: 3, dy: -10 }, { f: 1.35, sp: 24, s: 1, col: '#030208', seed: 7, dy: 0 }]) {
      const rims = [];
      const i0 = Math.floor((camX * row.f) / row.sp) - 2;
      for (let i = i0; i < i0 + W / row.sp + 4; i++) {
        const h = hash(i, row.seed), s = row.s;
        const x = Math.round(i * row.sp - camX * row.f + (h % 7));
        const hype = G.hype > 0 || G.drop > 0, jumper = hype || hash(i + row.seed, beat) % (G.intensity > 0.66 ? 2 : 3) === 0;
        const hr = Math.round((6 + (h % 2)) * s), sh = Math.round((10 + (h % 3)) * s); // radio de cabeza, medio ancho de hombros
        const y = base + row.dy - Math.round((30 + (h % 12)) * s) - (jumper ? Math.round(hop * (hype ? 12 : 6) * s) : 0);
        // brazos arriba con los graves (o siempre, para algunos): 2 rectángulos, se mueven con el beat
        const arms = hype || h % 5 === 0 || (bass > 0.45 && h % 3 === 0);
        if (arms) { const up = Math.round(hop * 3); X.rect(x - sh, y - 10 - up, 3, 16, row.col); X.rect(x + sh - 3, y - 10 - up, 3, 16, row.col); }
        // cuerpo + cabeza + gorro: una imagen ya dibujada (antes eran ~40 rectángulos por persona y por cuadro)
        const pc = person(row, hr, sh, h % 3 === 0 ? 1 : h % 7 === 1 ? 2 : 0);
        ctx.drawImage(pc, x - pc.width / 2, y - PH);
        rims.push(x, y, hr, sh, arms ? 1 : 0);
        // celular filmando
        if (h % 9 === 0) { const px = x + sh + 1, py = y - 18; X.rect(px, py, 5, 8, '#1a1a24'); if ((G.frame >> 3) % 5) X.rect(px + 1, py + 1, 3, 5, '#cfe3ff'); }
      }
      // luz de los cabezales en el borde de cabezas y hombros: toda la fila de una vez
      ctx.globalAlpha = row.s === 1 ? 0.9 : 0.5; ctx.fillStyle = rim; const up = Math.round(hop * 3);
      for (let k = 0; k < rims.length; k += 5) {
        const x = rims[k], y = rims[k + 1], hr = rims[k + 2], sh = rims[k + 3];
        ctx.fillRect(x - hr + 2, y - hr, hr * 2 - 3, 1); ctx.fillRect(x - sh + 2, y + hr + 1, 4, 1); ctx.fillRect(x + sh - 6, y + hr + 1, 4, 1);
        if (rims[k + 4]) { ctx.fillRect(x - sh, y - 10 - up, 3, 1); ctx.fillRect(x + sh - 3, y - 10 - up, 3, 1); }
      }
      ctx.globalAlpha = 1;
    }
  };

  // Nieve navideña en 3 profundidades: copos lejanos (1px), medios (2px) y cercanos con forma
  // de cristal (cruz) que brillan de a ratos. Se mueven con el viento y con la cámara.
  S.drawSnow = function (ctx, camX) {
    const W = NV.X.W, wind = Math.sin(performance.now() / 2400) * 0.25;
    snow.forEach((s, i) => {
      s.y += s.s * (0.35 + s.z * 0.5); s.x += wind * s.z; if (s.y > 362) { s.y = -4; s.x = Math.random() * 800; }
      let x = (s.x + Math.sin((s.y + i * 13) * 0.03) * 6 - camX * s.z * 0.45) % W; if (x < 0) x += W;
      const X0 = Math.round(x), Y0 = Math.round(s.y);
      ctx.globalAlpha = 0.4 + s.z * 0.6; ctx.fillStyle = '#f4f8ff';
      if (s.z > 0.82) { // cristal
        ctx.fillRect(X0 - 1, Y0, 3, 1); ctx.fillRect(X0, Y0 - 1, 1, 3);
        if ((i + (performance.now() >> 7)) % 23 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(X0 - 2, Y0, 5, 1); ctx.fillRect(X0, Y0 - 2, 1, 5); }
      } else ctx.fillRect(X0, Y0, s.z > 0.55 ? 2 : 1, s.z > 0.55 ? 2 : 1);
    });
    ctx.globalAlpha = 1;
  };

  NV.Stage = S;
})();
