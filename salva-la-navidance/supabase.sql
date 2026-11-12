-- =====================================================================
--  SALVA LA NAVIDANCE — base de datos en Supabase (opción para hosting estático)
--  1. Creá un proyecto en supabase.com
--  2. SQL Editor -> pegá y ejecutá este archivo
--  3. En js/core.js completá NV.CFG.SUPABASE = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' }
--  Los Instagram se ven solo desde el panel de Supabase (Table Editor -> scores).
-- =====================================================================
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 16),
  instagram text not null check (instagram ~ '^[a-z0-9._]{1,30}$'),
  player_id text not null check (char_length(player_id) <= 40),
  hero text not null check (hero in ('ivan', 'hades', 'matias')),
  time_ms integer not null check (time_ms between 30000 and 180000),
  coins integer not null default 0 check (coins between 0 and 999),
  deaths integer not null default 0
);

alter table public.scores enable row level security;
-- el público solo puede INSERTAR (no leer la tabla con los Instagram)
drop policy if exists "insertar partidas" on public.scores;
create policy "insertar partidas" on public.scores for insert to anon with check (true);

-- ranking público: mejor tiempo por jugador, SIN Instagram
create or replace view public.ranking with (security_invoker = false) as
select distinct on (instagram) name, hero, time_ms, coins, player_id
from public.scores
order by instagram, time_ms asc, coins desc;

grant select on public.ranking to anon;
