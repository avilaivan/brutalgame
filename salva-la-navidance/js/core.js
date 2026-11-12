// =====================================================================
//  SALVA LA NAVIDANCE — CONFIGURACIÓN GENERAL
//  Todos los números del juego están acá para ajustarlos sin tocar la lógica.
// =====================================================================
window.NV = window.NV || {};

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
  RUN: 2.1,
  GRAVITY: 0.28,
  MAX_FALL: 6,
  JUMP_VEL: -5.9,
  JUMP_CUT: -2,
  STOMP_BOUNCE: -4.6,
  STOMP_BOUNCE_HELD: -6.4,
  COYOTE: 7,
  JUMP_BUFFER: 8,
  DASH_FRAMES: 16,
  DASH_SPEED: 4.3,
  INVULN: 70,
  SHOT_COOLDOWN: 9,       // mantener DISPARO = ráfaga automática
  SHOT_SPEED: 6.5,
  SHOT_LIFE: 46,          // alcance ≈ 300 px
  SHOT_DMG: 1,
  SHOT_MAX: 4,
  SHIELD_TIME: 8 * 60,    // el escudo te hace inmune 8 s y después se rompe

  // ---------- Medallas por tiempo (segundos): ajustarlas cuando haya tiempos reales ----------
  MEDALS: [['S', 60, '#f5c542'], ['A', 75, '#4de2ff'], ['B', 95, '#33e07a'], ['C', Infinity, '#8ea2c4']],

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
