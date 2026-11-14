// Prueba del anti-trampa y la seguridad del servidor. Correr con:  npm test
// Levanta server.js en otro puerto con una base de datos TEMPORAL (nunca toca data/).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const PORT = 3999, URL = 'http://localhost:' + PORT;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navidance-'));
let srv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b, h = {}) => fetch(URL + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));

// datos de la versión anterior: el servidor tiene que migrarlos sin perder el puntaje
fs.writeFileSync(path.join(dataDir, 'players.json'), JSON.stringify({ viejo: { name: 'Viejo', playerId: 'pViejo123', created: 1 } }));
fs.writeFileSync(path.join(dataDir, 'scores.json'), JSON.stringify([{ name: 'Viejo', ig: 'viejo', hero: 'ivan', playerId: 'pViejo123', timeMs: 90000, coins: 5, deaths: 1, date: 1, token: 'x' }]));

before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: dataDir, ADMIN_KEY: 'k', MIN_SEC: '0.1', TEST_MODE: '1' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(URL + '/api/ping'); return; } catch (e) { await sleep(100); } }
});
after(() => { srv.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

async function player(ig, name = 'Test') {
  const r = await post('/api/register', { name, ig });
  assert.strictEqual(r.status, 200, r.error);
  return { ig, secret: r.secret, publicId: r.publicId };
}
async function startGo(p) {
  const { token } = await post('/api/run/start', { ig: p.ig, secret: p.secret });
  assert.ok(token, 'sin token');
  await post('/api/run/go', { token, ig: p.ig });
  return token;
}
const score = (p, token, timeMs, extra = {}) => post('/api/score', { ig: p.ig, secret: p.secret, hero: 'ivan', coins: 3, deaths: 0, token, timeMs, ...extra });

test('partida honesta: se acepta; reenviarla devuelve lo mismo sin duplicar', async () => {
  const p = await player('honesto');
  const token = await startGo(p); await sleep(400);
  const r = await score(p, token, 400);
  assert.strictEqual(r.status, 200, r.error);
  const again = await score(p, token, 400);
  assert.strictEqual(again.duplicate, true);
  const other = await score(p, token, 350);
  assert.match(other.error, /ya fue enviada/);
});

test('tiempo más largo que lo que pasó: rechazado', async () => {
  const p = await player('largo');
  const r = await score(p, await startGo(p), 10000);
  assert.match(r.error, /imposible/);
});

test('cronómetro editado (más rápido que el reloj del servidor): rechazado', async () => {
  const p = await player('editado');
  const token = await startGo(p); await sleep(3500);
  assert.match((await score(p, token, 200)).error, /no coincide/);
});

test('la llegada anotada manda: un envío tardío (sin señal) sigue valiendo', async () => {
  const p = await player('tardio');
  const token = await startGo(p); await sleep(300);
  await post('/api/run/finish', { token, ig: p.ig }); await sleep(3500);
  assert.strictEqual((await score(p, token, 300)).status, 200);
});

test('(c) sin token, token de otro jugador o valores raros: rechazado', async () => {
  const p = await player('raro'), q = await player('otro');
  assert.match((await score(p, undefined, 5000)).error, /token/i);
  assert.match((await score(p, 'a.b.c', 5000)).error, /inválido/);
  const tq = await startGo(q); await sleep(200);
  assert.match((await score(p, tq, 200)).error, /inválido/);
  const tp = await startGo(p); await sleep(200);
  for (const bad of [200.5, -1, NaN, '200', 1e12]) assert.match((await score(p, tp, bad)).error, /Tiempo inválido/, String(bad));
  assert.match((await score(p, tp, 250, { coins: 1e6 })).error, /inválidos/);
  assert.match((await score(p, tp, 250, { deaths: -2 })).error, /inválidos/);
  assert.match((await score(p, tp, 250, { hero: 'grinch' })).error, /Personaje/);
});

test('(b) no se puede usar ni tomar el Instagram de otro', async () => {
  const a = await player('unica', 'Ana');
  const b = await post('/api/register', { name: 'Otro', ig: 'unica' });
  assert.strictEqual(b.status, 409); assert.strictEqual(b.name, undefined); assert.strictEqual(b.secret, undefined);
  const c = await post('/api/register', { name: 'Otro', ig: 'unica', secret: 'adivino', confirm: true });
  assert.strictEqual(c.status, 409);
  assert.strictEqual((await post('/api/run/start', { ig: 'unica', secret: 'adivino' })).status, 403);
  assert.strictEqual((await score({ ig: 'unica', secret: 'adivino' }, 'x', 300)).status, 403);
  // el dueño vuelve a entrar con su secret: sigue siendo el mismo, y el secret no se vuelve a mandar
  const d = await post('/api/register', { name: 'Ana 2', ig: 'unica', secret: a.secret });
  assert.strictEqual(d.status, 200); assert.strictEqual(d.publicId, a.publicId); assert.strictEqual(d.secret, undefined);
  // el organizador lo libera (cambió de celular): el próximo registro recibe un secret nuevo
  assert.strictEqual((await post('/api/admin/release', { ig: 'unica' })).status, 401);
  assert.strictEqual((await post('/api/admin/release', { ig: 'unica' }, { 'X-Admin-Key': 'k' })).status, 200);
  const e = await post('/api/register', { name: 'Ana', ig: 'unica' });
  assert.strictEqual(e.status, 200); assert.ok(e.secret && e.secret !== a.secret); assert.strictEqual(e.publicId, a.publicId);
});

test('(a) el ranking: una fila por Instagram, el mejor tiempo y ningún secreto', async () => {
  const p = await player('rankeado', 'Rank');
  const play = async (ms) => { const token = await startGo(p); await sleep(ms); return score(p, token, ms, { hero: 'hades' }); };
  assert.strictEqual((await play(600)).status, 200);
  assert.strictEqual((await play(300)).improved, true);
  const r3 = await play(500); assert.strictEqual(r3.improved, false); assert.strictEqual(r3.best, 300);
  const { ranking } = await fetch(URL + '/api/ranking?limit=50').then((r) => r.json());
  const mine = ranking.filter((x) => x.id === p.publicId);
  assert.strictEqual(mine.length, 1); assert.strictEqual(mine[0].timeMs, 300); assert.strictEqual(mine[0].hero, 'hades');
  for (const row of ranking) assert.deepStrictEqual(Object.keys(row).sort(), ['coins', 'hero', 'id', 'name', 'timeMs']);
  const raw = JSON.stringify(ranking);
  assert.ok(!raw.includes(p.secret) && !raw.includes('rankeado') && !raw.includes('pViejo123'));
});

test('migración: el jugador viejo conserva su tiempo y su celular sigue entrando', async () => {
  const pl = JSON.parse(fs.readFileSync(path.join(dataDir, 'players.json'), 'utf8')).viejo;
  assert.ok(pl.publicId && pl.secretHash && !pl.playerId);
  assert.ok(!fs.readFileSync(path.join(dataDir, 'scores.json'), 'utf8').includes('pViejo123'));
  const r = await post('/api/register', { name: 'Viejo', ig: 'viejo', secret: 'pViejo123' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.bestMs, 90000);
});

test('admin: clave solo por header', async () => {
  assert.strictEqual((await fetch(URL + '/api/admin?key=k')).status, 401);
  assert.strictEqual((await fetch(URL + '/api/admin', { headers: { 'X-Admin-Key': 'k' } })).status, 200);
});

test('(d)(e) cabeceras de seguridad, archivos privados y CORS', async () => {
  const r = await fetch(URL + '/');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
  assert.ok(r.headers.get('referrer-policy'));
  for (const f of ['/package.json', '/README.md', '/supabase.sql', '/test/anticheat.test.js', '/tools/arte.py', '/.gitignore']) assert.strictEqual((await fetch(URL + f)).status, 404, f);
  for (const f of ['/server.js', '/data/players.json', '/js/../server.js', '/%2e%2e/server.js']) assert.strictEqual((await fetch(URL + f)).status, 403, f);
  assert.strictEqual((await fetch(URL + '/js/game.js')).status, 200);
  const api = await fetch(URL + '/api/ranking', { headers: { Origin: 'https://otro-sitio.com' } });
  assert.strictEqual(api.headers.get('access-control-allow-origin'), null);
});

test('pedido demasiado grande: 413 (no se cuelga)', async () => {
  const r = await post('/api/register', { name: 'x'.repeat(5000), ig: 'grande' });
  assert.strictEqual(r.status, 413);
});
