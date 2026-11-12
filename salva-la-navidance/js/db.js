// =====================================================================
//  BASE DE DATOS / RANKING DE TIEMPO
//  Modo 1: servidor propio (server.js)  -> /api/...
//  Modo 2: Supabase (si se completa NV.CFG.SUPABASE)
//  Modo 3: local (solo este dispositivo) si no hay ninguno de los anteriores
// =====================================================================
(function () {
  const C = NV.CFG;
  const DB = { mode: 'local', ready: false };
  const LKEY = 'navidance_scores_v1';

  DB.init = async function () {
    if (C.SUPABASE.url && C.SUPABASE.anonKey) { DB.mode = 'supabase'; DB.ready = true; return; }
    try {
      const r = await fetch(C.API_BASE + '/api/ping', { cache: 'no-store' });
      if (r.ok) { DB.mode = 'server'; DB.ready = true; return; }
    } catch (e) {}
    DB.mode = 'local'; DB.ready = true;
  };

  // ---------- perfil del jugador (queda guardado en el dispositivo) ----------
  DB.profile = function () { try { return JSON.parse(localStorage.getItem('navidance_profile') || 'null'); } catch (e) { return null; } };
  DB.saveProfile = function (name, ig) {
    const old = DB.profile();
    const p = { name, ig, id: old && old.ig === ig ? old.id : 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36) };
    localStorage.setItem('navidance_profile', JSON.stringify(p)); return p;
  };
  DB.best = function () { return parseFloat(localStorage.getItem('navidance_pb') || '0') || 0; };
  DB.setBest = function (t) { localStorage.setItem('navidance_pb', String(t)); };
  DB.splits = function () { try { return JSON.parse(localStorage.getItem('navidance_splits') || '[]'); } catch (e) { return []; } };
  DB.setSplits = function (s) { localStorage.setItem('navidance_splits', JSON.stringify(s)); };

  // ---------- inicio de partida (token anti-trampa en el servidor) ----------
  DB.startRun = async function (profile, hero) {
    if (DB.mode !== 'server') return null;
    try {
      const r = await fetch(C.API_BASE + '/api/run/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: profile.id, hero }) });
      if (r.ok) return (await r.json()).token;
    } catch (e) {}
    return null;
  };

  // ---------- enviar tiempo ----------
  DB.submit = async function (run) {
    // run: { name, ig, playerId, hero, timeMs, coins, deaths, token }
    if (DB.mode === 'server') {
      try {
        const r = await fetch(C.API_BASE + '/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });
        const j = await r.json();
        if (r.ok) return j;
        return { error: j.error || 'No se pudo guardar' };
      } catch (e) { return { error: 'Sin conexión con el servidor' }; }
    }
    if (DB.mode === 'supabase') {
      try {
        const h = { apikey: C.SUPABASE.anonKey, Authorization: 'Bearer ' + C.SUPABASE.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
        const r = await fetch(C.SUPABASE.url + '/rest/v1/scores', { method: 'POST', headers: h, body: JSON.stringify({ name: run.name, instagram: run.ig, player_id: run.playerId, hero: run.hero, time_ms: run.timeMs, coins: run.coins, deaths: run.deaths }) });
        if (!r.ok) return { error: 'No se pudo guardar' };
        const top = await DB.top(1000);
        const i = top.findIndex((x) => x.player === run.playerId || (x.name === run.name && x.timeMs <= run.timeMs));
        return { rank: i >= 0 ? i + 1 : null, total: top.length };
      } catch (e) { return { error: 'Sin conexión' }; }
    }
    // local
    const all = DB.localAll(); all.push({ name: run.name, ig: run.ig, player: run.playerId, hero: run.hero, timeMs: run.timeMs, coins: run.coins, date: Date.now() });
    localStorage.setItem(LKEY, JSON.stringify(all));
    const top = DB.localTop(1000); const i = top.findIndex((x) => x.player === run.playerId);
    return { rank: i + 1, total: top.length, local: true };
  };

  DB.localAll = function () { try { return JSON.parse(localStorage.getItem(LKEY) || '[]'); } catch (e) { return []; } };
  DB.localTop = function (n) {
    const best = {};
    for (const s of DB.localAll()) { const k = (s.ig || s.name).toLowerCase(); if (!best[k] || s.timeMs < best[k].timeMs || (s.timeMs === best[k].timeMs && s.coins > best[k].coins)) best[k] = s; }
    return Object.values(best).sort((a, b) => a.timeMs - b.timeMs || b.coins - a.coins).slice(0, n);
  };

  // ---------- leer ranking ----------
  DB.top = async function (n = C.RANKING_SIZE) {
    if (DB.mode === 'server') {
      try { const r = await fetch(C.API_BASE + '/api/ranking?limit=' + n, { cache: 'no-store' }); if (r.ok) return (await r.json()).ranking; } catch (e) {}
      return [];
    }
    if (DB.mode === 'supabase') {
      try {
        const h = { apikey: C.SUPABASE.anonKey, Authorization: 'Bearer ' + C.SUPABASE.anonKey };
        const r = await fetch(C.SUPABASE.url + '/rest/v1/ranking?select=*&order=time_ms.asc,coins.desc&limit=' + n, { headers: h });
        if (r.ok) return (await r.json()).map((x) => ({ name: x.name, hero: x.hero, timeMs: x.time_ms, coins: x.coins, player: x.player_id }));
      } catch (e) {}
      return [];
    }
    return DB.localTop(n);
  };

  NV.DB = DB;
})();
