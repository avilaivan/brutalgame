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
// =====================================================================
(function () {
  const C = NV.CFG;
  const DB = { mode: 'local', ready: false };
  const LKEY = 'navidance_scores_v2', PKEY = 'navidance_players_v1';
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const post = (path, body) => fetch(C.API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const supa = (path, body, extra) => fetch(C.SUPABASE.url + path, Object.assign({ method: body ? 'POST' : 'GET', headers: Object.assign({ apikey: C.SUPABASE.anonKey, Authorization: 'Bearer ' + C.SUPABASE.anonKey, 'Content-Type': 'application/json' }, extra || {}) }, body ? { body: JSON.stringify(body) } : {}));

  DB.init = async function () {
    if (C.SUPABASE.url && C.SUPABASE.anonKey) { DB.mode = 'supabase'; DB.ready = true; return; }
    try {
      const r = await fetch(C.API_BASE + '/api/ping', { cache: 'no-store' });
      if (r.ok) { DB.mode = 'server'; DB.ready = true; return; }
    } catch (e) {}
    DB.mode = 'local'; DB.ready = true;
  };

  // ---------- perfil del jugador (queda guardado en el dispositivo) ----------
  const newId = () => 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  DB.profile = function () { return LS.get('navidance_profile', null); };
  DB.saveProfile = function (name, ig, id) {
    const old = DB.profile();
    const p = { name, ig, id: id || (old && old.ig === ig ? old.id : newId()) };
    LS.set('navidance_profile', p); return p;
  };

  // ---------- registro: un Instagram = un solo jugador ----------
  // Devuelve { ok, id, bestMs } o { exists: true, name } (ese Instagram ya está registrado por otro
  // dispositivo: hay que confirmar "soy yo" con confirm = true) o { error }.
  DB.register = async function (name, ig, confirm) {
    const old = DB.profile(), id = old && old.ig === ig ? old.id : newId();
    if (DB.mode === 'server') {
      try {
        const r = await post('/api/register', { name, ig, playerId: id, confirm: !!confirm }); const j = await r.json();
        if (r.status === 409) return { exists: true, name: j.name };
        if (!r.ok) return { error: j.error || 'No se pudo registrar' };
        return { ok: true, id: j.playerId || id, bestMs: j.bestMs || 0 };
      } catch (e) { return { ok: true, id, offline: true }; } // sin señal: se registra al mandar el primer tiempo
    }
    if (DB.mode === 'supabase') {
      try {
        const r = await supa('/rest/v1/rpc/register_player', { p_name: name, p_ig: ig, p_player_id: id, p_confirm: !!confirm });
        if (!r.ok) return { error: 'No se pudo registrar' };
        const j = await r.json();
        if (j.exists) return { exists: true, name: j.name };
        return { ok: true, id: j.player_id || id, bestMs: j.best_ms || 0 };
      } catch (e) { return { ok: true, id, offline: true }; }
    }
    const all = LS.get(PKEY, {}), cur = all[ig];
    if (cur && cur.id !== id && !confirm) return { exists: true, name: cur.name };
    const pid = cur ? cur.id : id; all[ig] = { name, id: pid }; LS.set(PKEY, all);
    const best = DB.localAll().find((s) => s.ig === ig);
    return { ok: true, id: pid, bestMs: best ? best.timeMs : 0 };
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

  // ---------- inicio de partida (token anti-trampa en el servidor) ----------
  DB.startRun = async function (profile, hero) {
    if (DB.mode !== 'server') return null;
    try {
      const r = await post('/api/run/start', { playerId: profile.id, hero });
      if (r.ok) return (await r.json()).token;
    } catch (e) {}
    return null;
  };

  // ---------- largada ("¡YA!"): el servidor arranca su propio reloj ----------
  DB.go = function (token, playerId) {
    if (DB.mode !== 'server' || !token) return;
    post('/api/run/go', { token, playerId }).catch(() => {});
  };

  // ---------- enviar tiempo ----------
  // run: { name, ig, playerId, hero, timeMs, coins, deaths, token } -> { rank, total, best, improved } o { error }
  DB.submit = async function (run) {
    if (DB.mode === 'server') {
      try {
        const r = await post('/api/score', run); const j = await r.json();
        if (r.ok) return j;
        return { error: j.error || 'No se pudo guardar' };
      } catch (e) { return { error: 'Sin conexión con el servidor' }; }
    }
    if (DB.mode === 'supabase') {
      try {
        const r = await supa('/rest/v1/rpc/submit_score', { p_name: run.name, p_ig: run.ig, p_player_id: run.playerId, p_hero: run.hero, p_time_ms: run.timeMs, p_coins: run.coins, p_deaths: run.deaths });
        if (!r.ok) return { error: 'No se pudo guardar' };
        const j = await r.json();
        return { rank: j.rank || null, total: j.total || null, best: j.best_ms, improved: !!j.improved };
      } catch (e) { return { error: 'Sin conexión' }; }
    }
    // local: una fila por Instagram; solo se reemplaza si el tiempo nuevo es mejor
    const all = DB.localAll(), i = all.findIndex((s) => s.ig === run.ig);
    const row = { name: run.name, ig: run.ig, player: run.playerId, hero: run.hero, timeMs: run.timeMs, coins: run.coins, date: Date.now() };
    let improved = true;
    if (i < 0) all.push(row);
    else if (run.timeMs < all[i].timeMs || (run.timeMs === all[i].timeMs && run.coins > all[i].coins)) all[i] = row;
    else { all[i].name = run.name; improved = false; }
    LS.set(LKEY, all);
    const top = DB.localTop(1000); const k = top.findIndex((x) => x.ig === run.ig);
    return { rank: k + 1, total: top.length, best: top[k].timeMs, improved, local: true };
  };

  DB.localAll = function () { return LS.get(LKEY, []); };
  DB.localTop = function (n) { return DB.localAll().slice().sort((a, b) => a.timeMs - b.timeMs || b.coins - a.coins).slice(0, n); };

  // ---------- leer ranking: [{ name, hero, timeMs, coins, player }] ----------
  DB.top = async function (n = C.RANKING_SIZE) {
    if (DB.mode === 'server') {
      try { const r = await fetch(C.API_BASE + '/api/ranking?limit=' + n, { cache: 'no-store' }); if (r.ok) return (await r.json()).ranking; } catch (e) {}
      return [];
    }
    if (DB.mode === 'supabase') {
      try {
        const r = await supa('/rest/v1/ranking?select=*&order=time_ms.asc,coins.desc&limit=' + n);
        if (r.ok) return (await r.json()).map((x) => ({ name: x.name, hero: x.hero, timeMs: x.time_ms, coins: x.coins, player: x.player_id }));
      } catch (e) {}
      return [];
    }
    return DB.localTop(n);
  };

  NV.DB = DB;
})();
