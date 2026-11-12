// =====================================================================
//  AUDIO: una canción por personaje (en loop) + análisis para que todo
//  el juego (luces, enemigos, jefe) se mueva al ritmo de esa canción.
//  Los efectos de sonido se generan en vivo (sintetizador 8-bit).
// =====================================================================
(function () {
  const MD = window.MUSIC_DATA;
  const A = { ctx: null, cur: null, el: {}, muted: false, fake0: performance.now() / 1000, env: {}, vol: 0.85 };
  let sfxBus, master, noiseBuf;

  // decodificar envolventes de energía (base64 -> bytes)
  for (const k in MD) {
    const d = MD[k]; A.env[k] = {};
    for (const b of ['bass', 'mid', 'high', 'onset']) {
      const s = atob(d[b]); const arr = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
      A.env[k][b] = arr;
    }
  }
  // elementos de audio (streaming, funcionan también abriendo el archivo directo)
  for (const k in MD) {
    const el = new Audio(); el.src = MD[k].file; el.preload = 'auto'; el.loop = true; el.volume = A.vol;
    A.el[k] = el;
  }

  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(A.ctx.destination);
    sfxBus = A.ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iOS: "preparar" las canciones dentro del primer toque
    for (const k in A.el) { const el = A.el[k]; if (el.paused && k !== A.cur) { el.muted = true; const p = el.play(); if (p) p.then(() => { if (k !== A.cur) el.pause(); el.muted = false; }).catch(() => { el.muted = false; }); } }
    if (A.pending) { const p = A.pending; A.pending = null; A.play(p.k, p.from); }
  };

  // ---------------- MÚSICA ----------------
  A.play = function (k, from = 0) {
    if (!A.ctx) { A.pending = { k, from }; A.cur = k; A.fake0 = performance.now() / 1000 - from; return; }
    for (const o in A.el) if (o !== k) { A.el[o].pause(); }
    const el = A.el[k]; A.cur = k;
    el.muted = A.muted; el.volume = A.vol;
    try { el.currentTime = from; } catch (e) {}
    A.fake0 = performance.now() / 1000 - from;
    const p = el.play(); if (p) p.catch(() => {});
  };
  A.preview = function (k) { // empieza en un punto con energía, alineado al beat
    const d = MD[k]; const bl = 60 / d.bpm; const t = d.offset + Math.round((d.duration * 0.28) / (bl * 4)) * bl * 4;
    A.play(k, t);
  };
  A.stop = function () { for (const o in A.el) A.el[o].pause(); };
  A.pause = function () { if (A.cur) A.el[A.cur].pause(); };
  A.resume = function () { if (A.cur) { const p = A.el[A.cur].play(); if (p) p.catch(() => {}); } };
  A.toggleMute = function () {
    A.muted = !A.muted;
    for (const o in A.el) A.el[o].muted = A.muted;
    if (master) master.gain.value = A.muted ? 0 : 1;
  };
  A.time = function () {
    const el = A.cur && A.el[A.cur];
    if (el && !el.paused && el.readyState >= 2) return el.currentTime;
    return performance.now() / 1000 - A.fake0;
  };
  A.data = () => MD[A.cur || 'ivan'];
  A.beatPos = function () { const d = A.data(); return ((A.time() - d.offset) * d.bpm) / 60; };
  A.beat = () => Math.floor(A.beatPos());
  A.phase = () => { const b = A.beatPos(); return b - Math.floor(b); };
  A.beatLen = () => 60 / A.data().bpm;
  A.level = function (band) { // 0..1
    const k = A.cur || 'ivan'; const e = A.env[k] && A.env[k][band]; if (!e) return 0;
    const el = A.el[k]; let t = A.time();
    if (!el || el.paused) { const ph = A.phase(); return band === 'bass' || band === 'onset' ? Math.max(0, 1 - ph * 2.5) * 0.8 : 0.4; }
    t = t % MD[k].duration;
    const i = Math.min(e.length - 1, Math.floor(t * 30));
    return e[i] / 255;
  };

  // ---------------- EFECTOS (sintetizador) ----------------
  const now = () => A.ctx.currentTime;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, p, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, d, v, o = {}) {
    const n = A.ctx.createOscillator(), g = A.ctx.createGain(); n.type = type; n.frequency.setValueAtTime(f, t);
    if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + d);
    let node = n;
    if (o.lp) { const fl = A.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; n.connect(fl); node = fl; }
    node.connect(g); g.connect(sfxBus); env(g, t, o.a || 0.004, v, d); n.start(t); n.stop(t + d + 0.05);
  }
  function noise(t, d, v, type = 'highpass', f = 6000, to) {
    const s = A.ctx.createBufferSource(); s.buffer = noiseBuf; const fl = A.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = A.ctx.createGain(); s.connect(fl); fl.connect(g); g.connect(sfxBus); env(g, t, 0.002, v, d); s.start(t, Math.random() * 0.4); s.stop(t + d + 0.05);
  }
  let coinStep = 0, coinT = 0;
  A.sfx = function (n) {
    if (!A.ctx || A.muted) return;
    const t = now();
    switch (n) {
      case 'shoot': osc('square', 880, t, 0.05, 0.05, { to: 520 }); break;
      case 'jump': osc('square', 320, t, 0.09, 0.06, { to: 640 }); break;
      case 'dash': noise(t, 0.14, 0.12, 'bandpass', 3000, 500); osc('sawtooth', 200, t, 0.1, 0.04, { to: 90 }); break;
      case 'stomp': osc('square', 180, t, 0.07, 0.12, { to: 700 }); osc('square', 700, t + 0.05, 0.08, 0.08, { to: 1200 }); break;
      case 'hit': osc('square', 220, t, 0.04, 0.07, { to: 110 }); break;
      case 'kill': noise(t, 0.22, 0.18, 'lowpass', 3000, 200); osc('square', 400, t, 0.12, 0.07, { to: 80 }); break;
      case 'coin': {
        if (t - coinT > 0.6) coinStep = 0; coinT = t;
        const sc = [76, 79, 83, 86, 88, 91, 95, 98]; const m = sc[Math.min(coinStep++, sc.length - 1)];
        osc('square', mtof(m), t, 0.06, 0.05); osc('square', mtof(m + 5), t + 0.05, 0.09, 0.045); break;
      }
      case 'mega': [72, 76, 79, 84, 88, 91].forEach((m, i) => osc('square', mtof(m), t + i * 0.05, 0.1, 0.07)); break;
      case 'hurt': osc('sawtooth', 320, t, 0.22, 0.12, { to: 70 }); break;
      case 'shield': [60, 67, 72, 79, 84].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.05, 0.14, 0.1)); break;
      case 'shield_break': noise(t, 0.35, 0.18, 'highpass', 4000, 9000); [84, 79, 72].forEach((m, i) => osc('square', mtof(m), t + i * 0.06, 0.08, 0.06)); break;
      case 'heal': [64, 68, 71, 76].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.06, 0.12, 0.09)); break;
      case 'checkpoint': [67, 72, 76, 79, 84].forEach((m, i) => osc('square', mtof(m), t + i * 0.06, 0.1, 0.06)); break;
      case 'beep': osc('square', 660, t, 0.12, 0.09); break;
      case 'go': osc('square', 1320, t, 0.35, 0.1); osc('square', 660, t, 0.35, 0.06); break;
      case 'select': osc('square', 660, t, 0.06, 0.07); osc('square', 990, t + 0.06, 0.08, 0.07); break;
      case 'move': osc('square', 440, t, 0.04, 0.05); break;
      case 'laser_charge': osc('sawtooth', 90, t, 0.5, 0.08, { to: 900, lp: 2500 }); break;
      case 'laser': osc('sawtooth', 1400, t, 0.5, 0.07, { to: 300, lp: 5000 }); noise(t, 0.5, 0.06, 'bandpass', 2000); break;
      case 'slam': noise(t, 0.5, 0.3, 'lowpass', 900, 60); osc('sine', 90, t, 0.4, 0.3, { to: 35 }); break;
      case 'roar': osc('sawtooth', 120, t, 0.8, 0.16, { to: 55, lp: 900 }); noise(t, 0.8, 0.1, 'lowpass', 800, 150); break;
      case 'boss_hit': osc('square', 160, t, 0.05, 0.08, { to: 90 }); break;
      case 'big_boom': noise(t, 1.4, 0.35, 'lowpass', 3000, 60); osc('sine', 80, t, 1.2, 0.3, { to: 25 }); break;
      case 'die_ivan': noise(t, 0.7, 0.25, 'lowpass', 4000, 200); osc('sawtooth', 300, t, 0.6, 0.1, { to: 60 }); break;
      case 'die_hades': for (let i = 0; i < 6; i++) osc('square', 1500 - i * 200, t + i * 0.05, 0.05, 0.07); noise(t, 0.5, 0.15, 'highpass', 5000); break;
      case 'die_matias': osc('sine', 1200, t, 0.7, 0.14, { to: 60 }); osc('triangle', 600, t, 0.7, 0.08, { to: 30 }); break;
      case 'win': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => osc('square', mtof(m), t + i * 0.11, 0.16, 0.08)); break;
      case 'timeout': [72, 67, 64, 60].forEach((m, i) => osc('square', mtof(m), t + i * 0.18, 0.22, 0.08)); break;
    }
  };

  NV.Audio = A;
})();
