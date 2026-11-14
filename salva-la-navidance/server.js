// =====================================================================
//  SALVA LA NAVIDANCE \u2014 SERVIDOR + BASE DE DATOS DEL RANKING
//  Sin dependencias: solo necesitás Node.js 18 o superior.
//
//    node server.js
//
//  Variables opcionales:
//    PORT=3000                 puerto
//    ADMIN_KEY=una-clave       clave para ver el panel admin.html (nombres + Instagram).
//                              Si no se define, se genera una al azar y se muestra en la consola.
//    SECRET=otra-clave         firma de los tokens anti-trampa (definila: si cambia, las partidas en curso se invalidan)
//    MIN_SEC=35                tiempo mínimo aceptado. Nunca baja del mínimo físico que se calcula con el nivel.
//    DATA_DIR=./data           carpeta de los datos (los tests usan una temporal)
//
//  Los datos se guardan en data/players.json (un jugador por Instagram) y data/scores.json
//  (historial: una línea por partida terminada).
//
//  Reglas del ranking:
//   · El nombre puede ser cualquiera; el usuario de Instagram es ÚNICO (se registra una sola vez).
//   · Cada Instagram juega las veces que quiera y figura UNA vez, con su MEJOR tiempo (no se acumulan).
//
//  Identidad del jugador:
//   · publicId: identificador público (aparece en el ranking para marcar "tu fila").
//   · secret:   clave del dispositivo (128 bits). Se entrega UNA vez al registrarse, el servidor guarda
//               solo su hash y nunca la devuelve. Sin el secret no se puede jugar con ese Instagram.
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const vm = require('vm');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(9).toString('hex');
const SECRET = process.env.SECRET || crypto.randomBytes(16).toString('hex');
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'scores.json');
const PL_FILE = path.join(DATA_DIR, 'players.json');
const HEROES = ['ivan', 'hades', 'matias'];
const MAX_MS = 180000;     // límite del juego: 3 minutos
const CLOCK_TOL = 3000;    // diferencia máxima entre el reloj del juego y el del servidor (latencia de red)
const COUNT_MAX = 4500;    // máximo entre que se pide el token (empieza la cuenta) y el "¡YA!": 4 beats + latencia
const TOKEN_TTL = 15 * 60 * 1000; // una partida dura 3 min como mucho; el resto es margen para reintentos
const MAX_BODY = 2048;     // bytes: los pedidos del juego pesan menos de 400

// ---------- mínimo físico: se calcula con el nivel real (js/core.js + js/level.js) ----------
// Recorrido completo a la velocidad máxima posible (dash en FIEBRE) + la entrada del jefe
// + vaciarle la vida disparando siempre al punto débil (doble daño) a la cadencia máxima.
function levelLimits() {
  try {
    const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
    for (const f of ['js/core.js', 'js/level.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
    const C = ctx.NV.CFG, L = ctx.NV.buildLevel();
    const runF = (L.arena.x0 + 40 - L.checkpoints[0].x) / (C.DASH_SPEED * C.FEVER_SPEED);
    const introF = 148 + (4 * 3600) / 130; // alarma + VS hasta que cae, y 4 beats hasta que despierta
    const bossF = C.BOSS.HP / ((2 * C.SHOT_DMG) / C.SHOT_COOLDOWN);
    // B-Coins posibles: las del nivel + 10 por MEGA + 2 por enemigo vencido + 40 del jefe (+ margen)
    const coins = L.coins.length + 10 * L.items.filter((i) => i.type === 'mega').length + 2 * L.enemies.length + 40 + 30;
    return { minMs: Math.floor(((runF + introF + bossF) / 60) * 1000), coins: Math.min(999, coins) };
  } catch (e) {
    console.warn('No se pudo calcular el mínimo del nivel:', e.message);
    return { minMs: 25000, coins: 999 };
  }
}
const LIMITS = levelLimits();
// TEST_MODE=1 (solo los tests automáticos) deja usar un MIN_SEC menor que el físico
const MIN_MS = Math.max(Math.round(parseFloat(process.env.MIN_SEC || '35') * 1000), process.env.TEST_MODE ? 0 : LIMITS.minMs);
const MAX_COINS = LIMITS.coins;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a), 'hex'), Buffer.from(sha(b), 'hex'));
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex').slice(0, 32);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
let scores = [];
try { scores = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { scores = []; }
let players = {};
try { players = JSON.parse(fs.readFileSync(PL_FILE, 'utf8')); } catch (e) { players = {}; }
function writeJson(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, file);
}
const save = () => writeJson(DB_FILE, scores);
const savePlayers = () => writeJson(PL_FILE, players);

// ---------- MIGRACIÓN (versión anterior: el playerId era a la vez público y la clave) ----------
// · partidas viejas sin jugador registrado: se registran solas
// · cada jugador recibe un publicId nuevo; su playerId viejo pasa a ser su secret (se guarda solo el hash),
//   así los celulares que ya estaban registrados siguen funcionando sin hacer nada
// · se borra el playerId de las partidas guardadas. Antes de tocar nada se hace una copia .bak
(function migrate() {
  for (const s of scores) if (s.ig && !players[s.ig]) players[s.ig] = { name: s.name, playerId: s.playerId, created: s.date };
  const need = Object.values(players).some((p) => !p.publicId || 'playerId' in p) || scores.some((s) => 'playerId' in s);
  if (!need) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const f of [DB_FILE, PL_FILE]) if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak-' + stamp);
  for (const p of Object.values(players)) {
    if (!p.publicId) p.publicId = crypto.randomUUID();
    if ('playerId' in p) { if (p.playerId) p.secretHash = sha(p.playerId); delete p.playerId; }
  }
  for (const s of scores) delete s.playerId;
  savePlayers(); save();
  console.log('  Migración: ' + Object.keys(players).length + ' jugadores con publicId + secret (copia en *.bak-' + stamp + ')');
})();

// mejor tiempo de cada Instagram (una fila por jugador, con el nombre que tiene registrado ahora)
function bestPerPlayer() {
  const best = new Map();
  for (const s of scores) {
    const b = best.get(s.ig);
    if (!b || s.timeMs < b.timeMs || (s.timeMs === b.timeMs && s.coins > b.coins)) best.set(s.ig, s);
  }
  return [...best.values()].map((s) => Object.assign({}, s, { name: (players[s.ig] && players[s.ig].name) || s.name }))
    .sort((a, b) => a.timeMs - b.timeMs || b.coins - a.coins || a.date - b.date);
}
const bestOf = (ig) => { let b = 0; for (const s of scores) if (s.ig === ig && (!b || s.timeMs < b)) b = s.timeMs; return b; };

// el jugador se identifica con su Instagram + su secret
function auth(ig, secret) {
  const p = players[ig];
  if (!p || !p.secretHash || typeof secret !== 'string' || !secret || secret.length > 64) return null;
  return crypto.timingSafeEqual(Buffer.from(p.secretHash, 'hex'), Buffer.from(sha(secret), 'hex')) ? p : null;
}

// ---------- tokens anti-trampa ----------
// El token se pide al empezar la cuenta regresiva, está firmado y atado al Instagram, vence y se usa una vez.
// El servidor anota con SU reloj la largada ("¡YA!") y la llegada (jefe vencido): el tiempo que manda el
// juego tiene que coincidir con lo que midió el servidor. Editar el cronómetro no sirve.
const usedTokens = new Set(scores.map((s) => s.token).filter(Boolean)); // sobrevive a reinicios
const runs = new Map(); // token -> { go, fin } (momentos del reloj del servidor)
function makeToken(ig) {
  const t = Date.now(), n = crypto.randomBytes(8).toString('hex');
  return t + '.' + n + '.' + hmac(ig + '|' + t + '|' + n);
}
function tokenStart(token, ig) {
  if (typeof token !== 'string' || token.length > 80) return 0;
  const [t, n, sig] = token.split('.');
  if (!t || !n || !sig || sig.length !== 32) return 0;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(ig + '|' + t + '|' + n)))) return 0;
  const start = parseInt(t, 10);
  return Date.now() - start <= TOKEN_TTL ? start : -1;
}
function run(token) {
  let r = runs.get(token);
  if (!r) {
    if (runs.size > 20000) for (const [k, v] of runs) if (Date.now() - v.at > TOKEN_TTL) runs.delete(k);
    r = { at: Date.now() }; runs.set(token, r);
  }
  return r;
}
function checkToken(token, ig, timeMs) {
  if (!token) return 'Falta el token de la partida';
  const start = tokenStart(token, ig);
  if (start === 0) return 'Token inválido';
  if (start < 0) return 'La partida venció';
  const r = runs.get(token) || {}, end = r.fin || Date.now();
  if (timeMs > end - (r.go || start) + CLOCK_TOL) return 'Tiempo imposible';
  if (timeMs < end - start - COUNT_MAX || (r.go && timeMs < end - r.go - CLOCK_TOL)) return 'El tiempo no coincide con el del servidor';
  return null;
}

// ---------- límite de pedidos (por IP y por jugador) ----------
// Ojo: en la fiesta muchos celulares salen por la misma IP (Wi-Fi del lugar), por eso los límites por IP son altos.
const hits = new Map();
function limited(id, key = '', max = 600) {
  if (hits.size > 50000) hits.clear();
  const k = key + id, now = Date.now(); const h = (hits.get(k) || []).filter((t) => now - t < 60000);
  h.push(now); hits.set(k, h); return h.length > max;
}

// texto libre: sin < >, sin caracteres de control ni de dirección (RTL) invisibles
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const igOf = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/^@+/, '').slice(0, 31);
const IG_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/; // como Instagram: sin punto al principio/final ni ".."
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// ---------- respuestas y cabeceras de seguridad ----------
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function secHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}
// la API es solo para el propio sitio: sin Access-Control-Allow-Origin el navegador bloquea otros orígenes
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
// cuerpo JSON con límite de tamaño: devuelve null si es demasiado grande
function body(req) {
  return new Promise((ok) => {
    if (parseInt(req.headers['content-length'] || '0', 10) > MAX_BODY) return ok(null);
    let d = '', big = false;
    req.on('data', (c) => { if (big) return; d += c; if (d.length > MAX_BODY) { big = true; ok(null); } });
    req.on('end', () => { if (big) return; try { const j = JSON.parse(d || '{}'); ok(j && typeof j === 'object' && !Array.isArray(j) ? j : {}); } catch (e) { ok({}); } });
    req.on('error', () => ok(null));
  });
}
const tooBig = (req, res) => { res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' }); res.end('{"error":"Pedido demasiado grande"}', () => req.destroy()); };

// ---------- archivos estáticos: solo lo público (con soporte de Range para el audio en iPhone) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const PUBLIC = /^\/(index\.html|admin\.html|manifest\.webmanifest|favicon\.ico|(assets|js|css)\/[\w\-./ ]+)$/;
function serveStatic(req, res, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (p.includes('..') || p.includes('\0') || /^\/(data|\.git)\//i.test(p) || !file.startsWith(ROOT + path.sep) || file.startsWith(DATA_DIR + path.sep) || file === path.join(ROOT, 'server.js')) { res.writeHead(403); return res.end(); }
  if (!PUBLIC.test(p) || !MIME[path.extname(file).toLowerCase()]) { res.writeHead(404); return res.end('No encontrado'); }
  // index.html: la vista previa del link necesita la dirección completa de la imagen
  if (file === path.join(ROOT, 'index.html')) {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return fs.readFile(file, 'utf8', (err, html) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(html.split('%ORIGIN%').join(proto + '://' + host));
    });
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    const type = MIME[path.extname(file).toLowerCase()];
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || []; let start = m[1] ? parseInt(m[1], 10) : 0; let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('audio') || type.startsWith('image') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const rankInfo = (ig) => { const list = bestPerPlayer(), rank = list.findIndex((s) => s.ig === ig) + 1; return { rank, total: list.length, best: rank ? list[rank - 1].timeMs : 0 }; };

http.createServer(async (req, res) => {
  secHeaders(res);
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, req.url);
  if (limited(ip)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });

  if (url.pathname === '/api/ping') return json(res, 200, { ok: true });

  // Registro: el Instagram es único y pertenece al dispositivo que lo registró (el que tiene el secret).
  // Desde otro dispositivo no se puede tomar: hay que pedirle al organizador que lo libere (admin).
  if (url.pathname === '/api/register' && req.method === 'POST') {
    if (limited(ip, 'reg:', 60)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });
    const b = await body(req); if (!b) return tooBig(req, res);
    const name = clean(b.name, 16), ig = igOf(b.ig);
    if (name.length < 2) return json(res, 400, { error: 'Nombre inválido' });
    if (!/^[a-z0-9._]{1,30}$/.test(ig)) return json(res, 400, { error: 'Instagram inválido' });
    if (limited(ig, 'regig:', 10)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });
    const cur = players[ig];
    if (cur && cur.secretHash) {
      if (!auth(ig, b.secret)) return json(res, 409, { exists: true });
      cur.name = name; savePlayers();
      return json(res, 200, { ok: true, publicId: cur.publicId, bestMs: bestOf(ig), isNew: false });
    }
    if (!cur && !IG_RE.test(ig)) return json(res, 400, { error: 'Instagram inválido' });
    // nuevo (o liberado por el organizador): se entrega el secret una sola vez
    const secret = crypto.randomBytes(16).toString('hex');
    const p = cur || { publicId: crypto.randomUUID(), created: Date.now() };
    p.name = name; p.secretHash = sha(secret); players[ig] = p; savePlayers();
    return json(res, 200, { ok: true, publicId: p.publicId, secret, bestMs: bestOf(ig), isNew: !cur });
  }

  // token de la partida: solo para un jugador registrado con su secret
  if (url.pathname === '/api/run/start' && req.method === 'POST') {
    const b = await body(req); if (!b) return tooBig(req, res);
    const ig = igOf(b.ig);
    if (!auth(ig, b.secret)) return json(res, 403, { error: 'Jugador no registrado en este dispositivo' });
    if (limited(ig, 'start:', 40)) return json(res, 429, { error: 'Demasiadas partidas, esperá un minuto' });
    return json(res, 200, { token: makeToken(ig) });
  }

  // largada ("¡YA!") y llegada (jefe vencido): el servidor anota su propio reloj, una sola vez
  if ((url.pathname === '/api/run/go' || url.pathname === '/api/run/finish') && req.method === 'POST') {
    const b = await body(req); if (!b) return tooBig(req, res);
    if (tokenStart(b.token, igOf(b.ig)) <= 0 || usedTokens.has(b.token)) return json(res, 400, { error: 'Token inválido' });
    const r = run(b.token);
    if (url.pathname === '/api/run/go') { if (!r.go && !r.fin) r.go = Date.now(); }
    else if (!r.fin) r.fin = Date.now();
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/score' && req.method === 'POST') {
    if (limited(ip, 'score:', 120)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });
    const b = await body(req); if (!b) return tooBig(req, res);
    const ig = igOf(b.ig), hero = b.hero, timeMs = b.timeMs, coins = b.coins, deaths = b.deaths;
    const pl = auth(ig, b.secret);
    if (!pl) return json(res, 403, { error: 'Ese Instagram no está registrado en este dispositivo' });
    if (limited(ig, 'score:', 15)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });
    // reenvío de la misma partida (se cortó la respuesta): se contesta lo mismo, no se guarda dos veces
    if (typeof b.token === 'string' && usedTokens.has(b.token)) {
      const old = scores.find((s) => s.token === b.token);
      if (old && old.ig === ig && old.timeMs === timeMs) return json(res, 200, Object.assign(rankInfo(ig), { improved: false, duplicate: true }));
      return json(res, 400, { error: 'Esta partida ya fue enviada' });
    }
    if (!HEROES.includes(hero)) return json(res, 400, { error: 'Personaje inválido' });
    if (!isInt(timeMs, MIN_MS, MAX_MS)) return json(res, 400, { error: 'Tiempo inválido' });
    if (!isInt(coins, 0, MAX_COINS) || !isInt(deaths, 0, 999)) return json(res, 400, { error: 'Datos de la partida inválidos' });
    const tErr = checkToken(b.token, ig, timeMs); if (tErr) return json(res, 400, { error: tErr });
    const prevBest = bestOf(ig);
    usedTokens.add(b.token); runs.delete(b.token);
    scores.push({ name: pl.name, ig, hero, timeMs, coins, deaths, date: Date.now(), token: b.token, ip: sha(ip).slice(0, 10) });
    save();
    const info = rankInfo(ig);
    console.log(`[${new Date().toLocaleTimeString()}] ${pl.name} @${ig} ${hero} ${(timeMs / 1000).toFixed(2)}s -> puesto #${info.rank}`);
    return json(res, 200, Object.assign(info, { improved: !prevBest || timeMs < prevBest }));
  }

  // ranking público: sin Instagram ni secretos; "id" es el publicId (para marcar tu fila)
  if (url.pathname === '/api/ranking') {
    const n = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10', 10) || 10));
    const list = bestPerPlayer().slice(0, n).map((s) => ({ name: s.name, hero: s.hero, timeMs: s.timeMs, coins: s.coins, id: players[s.ig] ? players[s.ig].publicId : null }));
    return json(res, 200, { ranking: list });
  }

  // ---------- panel de administración (incluye Instagram) ----------
  if (url.pathname === '/api/admin' || url.pathname === '/api/admin/release') {
    // la clave va en un header (no en la URL, que queda en historiales y logs); máx. 10 intentos por minuto
    if (limited(ip, 'admin:', 10)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });
    if (!safeEq(req.headers['x-admin-key'] || '', ADMIN_KEY)) return json(res, 401, { error: 'Clave incorrecta' });
    // liberar un Instagram (el dueño cambió de celular): el próximo que lo registre recibe un secret nuevo
    if (url.pathname === '/api/admin/release') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Usá POST' });
      const b = await body(req); if (!b) return tooBig(req, res);
      const ig = igOf(b.ig), p = players[ig];
      if (!p) return json(res, 404, { error: 'No existe ese Instagram' });
      delete p.secretHash; savePlayers();
      console.log(`[${new Date().toLocaleTimeString()}] admin liberó @${ig}`);
      return json(res, 200, { ok: true });
    }
    const plays = new Map(); for (const s of scores) plays.set(s.ig, (plays.get(s.ig) || 0) + 1);
    const list = bestPerPlayer().map((s, i) => ({ rank: i + 1, name: s.name, ig: s.ig, hero: s.hero, timeMs: s.timeMs, coins: s.coins, deaths: s.deaths, date: s.date, plays: plays.get(s.ig) }));
    if (url.searchParams.get('format') === 'csv') {
      // celdas que empiezan con = + - @ se escapan (Excel las ejecutaría como fórmula)
      const cell = (c) => { let v = String(c); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
      const rows = [['puesto', 'nombre', 'instagram', 'personaje', 'tiempo_seg', 'bcoins', 'caidas', 'partidas', 'fecha']].concat(list.map((s) => [s.rank, s.name, 'ig:' + s.ig, s.hero, (s.timeMs / 1000).toFixed(2), s.coins, s.deaths, s.plays, new Date(s.date).toISOString()]));
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ranking-navidance.csv"', 'Cache-Control': 'no-store' });
      return res.end('\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\n'));
    }
    return json(res, 200, { total: scores.length, players: list.length, ranking: list });
  }
  json(res, 404, { error: 'No existe' });
}).listen(PORT, () => {
  console.log('\n  SALVA LA NAVIDANCE \u2014 servidor listo\n');
  console.log('  En esta PC:      http://localhost:' + PORT);
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) console.log('  En el celular:   http://' + i.address + ':' + PORT + '   (mismo Wi-Fi)');
  console.log('  Panel admin:     http://localhost:' + PORT + '/admin.html   (clave: ' + (process.env.ADMIN_KEY ? '******' : ADMIN_KEY + '  <- al azar, definí ADMIN_KEY para fijarla') + ')');
  if (!process.env.SECRET) console.log('  Aviso: definí SECRET para que las partidas en curso sobrevivan a un reinicio');
  console.log('  Tiempo mínimo aceptado: ' + (MIN_MS / 1000).toFixed(1) + ' s (mínimo físico del nivel: ' + (LIMITS.minMs / 1000).toFixed(1) + ' s)');
  console.log('  Partidas guardadas: ' + scores.length + '\n');
});
