// Panel de administración (admin.html). Va en un archivo aparte: la CSP no permite scripts en línea.
(function () {
    const fmt = (ms) => { const s = ms / 1000, m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + (s % 60).toFixed(2).padStart(5, '0'); };
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const keyEl = document.getElementById('key'); keyEl.value = sessionStorage.getItem('nv_admin') || '';
    async function load() {
      const key = keyEl.value; if (!key) return;
      sessionStorage.setItem('nv_admin', key);
      try {
        const r = await fetch('/api/admin', { cache: 'no-store', headers: { 'X-Admin-Key': key } });
        const j = await r.json();
        if (!r.ok) { document.getElementById('msg').textContent = j.error || 'Error'; return; }
        document.getElementById('msg').textContent = '';
        document.getElementById('stats').textContent = j.players + ' JUGADORES · ' + j.total + ' PARTIDAS TERMINADAS';
        const cols = ['#f5c542', '#dfe6f5', '#e0904a'];
        document.getElementById('top3').innerHTML = j.ranking.slice(0, 3).map((s, i) => `<div class="card" style="--c:${cols[i]}"><div class="pos">TOP ${i + 1}</div><div class="name">${esc(s.name)}</div><a href="https://instagram.com/${esc(s.ig)}" target="_blank" rel="noopener noreferrer">@${esc(s.ig)}</a><div class="time">${fmt(s.timeMs)} · <span class="h-${esc(s.hero)}">${esc(s.hero).toUpperCase()}</span></div></div>`).join('');
        document.getElementById('rows').innerHTML = j.ranking.map((s) => `<tr><td>${+s.rank}</td><td>${esc(s.name)}</td><td><a href="https://instagram.com/${esc(s.ig)}" target="_blank" rel="noopener noreferrer">@${esc(s.ig)}</a></td><td class="h-${esc(s.hero)}">${esc(s.hero).toUpperCase()}</td><td class="t">${fmt(s.timeMs)}</td><td>${+s.coins}</td><td>${+s.deaths}</td><td>${+s.plays}</td><td>${new Date(s.date).toLocaleString('es-AR')}</td></tr>`).join('');
      } catch (e) { document.getElementById('msg').textContent = 'No se pudo conectar con el servidor (¿está corriendo node server.js?)'; }
    }
    // CSV: se pide con la clave en el header y se descarga desde memoria
    document.getElementById('csv').onclick = async (e) => {
      e.preventDefault();
      const r = await fetch('/api/admin?format=csv', { headers: { 'X-Admin-Key': keyEl.value } });
      if (!r.ok) { document.getElementById('msg').textContent = 'Clave incorrecta'; return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'ranking-navidance.csv'; a.click();
    };
    document.getElementById('go').onclick = load; keyEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    // liberar un Instagram: el dueño cambió de celular (verificalo antes). El próximo registro recibe una clave nueva.
    document.getElementById('free').onclick = async () => {
      const ig = document.getElementById('freeIg').value.trim().replace(/^@+/, '').toLowerCase(); if (!ig) return;
      if (!confirm('¿Liberar @' + ig + '? Su tiempo queda en el ranking; el próximo que se registre con ese Instagram lo usa.')) return;
      const r = await fetch('/api/admin/release', { method: 'POST', headers: { 'X-Admin-Key': keyEl.value, 'Content-Type': 'application/json' }, body: JSON.stringify({ ig }) });
      const j = await r.json(); document.getElementById('msg').textContent = r.ok ? '@' + ig + ' liberado' : (j.error || 'Error');
    };
    load(); setInterval(load, 15000);
})();
