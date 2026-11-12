// =====================================================================
//  EL NIVEL: "9 DE JULIO EN NAVIDAD" — 3 zonas + arena de Mecha-Noel.
//  Todo está SIEMPRE en el mismo lugar (es una carrera contra el reloj).
// =====================================================================
(function () {
  const T = { EMPTY: 0, SOLID: 1, ONEWAY: 2, CRATE: 3, GATE: 4 };
  const GR = 19; // fila del piso

  function build() {
    const W = 456, H = 23;
    const L = { w: W, h: H, t: new Uint8Array(W * H), enemies: [], coins: [], items: [], checkpoints: [], deco: [], garlands: [], zones: [], signs: [] };
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) L.t[y * W + x] = v; };
    const fill = (x0, y0, x1, y1, v = T.SOLID) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
    const ground = (x0, x1, top = GR) => fill(x0, top, x1, H - 1);
    const block = (x0, x1, top) => fill(x0, top, x1, H - 1);
    const plat = (x0, x1, y) => fill(x0, y, x1, y, T.ONEWAY);
    const coins = (x0, x1, row) => { for (let x = x0; x <= x1; x++) L.coins.push({ x: x * 16 + 8, y: row * 16 + 8 }); };
    const arc = (x0, x1, row, h) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / Math.max(1, x1 - x0); L.coins.push({ x: x * 16 + 8, y: (row - Math.sin(t * Math.PI) * h) * 16 + 8 }); } };
    const en = (type, x, row, o = {}) => L.enemies.push(Object.assign({ type, x: x * 16 + 8, y: row * 16 }, o, o.patrol ? { patrol: [o.patrol[0] * 16, o.patrol[1] * 16] } : {}));
    const item = (type, x, row) => L.items.push({ type, x: x * 16 + 8, y: row * 16 + 8 });
    const cp = (x, label) => L.checkpoints.push({ x: x * 16 + 8, y: GR * 16, label });
    // los bafles (4 tiles de alto) y las consolas (2) se pueden pisar: arriba tienen una tarima
    const deco = (type, x, row) => { L.deco.push({ type, x: x * 16, y: row * 16 }); if (type === 'speaker') plat(x, x + 1, row - 4); if (type === 'console') plat(x, x + 1, row - 2); };
    const garland = (x0, x1, row) => L.garlands.push({ x0: x0 * 16, x1: x1 * 16, y: row * 16 });
    const crates = (x0, x1, top) => fill(x0, top, x1, GR - 1, T.CRATE);

    fill(0, 0, 0, H - 1); // borde izquierdo

    // ================= ZONA 1: TÚNELES CRIOGÉNICOS (0-139) =================
    L.zones.push({ x: 0, name: 'ZONA 1 · RUTA 5 NEVADA' });
    cp(4, 'RUTA 5 · KM 262 · NEVADA');
    ground(0, 35);
    coins(9, 18, 17);
    deco('console', 2, GR); deco('lamp', 20, GR); deco('snow', 14, GR);
    en('patovica', 24, GR, { patrol: [20, 30] });
    block(30, 35, 17); coins(31, 34, 15);
    deco('speaker', 32, 17);
    // salto chico
    ground(39, 63);
    arc(36, 38, 16, 1.5);
    crates(48, 50, 17); en('regalo', 49, 17);
    arc(46, 52, 15, 2);
    deco('console', 42, GR); deco('snow', 56, GR);
    plat(58, 62, 15); coins(58, 62, 13);
    ground(64, 99);
    en('duende', 68, GR);
    en('esfera', 80, 14, { patrol: [76, 86] });
    coins(74, 86, 17);
    deco('lamp', 72, GR); deco('tree', 90, GR);
    garland(64, 76, 6);
    // escalera hacia la meseta
    block(92, 95, 17); block(96, 99, 15);
    ground(100, 139); block(100, 115, 13);
    en('patovica', 108, 13, { patrol: [102, 114] });
    coins(101, 114, 11);
    plat(118, 121, 10); item('mega', 120, 8);
    coins(118, 121, 8);
    deco('speaker', 124, GR); deco('console', 128, GR);
    item('shield', 130, 17);
    coins(124, 136, 17);

    // ================= ZONA 2: TORRES DE NEÓN (140-289) =================
    cp(138, 'ZONA 2 · CENTRO NAVIDEÑO');
    L.zones.push({ x: 140 * 16, name: 'ZONA 2 · CENTRO NAVIDEÑO' });
    ground(140, 160);
    en('regalo', 156, GR);
    deco('lamp', 146, GR); deco('snow', 150, GR);
    plat(162, 165, 17); arc(161, 166, 15, 2);
    ground(167, 186);
    en('patovica', 176, GR, { patrol: [170, 181] });
    block(182, 186, 17); en('duende', 184, 17);
    coins(170, 180, 17);
    // pilares sobre el vacío
    block(189, 190, 17); block(193, 194, 15); block(197, 198, 17);
    coins(189, 190, 15); coins(193, 194, 13); coins(197, 198, 15);
    ground(201, 289);
    en('esfera', 210, 15, { patrol: [205, 214] });
    en('esfera', 220, 13, { patrol: [216, 224] });
    coins(204, 224, 17);
    deco('speaker', 202, GR); deco('tree', 226, GR);
    plat(228, 232, 16); plat(234, 238, 13); plat(240, 245, 10);
    coins(228, 232, 14); coins(234, 238, 11); coins(240, 245, 8);
    item('mega', 247, 8);
    en('patovica', 252, GR, { patrol: [248, 258] });
    block(260, 263, 17); en('regalo', 262, 17);
    garland(248, 262, 7);
    deco('console', 266, GR); deco('lamp', 270, GR);
    coins(266, 276, 17);
    item('heart', 280, 17);
    deco('speaker', 284, GR);

    // ================= ZONA 3: AZOTEA BRUTAL. (290-411) =================
    cp(290, 'ZONA 3 · AUTÓDROMO');
    L.zones.push({ x: 292 * 16, name: 'ZONA 3 · AUTÓDROMO 9 DE JULIO' });
    en('duende', 300, 17); block(298, 301, 17);
    deco('tree', 294, GR); deco('tree', 306, GR);
    block(311, 330, 16);
    en('patovica', 320, 16, { patrol: [313, 328] });
    deco('speaker', 312, 16); deco('speaker', 327, 16);
    coins(314, 328, 14);
    garland(311, 330, 8);
    en('esfera', 338, 14, { patrol: [334, 343] });
    coins(334, 344, 17);
    crates(348, 349, 17); crates(350, 353, 15); en('regalo', 352, 15);
    arc(346, 355, 13, 2);
    ground(290, 360);
    plat(362, 365, 17); arc(361, 366, 15, 2);
    ground(367, 455);
    en('duende', 374, GR);
    en('patovica', 382, GR, { patrol: [377, 388] });
    en('esfera', 392, 13, { patrol: [388, 397] });
    coins(370, 398, 17);
    deco('tree', 370, GR); deco('speaker', 386, GR); deco('tree', 398, GR);
    garland(367, 386, 7); garland(388, 406, 7);
    item('shield', 400, 17); item('heart', 404, 17);
    cp(407, 'JEFE FINAL');
    L.bossDoor = 410 * 16;

    // ================= ARENA DE MECHA-NOEL (412-451) =================
    fill(449, 0, 455, H - 1);                 // pared derecha pegada al jefe: no hay escondite detrás de él
    block(440, 451, 15);                       // tarima de Mecha-Noel
    plat(417, 421, 15); plat(427, 431, 12);    // plataformas para esquivar
    deco('speaker', 413, GR); deco('speaker', 434, GR);
    L.arena = { x0: 412 * 16, x1: 452 * 16, gateX: 411, floorY: GR * 16, bossX: 446 * 16, bossY: 15 * 16 };
    L.coinTotal = L.coins.length + 30;
    return L;
  }

  NV.T = T; NV.GR = GR;
  NV.buildLevel = build;
  NV.tileAt = (L, tx, ty) => (tx < 0 || tx >= L.w ? T.SOLID : ty < 0 || ty >= L.h ? T.EMPTY : L.t[ty * L.w + tx]);
  NV.isSolid = (v) => v === T.SOLID || v === T.CRATE || v === T.GATE;
})();
