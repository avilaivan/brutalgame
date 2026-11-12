// =====================================================================
//  SALVA LA NAVIDANCE — CONFIGURACIÓN GENERAL
//  Todos los números del juego están acá para ajustarlos sin tocar la lógica.
// =====================================================================
window.NV = window.NV || {};
NV.VERSION = 'navidad-1'; // cambiarlo en cada actualización del arte o la música (rompe la caché del navegador)

NV.CFG = {
  // ---------- Pantalla ----------
  H: 360,                 // alto interno en píxeles (el ancho se adapta a la pantalla)
  MIN_W: 560, MAX_W: 800, // ancho interno mínimo / máximo
  TILE: 16,

  // ---------- Reglas de la competencia ----------
  TIME_LIMIT: 180,        // 3 minutos máximo por partida
  RESPAWN_DELAY: 75,      // cuadros que dura la animación de muerte antes de reaparecer

  // ---------- Jugador (iguales para los 3 personajes) ----------
  HP: 4,
  RUN: 2.5,            // más rápido = más frenético
  GRAVITY: 0.32,
  MAX_FALL: 7,
  JUMP_VEL: -7.0,       // salto máx ≈ 76 px (4,7 tiles): todas las plataformas quedan a mano
  JUMP_CUT: -2.6,
  STOMP_BOUNCE: -5.4,
  STOMP_BOUNCE_HELD: -7.6,
  COYOTE: 7,
  JUMP_BUFFER: 8,
  DASH_FRAMES: 14,
  DASH_SPEED: 5.2,
  INVULN: 70,
  SHOT_COOLDOWN: 8,       // mantener DISPARO = ráfaga automática
  SHOT_SPEED: 8.5,
  SHOT_LIFE: 38,          // alcance ≈ 320 px
  SHOT_DMG: 1,
  SHOT_MAX: 4,
  SHIELD_TIME: 8 * 60,    // el escudo te hace inmune 8 s y después se rompe

  // ---------- Combo y FIEBRE: encadenar enemigos sin parar te hace más rápido ----------
  COMBO_TIME: 150,        // cuadros para encadenar el siguiente enemigo (2,5 s)
  FEVER_AT: 5,            // combo que activa la FIEBRE
  FEVER_SPEED: 1.22,      // multiplicador de velocidad durante la FIEBRE

  // ---------- Medallas por tiempo (segundos): ajustarlas cuando haya tiempos reales ----------
  MEDALS: [['S', 52, '#f5c542'], ['A', 65, '#4de2ff'], ['B', 85, '#33e07a'], ['C', Infinity, '#8ea2c4']],

  // ---------- Puntaje (las B-Coins solo suman puntos y desempatan) ----------
  COIN_PTS: 100,
  STOMP_PTS: 300,
  KILL_PTS: 200,

  // ---------- Base de datos / ranking ----------
  // Si se completa SUPABASE, se usa Supabase. Si no, se usa el servidor propio (server.js).
  // Si no hay servidor, el ranking queda guardado solo en este dispositivo.
  API_BASE: '',
  SUPABASE: { url: '', anonKey: '' },
  RANKING_SIZE: 10,
};

// Opciones del jugador (quedan guardadas en el dispositivo)
NV.OPT = Object.assign({ music: 8, sfx: 7, vib: true, fx: true }, (() => { try { return JSON.parse(localStorage.getItem('navidance_opts') || '{}'); } catch (e) { return {}; } })());
NV.saveOpt = () => { try { localStorage.setItem('navidance_opts', JSON.stringify(NV.OPT)); } catch (e) {} };

NV.HEROES = {
  ivan:   { name: 'AVILA IVAN',       short: 'IVAN',   color: '#ff2e4a', light: '#ff9aa8', dark: '#5c0815', role: 'ROJO' },
  hades:  { name: 'BB HADES',         short: 'HADES',  color: '#4d8dff', light: '#b4cdff', dark: '#0b2463', role: 'AZUL' },
  matias: { name: 'MATIAS TORRELLES', short: 'MATIAS', color: '#33e07a', light: '#a8ffc8', dark: '#0a4a25', role: 'VERDE' },
};
NV.HERO_ORDER = ['ivan', 'hades', 'matias'];

// ---------------- utilidades ----------------
NV.U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
  overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  rand: (a, b) => a + Math.random() * (b - a),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  fmtTime: (sec) => {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec * 100) % 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  },
  hex2rgb: (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)],
  // distancia de un punto a un segmento (para los láseres del jefe)
  segDist: (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = NV.U.clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  },
};
