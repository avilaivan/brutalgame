-- =====================================================================
--  SALVA LA NAVIDANCE — base de datos en Supabase (opción para hosting estático)
--  1. Creá un proyecto en supabase.com
--  2. SQL Editor -> pegá y ejecutá este archivo completo
--  3. En js/core.js completá NV.CFG.SUPABASE = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' }
--
--  Reglas (las mismas que server.js):
--   · El nombre puede ser cualquiera; el usuario de Instagram es ÚNICO (clave de la tabla).
--   · Cada Instagram juega las veces que quiera y figura UNA vez, con su MEJOR tiempo:
--     un tiempo mejor reemplaza al anterior, nunca se acumulan.
--  Los Instagram se ven solo desde el panel de Supabase (Table Editor -> players).
-- =====================================================================
create table if not exists public.players (
  instagram text primary key check (instagram ~ '^[a-z0-9._]{1,30}$'),
  name text not null check (char_length(name) between 2 and 16),
  player_id text not null check (char_length(player_id) <= 40),
  hero text check (hero in ('ivan', 'hades', 'matias')),
  time_ms integer check (time_ms between 30000 and 180000),   -- mejor tiempo (null = todavía no terminó el nivel)
  coins integer not null default 0 check (coins between 0 and 999),
  deaths integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
-- el público NO lee ni escribe la tabla directo (tiene los Instagram): todo pasa por las funciones de abajo

-- registro: devuelve { exists, name } si el Instagram ya es de otro dispositivo y no se confirmó
create or replace function public.register_player(p_name text, p_ig text, p_player_id text, p_confirm boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare cur public.players%rowtype;
begin
  p_ig := lower(trim(leading '@' from p_ig));
  select * into cur from public.players where instagram = p_ig;
  if found and cur.player_id <> p_player_id and not p_confirm then
    return json_build_object('exists', true, 'name', cur.name);
  end if;
  if found then
    update public.players set name = p_name, updated_at = now() where instagram = p_ig;
    return json_build_object('ok', true, 'player_id', cur.player_id, 'best_ms', coalesce(cur.time_ms, 0));
  end if;
  insert into public.players (instagram, name, player_id) values (p_ig, p_name, p_player_id);
  return json_build_object('ok', true, 'player_id', p_player_id, 'best_ms', 0);
end $$;

-- enviar un tiempo: solo reemplaza si es mejor que el guardado
create or replace function public.submit_score(p_name text, p_ig text, p_player_id text, p_hero text, p_time_ms integer, p_coins integer, p_deaths integer)
returns json language plpgsql security definer set search_path = public as $$
declare cur public.players%rowtype; better boolean; v_rank integer; v_total integer; v_best integer;
begin
  p_ig := lower(trim(leading '@' from p_ig));
  if p_time_ms < 30000 or p_time_ms > 180000 then raise exception 'tiempo invalido'; end if;
  select * into cur from public.players where instagram = p_ig;
  if not found then
    insert into public.players (instagram, name, player_id) values (p_ig, p_name, p_player_id);
    select * into cur from public.players where instagram = p_ig;
  elsif cur.player_id <> p_player_id then
    raise exception 'instagram registrado por otro jugador';
  end if;
  better := cur.time_ms is null or p_time_ms < cur.time_ms or (p_time_ms = cur.time_ms and p_coins > cur.coins);
  if better then
    update public.players set name = p_name, hero = p_hero, time_ms = p_time_ms, coins = greatest(0, least(999, p_coins)), deaths = greatest(0, p_deaths), plays = plays + 1, updated_at = now() where instagram = p_ig;
  else
    update public.players set name = p_name, plays = plays + 1 where instagram = p_ig;
  end if;
  select time_ms into v_best from public.players where instagram = p_ig;
  select count(*) into v_total from public.players where time_ms is not null;
  select count(*) + 1 into v_rank from public.players where time_ms is not null and time_ms < v_best;
  return json_build_object('rank', v_rank, 'total', v_total, 'best_ms', v_best, 'improved', better);
end $$;

grant execute on function public.register_player(text, text, text, boolean) to anon;
grant execute on function public.submit_score(text, text, text, text, integer, integer, integer) to anon;

-- ranking público: una fila por Instagram, SIN mostrar el Instagram
create or replace view public.ranking with (security_invoker = false) as
select name, hero, time_ms, coins, player_id
from public.players
where time_ms is not null
order by time_ms asc, coins desc;

grant select on public.ranking to anon;
