// Prueba del anti-trampa del servidor. Correr con:  npm test
// Levanta server.js en otro puerto con una base de datos temporal.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const PORT = 3999, URL = 'http://localhost:' + PORT;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navidance-'));
let srv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b, h = {}) => fetch(URL + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const run = { name: 'Test', ig: 'test_user', playerId: 'p1', hero: 'ivan', coins: 3, deaths: 0 };

before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: dataDir, ADMIN_KEY: 'k', MIN_SEC: '0.1' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(URL + '/api/ping'); return; } catch (e) { await sleep(100); } }
});
after(() => { srv.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

async function startGo() {
  const { token } = await post('/api/run/start', { playerId: 'p1' });
  await post('/api/run/go', { token, playerId: 'p1' });
  return token;
}

test('partida honesta: se acepta y no se puede reenviar', async () => {
  const token = await startGo(); await sleep(400);
  const r = await post('/api/score', { ...run, token, timeMs: 400 });
  assert.strictEqual(r.status, 200, r.error);
  const again = await post('/api/score', { ...run, token, timeMs: 400 });
  assert.match(again.error, /ya fue enviada/);
});

test('tiempo más largo que lo que pasó: rechazado', async () => {
  const token = await startGo();
  const r = await post('/api/score', { ...run, token, timeMs: 10000 });
  assert.match(r.error, /imposible/);
});

test('cronómetro editado (más rápido que el reloj del servidor): rechazado', async () => {
  const token = await startGo(); await sleep(3500);
  const r = await post('/api/score', { ...run, token, timeMs: 200 });
  assert.match(r.error, /no coincide/);
});

test('admin: clave solo por header', async () => {
  assert.strictEqual((await fetch(URL + '/api/admin?key=k')).status, 401);
  assert.strictEqual((await fetch(URL + '/api/admin', { headers: { 'X-Admin-Key': 'k' } })).status, 200);
});
