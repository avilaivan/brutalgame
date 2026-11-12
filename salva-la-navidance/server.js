// =====================================================================
//  SALVA LA NAVIDANCE — SERVIDOR + BASE DE DATOS DEL RANKING
//  Sin dependencias: solo necesitás Node.js 18 o superior.
//
//    node server.js
//
//  Variables opcionales:
//    PORT=3000                 puerto
//    ADMIN_KEY=una-clave       clave para ver el panel admin.html (nombres + Instagram)
//    SECRET=otra-clave         firma de los tokens anti-trampa
//
//  Los datos se guardan en data/scores.json (una línea por partida terminada).
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || 'brutal-admin';
const SECRET = process.env.SECRET || crypto.randomBytes(16).toString('hex');
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'scores.json');
const HEROES = ['ivan', 'hades', 'matias'];
const MIN_MS = 30000;      // nadie puede terminar en menos de 30 s
const MAX_MS = 180000;     // límite del juego: 3 minutos

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
let scores = [];
try { scores = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { scores = []; }
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

// mejor tiempo por jugador (Instagram)
function bestPerPlayer() {
  const best = new Map();
  for (const s of scores) {
    const k = s.ig;
    const b = best.get(k);
    if (!b || s.timeMs < b.timeMs || (s.timeMs === b.timeMs && s.coins > b.coins)) best.set(k, s);
  }
  return [...best.values()].sort((a, b) => a.timeMs - b.timeMs || b.coins - a.coins || a.date - b.date);
}

// ---------- tokens anti-trampa: el servidor anota cuándo empezó la partida ----------
const usedTokens = new Set();
function makeToken(playerId) {
  const t = Date.now();
  const sig = crypto.createHmac('sha256', SECRET).update(playerId + '|' + t).digest('hex').slice(0, 24);
  return t + '.' + sig;
}
function checkToken(token, playerId, timeMs) {
  if (!token || typeof token !== 'string') return 'Falta el token de la partida';
  const [t, sig] = token.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(playerId + '|' + t).digest('hex').slice(0, 24);
  if (sig !== good) return 'Token inválido';
  if (usedTokens.has(token)) return 'Esta partida ya fue enviada';
  const elapsed = Date.now() - parseInt(t, 10);
  if (elapsed + 3000 < timeMs) return 'Tiempo imposible';          // no pudo terminar antes de lo que tardó de verdad
  if (elapsed > 30 * 60 * 1000) return 'La partida venció';
  return null;
}

// ---------- límite simple de pedidos por IP ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  h.push(now); hits.set(ip, h); return h.length > 40;
}

const clean = (s, n) => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((ok) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e4) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { ok({}); } });
  });
}

// ---------- archivos estáticos (con soporte de Range para el audio en iPhone) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.startsWith(DATA_DIR + path.sep) || file === path.join(ROOT, 'server.js')) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range); let start = m[1] ? parseInt(m[1], 10) : 0; let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      end = Math.min(end, st.size - 1);
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('audio') || type.startsWith('image') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, req.url);
  if (limited(ip)) return json(res, 429, { error: 'Demasiados intentos, esperá un minuto' });

  if (url.pathname === '/api/ping') return json(res, 200, { ok: true });

  if (url.pathname === '/api/run/start' && req.method === 'POST') {
    const b = await body(req);
    const playerId = clean(b.playerId, 40); if (!playerId) return json(res, 400, { error: 'Falta jugador' });
    return json(res, 200, { token: makeToken(playerId) });
  }

  if (url.pathname === '/api/score' && req.method === 'POST') {
    const b = await body(req);
    const name = clean(b.name, 16), ig = clean(b.ig, 30).toLowerCase().replace(/^@+/, ''), hero = clean(b.hero, 10), playerId = clean(b.playerId, 40);
    const timeMs = Math.round(Number(b.timeMs)), coins = Math.max(0, Math.min(999, Math.round(Number(b.coins) || 0))), deaths = Math.max(0, Math.round(Number(b.deaths) || 0));
    if (name.length < 2) return json(res, 400, { error: 'Nombre inválido' });
    if (!/^[a-z0-9._]{1,30}$/.test(ig)) return json(res, 400, { error: 'Instagram inválido' });
    if (!HEROES.includes(hero)) return json(res, 400, { error: 'Personaje inválido' });
    if (!(timeMs >= MIN_MS && timeMs <= MAX_MS)) return json(res, 400, { error: 'Tiempo inválido' });
    const tErr = checkToken(b.token, playerId, timeMs); if (tErr) return json(res, 400, { error: tErr });
    usedTokens.add(b.token);
    scores.push({ name, ig, hero, playerId, timeMs, coins, deaths, date: Date.now(), ip: crypto.createHash('sha1').update(ip).digest('hex').slice(0, 10) });
    save();
    const list = bestPerPlayer();
    const rank = list.findIndex((s) => s.ig === ig) + 1;
    console.log(`[${new Date().toLocaleTimeString()}] ${name} @${ig} ${hero} ${(timeMs / 1000).toFixed(2)}s -> puesto #${rank}`);
    return json(res, 200, { rank, total: list.length, best: list[rank - 1].timeMs });
  }

  if (url.pathname === '/api/ranking') {
    const n = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10', 10)));
    const list = bestPerPlayer().slice(0, n).map((s) => ({ name: s.name, hero: s.hero, timeMs: s.timeMs, coins: s.coins, player: s.playerId }));
    return json(res, 200, { ranking: list });
  }

  // ---------- panel de administración (incluye Instagram) ----------
  if (url.pathname === '/api/admin') {
    if (url.searchParams.get('key') !== ADMIN_KEY) return json(res, 401, { error: 'Clave incorrecta' });
    const list = bestPerPlayer().map((s, i) => ({ rank: i + 1, name: s.name, ig: s.ig, hero: s.hero, timeMs: s.timeMs, coins: s.coins, deaths: s.deaths, date: s.date, plays: scores.filter((x) => x.ig === s.ig).length }));
    if (url.searchParams.get('format') === 'csv') {
      const rows = [['puesto', 'nombre', 'instagram', 'personaje', 'tiempo_seg', 'bcoins', 'caidas', 'partidas', 'fecha']].concat(list.map((s) => [s.rank, s.name, '@' + s.ig, s.hero, (s.timeMs / 1000).toFixed(2), s.coins, s.deaths, s.plays, new Date(s.date).toISOString()]));
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ranking-navidance.csv"' });
      return res.end('﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'));
    }
    return json(res, 200, { total: scores.length, players: list.length, ranking: list });
  }
  json(res, 404, { error: 'No existe' });
}).listen(PORT, () => {
  console.log('\n  SALVA LA NAVIDANCE — servidor listo\n');
  console.log('  En esta PC:      http://localhost:' + PORT);
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) console.log('  En el celular:   http://' + i.address + ':' + PORT + '   (mismo Wi-Fi)');
  console.log('  Panel admin:     http://localhost:' + PORT + '/admin.html   (clave: ' + (process.env.ADMIN_KEY ? '******' : ADMIN_KEY) + ')');
  console.log('  Partidas guardadas: ' + scores.length + '\n');
});
