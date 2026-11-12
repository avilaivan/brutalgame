// =====================================================================
//  CONTROLES: teclado, joystick y botones táctiles dibujados en 8-bit
//  En celular hay solo 5 botones: ◀ ▶ (mover), SALTO, DISPARO y DASH.
// =====================================================================
(function () {
  const ACT = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'dash', 'pause', 'confirm', 'back', 'restart'];
  const I = { held: {}, prev: {}, taps: [], isTouch: false, bot: {}, touchOn: false, edges: new Set() };
  ACT.forEach((a) => { I.held[a] = I.prev[a] = false; });
  const key = {}, pad = {}, touch = {};
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'shoot', KeyJ: 'shoot', KeyC: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash',
    Escape: 'pause', KeyP: 'pause', Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'back', KeyR: 'restart',
  };
  const typing = () => { const el = document.activeElement; return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'); };
  window.addEventListener('keydown', (e) => {
    if (typing()) return;
    const a = KEYS[e.code]; if (a) { key[a] = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'KeyZ') key.confirm = true;
    NV.Audio && NV.Audio.unlock();
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYS[e.code]; if (a) key[a] = false;
    if (e.code === 'Space' || e.code === 'KeyZ') key.confirm = false;
  });
  window.addEventListener('blur', () => { for (const k in key) key[k] = false; for (const k in touch) touch[k] = false; ptr.clear(); });

  // ---------------- botones táctiles (coordenadas internas) ----------------
  I.layout = function () {
    const W = NV.X.W, H = NV.CFG.H;
    return {
      left: { x: 12, y: H - 82, w: 66, h: 70, label: '◀' },
      right: { x: 86, y: H - 82, w: 66, h: 70, label: '▶' },
      jump: { cx: W - 48, cy: H - 50, r: 36, label: 'SALTO', color: '#b3132b' },
      shoot: { cx: W - 132, cy: H - 40, r: 30, label: 'DISP', color: '#2559d6' },
      dash: { cx: W - 118, cy: H - 116, r: 24, label: 'DASH', color: '#1c9e4f' },
    };
  };
  function hit(px, py) {
    const L = I.layout();
    for (const k of ['left', 'right']) { const b = L[k]; if (px >= b.x - 6 && px <= b.x + b.w + 4 && py >= b.y - 14 && py <= b.y + b.h + 10) return k; }
    for (const k of ['jump', 'shoot', 'dash']) { const b = L[k]; if (Math.hypot(px - b.cx, py - b.cy) <= b.r + 8) return k; }
    if (px < 170 && py > NV.CFG.H - 120) return px < 82 ? 'left' : 'right';
    return null;
  }
  const ptr = new Map();
  function refreshTouch() { for (const k of ['left', 'right', 'jump', 'shoot', 'dash']) touch[k] = false; for (const v of ptr.values()) if (v) touch[v] = true; }
  I.setup = function (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      NV.Audio && NV.Audio.unlock();
      if (e.pointerType === 'touch') I.isTouch = true;
      const p = NV.X.toInternal(e.clientX, e.clientY);
      const b = I.touchOn && I.isTouch ? hit(p.x, p.y) : null;
      if (b) { ptr.set(e.pointerId, b); refreshTouch(); canvas.setPointerCapture(e.pointerId); }
      else I.taps.push(p);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId)) return;
      const cur = ptr.get(e.pointerId);
      if (cur === 'left' || cur === 'right') { const p = NV.X.toInternal(e.clientX, e.clientY); const b = hit(p.x, p.y); if (b === 'left' || b === 'right') { ptr.set(e.pointerId, b); refreshTouch(); } }
    });
    const up = (e) => { if (ptr.delete(e.pointerId)) refreshTouch(); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  function pollPad() {
    for (const k in pad) pad[k] = false;
    const p = navigator.getGamepads ? navigator.getGamepads()[0] : null; if (!p) return;
    const b = (i) => p.buttons[i] && p.buttons[i].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    pad.left = ax < -0.4 || b(14); pad.right = ax > 0.4 || b(15); pad.up = ay < -0.5 || b(12); pad.down = ay > 0.5 || b(13);
    pad.jump = b(0); pad.shoot = b(2) || b(3); pad.dash = b(1) || b(5) || b(7); pad.pause = b(9); pad.restart = b(8); pad.confirm = b(0) || b(9);
  }

  I.update = function () {
    pollPad();
    for (const a of ACT) { I.prev[a] = I.held[a]; I.held[a] = !!(key[a] || pad[a] || touch[a] || I.bot[a]); if (I.held[a] && !I.prev[a]) I.edges.add(a); }
  };
  I.pressed = (a) => I.held[a] && !I.prev[a];
  I.tap = () => I.taps.shift() || null;
  I.clear = () => { I.taps.length = 0; I.edges.clear(); };
  // para menús: cada pulsación se usa una sola vez aunque la pantalla vaya a otra velocidad
  I.edge = (a) => { if (I.edges.has(a)) { I.edges.delete(a); return true; } return false; };
  I.inRect = (t, r) => t && r && t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h;

  // Dibujo de los botones táctiles
  I.draw = function (ctx) {
    if (!I.isTouch || !I.touchOn) return;
    const X = NV.X, L = I.layout();
    ctx.save();
    for (const k of ['left', 'right']) {
      const b = L[k], on = I.held[k];
      // sólidas como los botones redondos: tienen que leerse encima del público
      ctx.globalAlpha = on ? 0.95 : 0.75;
      X.panel(b.x, b.y, b.w, b.h, { fill: on ? 'rgba(255,255,255,.45)' : 'rgba(10,10,22,.85)', border: '#ffffff', light: '#5a6e92' });
      X.text(b.label, b.x + b.w / 2, b.y + b.h / 2 - 10, { scale: 3, align: 'center', color: on ? '#0b0a12' : '#ffffff', shadow: !on });
    }
    for (const k of ['jump', 'shoot', 'dash']) {
      const b = L[k], on = I.held[k];
      ctx.globalAlpha = on ? 0.95 : 0.6;
      ctx.fillStyle = '#0b0a12'; circ(ctx, b.cx, b.cy, b.r + 2);
      ctx.fillStyle = '#ffffff'; circ(ctx, b.cx, b.cy, b.r);
      ctx.fillStyle = on ? '#ffffff' : b.color; circ(ctx, b.cx, b.cy, b.r - 3);
      X.text(b.label, b.cx, b.cy - 4, { scale: b.r > 30 ? 2 : 1, align: 'center', color: on ? '#0b0a12' : '#ffffff', shadow: !on });
    }
    ctx.restore();
  };
  // círculo pixelado (sin antialias)
  function circ(ctx, cx, cy, r) {
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  I.circ = circ;

  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) I.isTouch = true;
  NV.Input = I;
})();
