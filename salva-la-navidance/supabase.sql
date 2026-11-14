-- =====================================================================
--  SALVA LA NAVIDANCE \u2014 base de datos en Supabase (opción para hosting estático)
--  1. Creá un proyecto en supabase.com
--  2. SQL Editor -> pegá y ejecutá este archivo completo (sirve para instalar de cero
--     Y para migrar una base de la versión anterior: no se pierden los tiempos)
--  3. En js/core.js completá NV.CFG.SUPABASE = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' }
--
--  Reglas (las mismas que server.js):
--   · El nombre puede ser cualquiera; el usuario de Instagram es ÚNICO y queda atado al dispositivo
--     que lo registró (secret de 128 bits; acá se guarda solo su hash). Nadie lo puede "tomar".
--   · Cada Instagram juega las veces que quiera y figura UNA vez, con su MEJOR tiempo.
--   · Cada partida necesita un token (start_run) que vence, se usa una sola vez y lleva el reloj del
--     servidor: largada (run_go) y llegada (run_finish). El tiempo enviado tiene que coincidir.
--   · Las tablas tienen RLS sin políticas: el público solo usa las funciones y la vista "ranking".
--  Los Instagram se ven solo desde el panel de Supabase (Table Editor -> players).
--  Para liberar un Instagram (el dueño cambió de celular):
--     update public.players set secret_hash = null where instagram = 'usuario';
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.players (
  instagram text primary key check (instagram ~ '^[a-z0-9._]{1,30}$'),
  name text not null check (char_length(name) between 2 and 16),
  public_id uuid not null default gen_random_uuid(),
  secret_hash text,
  hero text check (hero in ('ivan', 'hades', 'matias')),
  time_ms integer check (time_ms between 30000 and 180000),   -- mejor tiempo (null = todavía no terminó el nivel)
  coins integer not null default 0 check (coins between 0 and 999),
  deaths integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MIGRACIÓN desde la versión anterior (player_id público que hacía de clave) ----------
-- El player_id viejo pasa a ser el secret de ese celular (se guarda su hash) y se borra la columna.
alter table public.players add column if not exists public_id uuid not null default gen_random_uuid();
alter table public.players add column if not exists secret_hash text;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'player_id') then
    update public.players set secret_hash = encode(extensions.digest(player_id, 'sha256'), 'hex') where secret_hash is null;
    drop view if exists public.ranking;
    alter table public.players drop column player_id;
  end if;
end $$;
drop function if exists public.register_player(text, text, text, boolean);
drop function if exists public.submit_score(text, text, text, text, integer, integer, integer);

create table if not exists public.runs (
  token uuid primary key default gen_random_uuid(),
  instagram text not null references public.players (instagram) on delete cascade,
  started_at timestamptz not null default clock_timestamp(),
  go_at timestamptz,
  fin_at timestamptz,
  used boolean not null default false
);
create index if not exists runs_ig_idx on public.runs (instagram, started_at);
create table if not exists public.rate_hits (k text not null, at timestamptz not null default clock_timestamp());
create index if not exists rate_hits_idx on public.rate_hits (k, at);

alter table public.players enable row level security;
alter table public.runs enable row level security;
alter table public.rate_hits enable row level security;
revoke all on public.players, public.runs, public.rate_hits from anon, authenticated;

-- ---------- ayudantes (no se exponen al público) ----------
create or replace function public._limited(p_key text, p_max integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.rate_hits where at < clock_timestamp() - interval '2 minutes';
  insert into public.rate_hits (k) values (p_key);
  select count(*) into n from public.rate_hits where k = p_key and at > clock_timestamp() - interval '1 minute';
  return n > p_max;
end $$;

create or replace function public._ip() returns text language sql stable as $$
  select coalesce(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), '?')
$$;

create or replace function public._auth(p_ig text, p_secret text)
returns public.players language sql security definer set search_path = public as $$
  select * from public.players
  where instagram = lower(trim(leading '@' from p_ig)) and secret_hash is not null
    and p_secret is not null and length(p_secret) between 1 and 64
    and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
$$;

create or replace function public._clean(p text, n integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[<>\x01-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]', '', 'g'), '\s+', ' ', 'g')), n)
$$;

revoke all on function public._limited(text, integer), public._ip(), public._auth(text, text), public._clean(text, integer) from public, anon, authenticated;

-- ---------- registro: { exists } si el Instagram es de otro dispositivo; si es nuevo, entrega el secret UNA vez ----------
create or replace function public.register_player(p_name text, p_ig text, p_secret text default null)
returns json language plpgsql security definer set search_path = public as $$
declare cur public.players%rowtype; v_secret text; v_name text := public._clean(p_name, 16);
begin
  p_ig := lower(trim(leading '@' from coalesce(p_ig, '')));
  if public._limited('reg:' || public._ip(), 60) or public._limited('regig:' || p_ig, 10) then raise exception 'demasiados intentos'; end if;
  if char_length(v_name) < 2 then raise exception 'nombre invalido'; end if;
  if p_ig !~ '^[a-z0-9._]{1,30}$' then raise exception 'instagram invalido'; end if;
  select * into cur from public.players where instagram = p_ig;
  if found and cur.secret_hash is not null then
    if (public._auth(p_ig, p_secret)).instagram is null then return json_build_object('exists', true); end if;
    update public.players set name = v_name, updated_at = now() where instagram = p_ig;
    return json_build_object('ok', true, 'public_id', cur.public_id, 'best_ms', coalesce(cur.time_ms, 0));
  end if;
  if not found and p_ig ~ '(^\.)|(\.$)|(\.\.)' then raise exception 'instagram invalido'; end if;
  v_secret := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.players (instagram, name, secret_hash) values (p_ig, v_name, encode(extensions.digest(v_secret, 'sha256'), 'hex'))
  on conflict (instagram) do update set name = excluded.name, secret_hash = excluded.secret_hash, updated_at = now();
  select * into cur from public.players where instagram = p_ig;
  return json_build_object('ok', true, 'public_id', cur.public_id, 'secret', v_secret, 'best_ms', coalesce(cur.time_ms, 0));
end $$;

-- ---------- token de la partida (se pide al empezar la cuenta regresiva) ----------
create or replace function public.start_run(p_ig text, p_secret text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pl public.players%rowtype; v uuid;
begin
  pl := public._auth(p_ig, p_secret);
  if pl.instagram is null then raise exception 'jugador no registrado en este dispositivo'; end if;
  if public._limited('start:' || pl.instagram, 40) then raise exception 'demasiadas partidas'; end if;
  delete from public.runs where started_at < clock_timestamp() - interval '1 day';
  insert into public.runs (instagram) values (pl.instagram) returning token into v;
  return v;
end $$;

create or replace function public.run_go(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.runs set go_at = clock_timestamp()
  where token = p_token and go_at is null and fin_at is null and not used and started_at > clock_timestamp() - interval '15 minutes'
$$;
create or replace function public.run_finish(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.runs set fin_at = clock_timestamp()
  where token = p_token and fin_at is null and not used and started_at > clock_timestamp() - interval '15 minutes'
$$;

-- ---------- enviar un tiempo: solo reemplaza si es mejor que el guardado ----------
create or replace function public.submit_score(p_ig text, p_secret text, p_token uuid, p_hero text, p_time_ms integer, p_coins integer, p_deaths integer)
returns json language plpgsql security definer set search_path = public as $$
declare
  pl public.players%rowtype; r public.runs%rowtype; better boolean; v_rank integer; v_total integer; v_best integer;
  v_end timestamptz; v_from_go numeric; v_from_start numeric;
  c_min constant integer := 35000;   -- mínimo aceptado (el físico del nivel es ~29 s; ver server.js)
  c_tol constant integer := 3000;    -- tolerancia de red entre el reloj del juego y el del servidor
  c_count constant integer := 4500;  -- cuenta regresiva (4 beats) + latencia
begin
  pl := public._auth(p_ig, p_secret);
  if pl.instagram is null then raise exception 'instagram no registrado en este dispositivo'; end if;
  if public._limited('score:' || pl.instagram, 15) or public._limited('score:' || public._ip(), 120) then raise exception 'demasiados intentos'; end if;
  if p_hero is null or p_hero not in ('ivan', 'hades', 'matias') then raise exception 'personaje invalido'; end if;
  if p_time_ms is null or p_time_ms < c_min or p_time_ms > 180000 then raise exception 'tiempo invalido'; end if;
  if p_coins is null or p_coins < 0 or p_coins > 999 or p_deaths is null or p_deaths < 0 or p_deaths > 999 then raise exception 'datos invalidos'; end if;
  select * into r from public.runs where token = p_token and instagram = pl.instagram for update;
  if not found then raise exception 'token invalido'; end if;
  if r.used then raise exception 'esta partida ya fue enviada'; end if;
  if r.started_at < clock_timestamp() - interval '15 minutes' then raise exception 'la partida vencio'; end if;
  v_end := coalesce(r.fin_at, clock_timestamp());
  v_from_start := extract(epoch from (v_end - r.started_at)) * 1000;
  v_from_go := extract(epoch from (v_end - coalesce(r.go_at, r.started_at))) * 1000;
  if p_time_ms > v_from_go + c_tol then raise exception 'tiempo imposible'; end if;
  if p_time_ms < v_from_start - c_count or (r.go_at is not null and p_time_ms < v_from_go - c_tol) then raise exception 'el tiempo no coincide con el del servidor'; end if;
  update public.runs set used = true where token = p_token;

  better := pl.time_ms is null or p_time_ms < pl.time_ms or (p_time_ms = pl.time_ms and p_coins > pl.coins);
  if better then
    update public.players set hero = p_hero, time_ms = p_time_ms, coins = p_coins, deaths = p_deaths, plays = plays + 1, updated_at = now() where instagram = pl.instagram;
  else
    update public.players set plays = plays + 1 where instagram = pl.instagram;
  end if;
  select time_ms into v_best from public.players where instagram = pl.instagram;
  select count(*) into v_total from public.players where time_ms is not null;
  select count(*) + 1 into v_rank from public.players where time_ms is not null and time_ms < v_best;
  return json_build_object('rank', v_rank, 'total', v_total, 'best_ms', v_best, 'improved', better);
end $$;

revoke all on function public.register_player(text, text, text), public.start_run(text, text), public.run_go(uuid), public.run_finish(uuid),
  public.submit_score(text, text, uuid, text, integer, integer, integer) from public;
grant execute on function public.register_player(text, text, text) to anon;
grant execute on function public.start_run(text, text) to anon;
grant execute on function public.run_go(uuid) to anon;
grant execute on function public.run_finish(uuid) to anon;
grant execute on function public.submit_score(text, text, uuid, text, integer, integer, integer) to anon;

-- ranking público: una fila por Instagram, SIN Instagram ni secretos (public_id marca "tu fila")
create or replace view public.ranking with (security_invoker = false) as
select name, hero, time_ms, coins, public_id
from public.players
where time_ms is not null
order by time_ms asc, coins desc;

revoke all on public.ranking from public, authenticated;
grant select on public.ranking to anon;
