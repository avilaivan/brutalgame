// =====================================================================
//  BASE DE DATOS / RANKING DE TIEMPO
//  Modo 1: servidor propio (server.js)  -> /api/...
//  Modo 2: Supabase (si se completa NV.CFG.SUPABASE)
//  Modo 3: local (solo este dispositivo) si no hay ninguno de los anteriores
//
//  Reglas del ranking (iguales en los 3 modos):
//   · El NOMBRE puede ser cualquiera; el USUARIO DE INSTAGRAM es único (se registra una sola vez).
//   · Cada Instagram puede jugar las veces que quiera: en el ranking figura UNA vez, con su MEJOR tiempo
//     (un tiempo mejor reemplaza al anterior; no se acumulan).
//   · La sombra (ghost) y el récord personal son siempre los de ese mismo Instagram.
//
//  Perfil guardado en el dispositivo: { name, ig, id, secret }
//   · id     = identificador público (marca "tu fila" en el ranking)
//   · secret = clave de este dispositivo; el servidor la entrega una sola vez al registrarse
// =====================================================================
(function () {
  const C = NV.CFG;
  const DB = { mode: 'local', ready: false, onSent: null };
  const LKEY = 'navidance_scores_v2', PKEY = 'navidance_players_v1', QKEY = 'navidance_pending_v1';
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const post = (path, body) => fetch(C.API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const supa = (path, body, extra) => fetch(C.SUPABASE.url + path, Object.assign({ method: body ? 'POST' : 'GET', headers: Object.assign({ apikey: C.SUPABASE.anonKey, Authorization: 'Bearer ' + C.SUPABASE.anonKey, 'Content-Type': 'application/json' }, extra || {}) }, body ? { body: JSON.stringify(body) } : {}));
  const rpc = (fn, args) => supa('/rest/v1/rpc/' + fn, args);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const online = () => DB.mode === 'server' || DB.mode === 'supabase';

  let initP = null;
  DB.init = () => initP || (initP = init()); // una sola vez aunque se llame de varios lados
  async function init() {
    if (C.SUPABASE.url && C.SUPABASE.anonKey) DB.mode = 'supabase';
    else {
      DB.mode = 'local';
      try { const r = await fetch(C.API_BASE + '/api/ping', { cache: 'no-store' }); if (r.ok) DB.mode = 'server'; } catch (e) {}
    }
    DB.ready = true;
    // perfil de la versión anterior (sin secret): su id viejo es ahora su secret; se pide el id público
    const p = DB.profile();
    if (p && !p.secret && online()) {
      const r = await DB.register(p.name, p.ig);
      if (r.ok) DB.saveProfile(p.name, p.ig, r.id, r.secret);
    }
    if (online()) { DB.flush(); setInterval(DB.flush, 15000); window.addEventListener('online', DB.flush); }
  }

  // ---------- perfil del jugador (queda guardado en el dispositivo) ----------
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''));
  DB.profile = function () { return LS.get('navidance_profile', null); };
  // secret del perfil (los perfiles viejos usaban su id como clave)
  const secretOf = (p) => (p ? p.secret || p.id : null);
  DB.saveProfile = function (name, ig, id, secret) {
    const old = DB.profile(), same = old && old.ig === ig;
    const p = { name, ig, id: id || (same ? old.id : newId()), secret: secret || (same ? secretOf(old) : null) };
    if (!p.secret && DB.mode === 'local') p.secret = p.id;
    LS.set('navidance_profile', p); return p;
  };

  // ---------- registro: un Instagram = un solo jugador ----------
  // Devuelve { ok, id, secret, bestMs } o { exists: true } (ese Instagram es de otro dispositivo) o { error }.
  DB.register = async function (name, ig) {
    const old = DB.profile(), secret = old && old.ig === ig ? secretOf(old) : undefined;
    if (DB.mode === 'server') {
      try {
        const r = await post('/api/register', { name, ig, secret }); const j = await r.json();
        if (r.status === 409) return { exists: true };
        if (!r.ok) return { error: j.error || 'No se pudo registrar' };
        return { ok: true, id: j.publicId, secret: j.secret || secret, bestMs: j.bestMs || 0 };
      } catch (e) { return { error: 'Sin conexión con el servidor. Probá de nuevo.' }; }
    }
    if (DB.mode === 'supabase') {
      try {
        const r = await rpc('register_player', { p_name: name, p_ig: ig, p_secret: secret || null });
        if (!r.ok) return { error: 'No se pudo registrar' };
        const j = await r.json();
        if (j.exists) return { exists: true };
        return { ok: true, id: j.public_id, secret: j.secret || secret, bestMs: j.best_ms || 0 };
      } catch (e) { return { error: 'Sin conexión. Probá de nuevo.' }; }
    }
    const all = LS.get(PKEY, {}), cur = all[ig], id = secret || newId();
    if (cur && cur.id !== id) return { exists: true };
    all[ig] = { name, id }; LS.set(PKEY, all);
    const best = DB.localAll().find((s) => s.ig === ig);
    return { ok: true, id, secret: id, bestMs: best ? best.timeMs : 0 };
  };

  // ---------- récord personal, parciales y sombra: propios de cada Instagram ----------
  const key = (k) => { const p = DB.profile(); return 'navidance_' + k + '_' + (p ? p.ig : 'anon'); };
  DB.best = function () { return parseFloat(LS.get(key('pb'), 0)) || 0; };
  DB.setBest = function (t) { LS.set(key('pb'), t); };
  DB.splits = function () { return LS.get(key('splits'), []); };
  DB.setSplits = function (s) { LS.set(key('splits'), s); };
  // ghost: recorrido de tu mejor partida ({ hero, f: [[x, y, anim, frame, dir] | 0, ...] a 30 muestras por segundo })
  DB.ghost = function () { const g = LS.get(key('ghost'), null); return g && g.v === NV.VERSION ? g : null; }; // el arte cambió: las sombras viejas no sirven
  DB.setGhost = function (g) { g.v = NV.VERSION; LS.set(key('ghost'), g); };

  // ---------- inicio de partida (token anti-trampa): se pide al empezar la cuenta regresiva ----------
  DB.startRun = async function (profile) {
    try {
      if (DB.mode === 'server') { const r = await post('/api/run/start', { ig: profile.ig, secret: secretOf(profile) }); if (r.ok) return (await r.json()).token; }
      if (DB.mode === 'supabase') { const r = await rpc('start_run', { p_ig: profile.ig, p_secret: secretOf(profile) }); if (r.ok) return await r.json(); }
    } catch (e) {}
    return null;
  };

  // ---------- largada ("¡YA!") y llegada (jefe vencido): el servidor anota su propio reloj ----------
  // Se reintenta un par de veces rápido: si llega tarde, el reloj del servidor ya no coincide.
  async function mark(what, token, ig) {
    if (!online() || !token) return;
    for (let i = 0; i < 3; i++) {
      try {
        const r = DB.mode === 'server' ? await post('/api/run/' + what, { token, ig }) : await rpc('run_' + what, { p_token: token });
        if (r.ok || r.status < 500) return;
      } catch (e) {}
      await sleep(400);
    }
  }
  DB.go = (token, ig) => mark('go', token, ig);
  DB.finish = (token, ig) => mark('finish', token, ig);

  // ---------- enviar tiempo ----------
  // run: { ig, secret, hero, timeMs, coins, deaths, token } -> { rank, total, best, improved } o { error }
  // Sin señal: reintenta con espera creciente y, si no puede, lo guarda en una cola del dispositivo que se
  // vuelve a mandar sola (cada 15 s, al recuperar la señal o al abrir el juego). Un récord no se pierde.
  async function send(run) { // tira excepción si es un problema de red (para reintentar)
    if (DB.mode === 'server') {
      const r = await post('/api/score', run);
      if (r.status >= 500 || r.status === 429) throw new Error('red');
      const j = await r.json();
      return r.ok ? j : { error: j.error || 'No se pudo guardar' };
    }
    const r = await rpc('submit_score', { p_ig: run.ig, p_secret: run.secret, p_token: run.token, p_hero: run.hero, p_time_ms: run.timeMs, p_coins: run.coins, p_deaths: run.deaths });
    if (r.status >= 500 || r.status === 429) throw new Error('red');
    if (!r.ok) { let m = 'No se pudo guardar'; try { m = (await r.json()).message || m; } catch (e) {} return { error: m }; }
    const j = await r.json();
    return { rank: j.rank || null, total: j.total || null, best: j.best_ms, improved: !!j.improved };
  }
  const queue = () => LS.get(QKEY, []);
  const unqueue = (token) => LS.set(QKEY, queue().filter((q) => q.token !== token));
  let flushing = false;
  DB.flush = async function () {
    if (flushing || !online()) return; flushing = true;
    for (const run of queue()) {
      try { const r = await send(run); unqueue(run.token); if (DB.onSent) DB.onSent(run.token, r); } catch (e) { break; }
    }
    flushing = false;
  };
  DB.pending = () => queue().length;

  DB.submit = async function (run) {
    if (online()) {
      if (!run.token) return { error: 'La partida no se registró en el servidor (sin señal al empezar)' };
      for (const wait of [0, 1000, 2000, 4000]) {
        if (wait) await sleep(wait);
        try { return await send(run); } catch (e) {}
      }
      LS.set(QKEY, queue().filter((q) => q.token !== run.token).concat([run]).slice(-5));
      return { queued: true, error: 'Sin señal: tu tiempo quedó guardado y se manda solo' };
    }
    // local: una fila por Instagram; solo se reemplaza si el tiempo nuevo es mejor
    const all = DB.localAll(), i = all.findIndex((s) => s.ig === run.ig), me = DB.profile();
    const row = { name: (me && me.name) || run.ig, ig: run.ig, id: me && me.id, hero: run.hero, timeMs: run.timeMs, coins: run.coins, date: Date.now() };
    let improved = true;
    if (i < 0) all.push(row);
    else if (run.timeMs < all[i].timeMs || (run.timeMs === all[i].timeMs && run.coins > all[i].coins)) all[i] = row;
    else { all[i].name = row.name; improved = false; }
    LS.set(LKEY, all);
    const top = DB.localTop(1000); const k = top.findIndex((x) => x.ig === run.ig);
    return { rank: k + 1, total: top.length, best: top[k].timeMs, improved, local: true };
  };

  DB.localAll = function () { return LS.get(LKEY, []); };
  DB.localTop = function (n) { return DB.localAll().slice().sort((a, b) => a.timeMs - b.timeMs || b.coins - a.coins).slice(0, n); };

  // ---------- leer ranking: [{ name, hero, timeMs, coins, id }] ----------
  DB.top = async function (n = C.RANKING_SIZE) {
    if (DB.mode === 'server') {
      try { const r = await fetch(C.API_BASE + '/api/ranking?limit=' + n, { cache: 'no-store' }); if (r.ok) return (await r.json()).ranking; } catch (e) {}
      return [];
    }
    if (DB.mode === 'supabase') {
      try {
        const r = await supa('/rest/v1/ranking?select=*&order=time_ms.asc,coins.desc&limit=' + n);
        if (r.ok) return (await r.json()).map((x) => ({ name: x.name, hero: x.hero, timeMs: x.time_ms, coins: x.coins, id: x.public_id }));
      } catch (e) {}
      return [];
    }
    return DB.localTop(n);
  };

  NV.DB = DB;
})();
