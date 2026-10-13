-- Hall of Shields: periodic honorary Shields (weekly / monthly).
--
-- Additive only. Existing achievement ("insignia") tables, points, levels,
-- streaks, shop, and routine-penalty protection are untouched.
--
-- 1. shield_daily_schedules — an immutable snapshot of each member's
--    scheduled habit slots for one family-local day, captured shortly after
--    local midnight by pg_cron. Shield denominators come only from these
--    snapshots, so deleting or rescheduling a habit later cannot change a
--    day that has already started. Days before the first snapshot are never
--    evaluated (no fabricated history).
-- 2. shield_evaluations — one audit row per member and period: every
--    candidate, the winner (if any), and eligibility.
-- 3. shield_awards — at most one final award per member and period.
-- 4. shield_award_corrections — append-only log for the rare manual fix.
--
-- Clients can read their own family's rows. All writes happen through
-- server-side code using the service role or SECURITY DEFINER functions that
-- are not executable by browser roles.
--
-- Rollback (loses shield history only):
--   select cron.unschedule('capture-shield-daily-schedules');
--   drop table if exists public.shield_award_corrections, public.shield_awards,
--     public.shield_evaluations, public.shield_daily_schedules;
--   drop function if exists public.capture_shield_daily_schedules(timestamptz),
--     public.finalize_shield_period(jsonb), public.correct_shield_award(uuid, text, text, text, text),
--     public.shield_family_timezone(uuid), public.shield_awards_guard();

-- ---------------------------------------------------------------------------
-- Family timezone (same source as the client: automatic_reward_sale setting)
-- ---------------------------------------------------------------------------
create or replace function public.shield_family_timezone(p_family_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  select nullif(value::jsonb ->> 'timezone', '') into v_tz
  from public.family_settings
  where family_id = p_family_id and key = 'automatic_reward_sale'
  limit 1;
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then
    -- Documented product default for families without a configured zone.
    v_tz := 'America/Toronto';
  end if;
  return v_tz;
exception when others then
  return 'America/Toronto';
end;
$$;
revoke all on function public.shield_family_timezone(uuid) from public, anon;
grant execute on function public.shield_family_timezone(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily schedule snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.shield_daily_schedules (
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     text not null references public.users(id) on delete cascade,
  day         date not null,
  timezone    text not null,
  -- [{ "taskId", "title", "icon", "window": "morning"|"evening" }]
  slots       jsonb not null default '[]'::jsonb,
  -- 'on_time' = captured in the first 3 local hours of the day.
  source      text not null check (source in ('on_time', 'late')),
  captured_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists shield_daily_schedules_family_day_idx on public.shield_daily_schedules (family_id, day);
alter table public.shield_daily_schedules enable row level security;
grant select on public.shield_daily_schedules to authenticated;
create policy shield_daily_schedules_read on public.shield_daily_schedules
  for select to authenticated using (public.is_family_member(family_id));

create or replace function public.capture_shield_daily_schedules(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family record;
  v_tz text;
  v_local timestamp;
  v_day date;
  v_day_key text;
  v_inserted integer := 0;
  v_count integer;
begin
  for v_family in select id from public.families loop
    v_tz := public.shield_family_timezone(v_family.id);
    v_local := p_now at time zone v_tz;
    v_day := v_local::date;
    v_day_key := case extract(isodow from v_day)
      when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
      when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN' end;

    insert into public.shield_daily_schedules (family_id, user_id, day, timezone, slots, source, captured_at)
    select
      v_family.id,
      u.id,
      v_day,
      v_tz,
      coalesce((
        select jsonb_agg(jsonb_build_object('taskId', t.id, 'title', t.title, 'icon', t.icon, 'window', w.win) order by t.sort_order, t.id, w.win)
        from public.tasks t
        cross join (values ('morning'), ('evening')) as w(win)
        where t.user_id = u.id
          and t.family_id = v_family.id
          and t.active = 1
          and t.deleted_at is null
          and public.task_is_due_today(t.days_of_week, t.recurrence, t.time_window, v_day_key, w.win)
      ), '[]'::jsonb),
      case when extract(hour from v_local) < 3 then 'on_time' else 'late' end,
      p_now
    from public.users u
    where u.family_id = v_family.id and u.deleted_at is null
    on conflict (user_id, day) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$$;
revoke all on function public.capture_shield_daily_schedules(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evaluations and awards
-- ---------------------------------------------------------------------------
create table if not exists public.shield_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  user_id             text not null references public.users(id) on delete cascade,
  period_type         text not null check (period_type in ('week', 'month')),
  period_start        date not null,
  period_end          date not null check (period_end >= period_start),
  candidate_results   jsonb not null,
  selected_candidate  jsonb,
  evaluation_status   text not null check (evaluation_status in ('awarded', 'no_award', 'insufficient_data')),
  eligibility_summary jsonb not null,
  evaluated_at        timestamptz not null default now(),
  evaluation_version  text not null,
  unique (user_id, period_type, period_start)
);
create index if not exists shield_evaluations_family_idx on public.shield_evaluations (family_id, period_type, period_start desc);
alter table public.shield_evaluations enable row level security;
grant select on public.shield_evaluations to authenticated;
create policy shield_evaluations_read on public.shield_evaluations
  for select to authenticated using (public.is_family_member(family_id));

create table if not exists public.shield_awards (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null references public.families(id) on delete cascade,
  user_id               text not null references public.users(id) on delete cascade,
  evaluation_id         uuid not null references public.shield_evaluations(id) on delete restrict,
  period_type           text not null check (period_type in ('week', 'month')),
  period_start          date not null,
  period_end            date not null check (period_end >= period_start),
  shield_type           text not null check (shield_type in ('consistency', 'growth', 'comeback', 'teamwork', 'dedication')),
  tier                  text not null check (tier in ('silver', 'gold', 'epic', 'legendary')),
  category              text,
  qualification_metrics jsonb not null,
  awarded_at            timestamptz not null default now(),
  evaluation_version    text not null,
  created_at            timestamptz not null default now(),
  -- One final honorary Shield per member, period type, and period start.
  unique (user_id, period_type, period_start),
  check ((shield_type = 'dedication') = (category is not null))
);
create index if not exists shield_awards_family_idx on public.shield_awards (family_id, period_type, period_start desc);
alter table public.shield_awards enable row level security;
grant select on public.shield_awards to authenticated;
create policy shield_awards_read on public.shield_awards
  for select to authenticated using (public.is_family_member(family_id));

create table if not exists public.shield_award_corrections (
  id           uuid primary key default gen_random_uuid(),
  award_id     uuid not null references public.shield_awards(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  previous     jsonb not null,
  corrected    jsonb not null,
  reason       text not null check (char_length(btrim(reason)) >= 5),
  corrected_by text not null,
  corrected_at timestamptz not null default now()
);
alter table public.shield_award_corrections enable row level security;
grant select on public.shield_award_corrections to authenticated;
create policy shield_award_corrections_read on public.shield_award_corrections
  for select to authenticated using (public.is_family_member(family_id));

-- Awards are immutable. The only way to change one is correct_shield_award,
-- which sets a transaction-local flag and logs the change.
create or replace function public.shield_awards_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Shield awards are permanent records';
  end if;
  if coalesce(current_setting('fambit.shield_correction', true), '') <> 'on' then
    raise exception 'Shield awards are immutable; use correct_shield_award';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.family_id <> old.family_id
     or new.period_type <> old.period_type or new.period_start <> old.period_start then
    raise exception 'Award identity cannot change';
  end if;
  return new;
end;
$$;
drop trigger if exists shield_awards_guard on public.shield_awards;
create trigger shield_awards_guard before update or delete on public.shield_awards
  for each row execute function public.shield_awards_guard();

-- Evaluations are write-once too.
create or replace function public.shield_evaluations_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Shield evaluations are write-once audit records';
end;
$$;
drop trigger if exists shield_evaluations_guard on public.shield_evaluations;
create trigger shield_evaluations_guard before update or delete on public.shield_evaluations
  for each row execute function public.shield_evaluations_guard();

-- Atomic, idempotent finalization of one member-period. Called by the
-- server-side evaluator with the service role. A repeated call returns the
-- existing result without writing anything.
create or replace function public.finalize_shield_period(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := (p_payload ->> 'family_id')::uuid;
  v_user text := p_payload ->> 'user_id';
  v_type text := p_payload ->> 'period_type';
  v_start date := (p_payload ->> 'period_start')::date;
  v_end date := (p_payload ->> 'period_end')::date;
  v_eval_id uuid;
  v_award jsonb := p_payload -> 'award';
  v_award_id uuid;
begin
  if not exists (select 1 from public.users where id = v_user and family_id = v_family) then
    raise exception 'Member does not belong to family';
  end if;
  if v_end >= (now() at time zone public.shield_family_timezone(v_family))::date then
    raise exception 'Period has not ended in the family timezone';
  end if;

  insert into public.shield_evaluations (family_id, user_id, period_type, period_start, period_end, candidate_results, selected_candidate, evaluation_status, eligibility_summary, evaluation_version)
  values (v_family, v_user, v_type, v_start, v_end, p_payload -> 'candidate_results', p_payload -> 'selected_candidate', p_payload ->> 'evaluation_status', p_payload -> 'eligibility_summary', p_payload ->> 'evaluation_version')
  on conflict (user_id, period_type, period_start) do nothing
  returning id into v_eval_id;

  if v_eval_id is null then
    return jsonb_build_object('created', false);
  end if;

  if v_award is not null and jsonb_typeof(v_award) = 'object' then
    insert into public.shield_awards (family_id, user_id, evaluation_id, period_type, period_start, period_end, shield_type, tier, category, qualification_metrics, evaluation_version)
    values (v_family, v_user, v_eval_id, v_type, v_start, v_end, v_award ->> 'shield_type', v_award ->> 'tier', v_award ->> 'category', v_award -> 'qualification_metrics', p_payload ->> 'evaluation_version')
    returning id into v_award_id;
  end if;

  return jsonb_build_object('created', true, 'evaluation_id', v_eval_id, 'award_id', v_award_id);
end;
$$;
revoke all on function public.finalize_shield_period(jsonb) from public, anon, authenticated;

create or replace function public.correct_shield_award(p_award_id uuid, p_shield_type text, p_tier text, p_category text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.shield_awards;
begin
  select * into v_old from public.shield_awards where id = p_award_id for update;
  if not found then raise exception 'Award not found'; end if;
  perform set_config('fambit.shield_correction', 'on', true);
  update public.shield_awards set shield_type = p_shield_type, tier = p_tier, category = p_category where id = p_award_id;
  insert into public.shield_award_corrections (award_id, family_id, previous, corrected, reason, corrected_by)
  values (p_award_id, v_old.family_id,
    jsonb_build_object('shield_type', v_old.shield_type, 'tier', v_old.tier, 'category', v_old.category),
    jsonb_build_object('shield_type', p_shield_type, 'tier', p_tier, 'category', p_category),
    p_reason, coalesce(auth.uid()::text, current_user));
  perform set_config('fambit.shield_correction', 'off', true);
end;
$$;
revoke all on function public.correct_shield_award(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hourly snapshot capture (pg_cron). Each family's day is captured once,
-- shortly after its local midnight.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('capture-shield-daily-schedules', '7 * * * *', $$select public.capture_shield_daily_schedules()$$);

notify pgrst, 'reload schema';
