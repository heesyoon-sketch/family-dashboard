-- Shield Wall 4.0 — monthly Shield equipment and scoped point bonuses.
--
-- EARN LAST MONTH. EQUIP THIS MONTH. Shields earned from month A's verified
-- performance (schedule snapshots) can be equipped during month A+1 only.
-- Up to three, one per type. Equipped Shields add a scoped, capped bonus to
-- eligible task completions, computed inside the authoritative completion
-- transaction and recorded in an immutable ledger.
--
-- Additive only. Existing tables keep their data. The weekly Hall of Shields
-- tables (shield_awards) stay as an unused, empty record; shield_evaluations
-- is reused for monthly evaluations (period_type = 'month').
--
-- Rollout: shield_config.mode starts as 'simulate' — bonuses are computed and
-- written to the ledger, but no points are credited. Switch to 'live' only
-- after verifying ledger results:  update public.shield_config set mode = 'live';
--
-- Rollback:
--   update public.shield_config set mode = 'off';   -- stops all bonus effects
--   (the completion/undo hooks become no-ops; no other change is needed).

-- ---------------------------------------------------------------------------
-- 1. Versioned balance configuration (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.shield_config (
  id          integer primary key default 1 check (id = 1),
  version     text not null,
  mode        text not null default 'simulate' check (mode in ('off', 'simulate', 'live')),
  -- { "rateBp": {"silver":200,"gold":500,"epic":1000,"legendary":1500},
  --   "capBp": 3000, "fallbackFactorPct": 50, "countsTowardXp": false,
  --   "maxClockSkewHours": 36 }
  rules       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into public.shield_config (id, version, mode, rules)
values (1, 'equip-v1', 'simulate', '{"rateBp":{"silver":200,"gold":500,"epic":1000,"legendary":1500},"capBp":3000,"fallbackFactorPct":50,"countsTowardXp":false,"maxClockSkewHours":36}')
on conflict (id) do nothing;
alter table public.shield_config enable row level security;
grant select on public.shield_config to authenticated;
create policy shield_config_read on public.shield_config for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. Monthly awards (equipment entitlements)
-- ---------------------------------------------------------------------------
create table if not exists public.shield_monthly_awards (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null references public.families(id) on delete cascade,
  user_id               text not null references public.users(id) on delete cascade,
  evaluation_id         uuid not null references public.shield_evaluations(id) on delete cascade,
  evaluation_month      date not null check (extract(day from evaluation_month) = 1),
  equipment_month       date not null,
  shield_type           text not null check (shield_type in ('consistency', 'growth', 'comeback', 'teamwork', 'dedication')),
  tier                  text not null check (tier in ('silver', 'gold', 'epic', 'legendary')),
  category              text,
  -- {"kind":"all"} | {"kind":"categories","categories":[...]} | {"kind":"mission"}
  scope                 jsonb not null,
  bonus_rate_bp         integer not null check (bonus_rate_bp between 0 and 3000),
  qualification_metrics jsonb not null,
  config_version        text not null,
  evaluation_version    text not null,
  created_at            timestamptz not null default now(),
  unique (user_id, evaluation_month, shield_type),
  check (equipment_month = (evaluation_month + interval '1 month')::date),
  check ((shield_type = 'dedication') = (category is not null))
);
create index if not exists shield_monthly_awards_family_idx on public.shield_monthly_awards (family_id, equipment_month);
alter table public.shield_monthly_awards enable row level security;
grant select on public.shield_monthly_awards to authenticated;
create policy shield_monthly_awards_read on public.shield_monthly_awards
  for select to authenticated using (public.is_family_member(family_id));

create or replace function public.shield_immutable_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Cascades from family/user deletion run at trigger depth > 1.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception '% rows are immutable records', tg_table_name;
end;
$$;
drop trigger if exists shield_monthly_awards_guard on public.shield_monthly_awards;
create trigger shield_monthly_awards_guard before update or delete on public.shield_monthly_awards
  for each row execute function public.shield_immutable_guard();

-- ---------------------------------------------------------------------------
-- 3. Equipment (effective-dated)
-- ---------------------------------------------------------------------------
create table if not exists public.shield_equipment (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  user_id         text not null references public.users(id) on delete cascade,
  award_id        uuid not null references public.shield_monthly_awards(id) on delete cascade,
  shield_type     text not null,
  slot_number     integer not null check (slot_number between 1 and 3),
  equipment_month date not null,
  equipped_at     timestamptz not null default now(),
  unequipped_at   timestamptz,
  created_at      timestamptz not null default now(),
  check (unequipped_at is null or unequipped_at >= equipped_at)
);
create unique index if not exists shield_equipment_active_slot on public.shield_equipment (user_id, equipment_month, slot_number) where unequipped_at is null;
create unique index if not exists shield_equipment_active_type on public.shield_equipment (user_id, equipment_month, shield_type) where unequipped_at is null;
create unique index if not exists shield_equipment_active_award on public.shield_equipment (award_id) where unequipped_at is null;
create index if not exists shield_equipment_user_month_idx on public.shield_equipment (user_id, equipment_month, equipped_at);
alter table public.shield_equipment enable row level security;
grant select on public.shield_equipment to authenticated;
create policy shield_equipment_read on public.shield_equipment
  for select to authenticated using (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- 4. Bonus ledger (immutable)
-- ---------------------------------------------------------------------------
create table if not exists public.shield_bonus_ledger (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  user_id              text not null references public.users(id) on delete cascade,
  -- No FK: undo deletes the completion, the audit row stays.
  task_completion_id   text not null,
  task_id              text not null,
  entry_type           text not null check (entry_type in ('award', 'reversal')),
  mode                 text not null check (mode in ('simulate', 'live')),
  equipment_month      date not null,
  equipment_snapshot   jsonb not null,
  eligible_base_points integer not null check (eligible_base_points >= 0),
  applicable_rate_bp   integer not null check (applicable_rate_bp between 0 and 3000),
  bonus_points         integer not null,
  counted_toward_xp    boolean not null default false,
  calculation_version  text not null,
  reverses_entry_id    uuid references public.shield_bonus_ledger(id) on delete cascade,
  created_at           timestamptz not null default now(),
  unique (task_completion_id, entry_type),
  check ((entry_type = 'award') = (bonus_points >= 0)),
  check ((entry_type = 'reversal') = (reverses_entry_id is not null))
);
create index if not exists shield_bonus_ledger_user_month_idx on public.shield_bonus_ledger (user_id, equipment_month);
alter table public.shield_bonus_ledger enable row level security;
grant select on public.shield_bonus_ledger to authenticated;
create policy shield_bonus_ledger_read on public.shield_bonus_ledger
  for select to authenticated using (public.is_family_member(family_id));
drop trigger if exists shield_bonus_ledger_guard on public.shield_bonus_ledger;
create trigger shield_bonus_ledger_guard before update or delete on public.shield_bonus_ledger
  for each row execute function public.shield_immutable_guard();

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------
-- Same taxonomy as achievements, without the "responsibility" fallback, and
-- with a "both" habit taking the window it is completed in.
create or replace function public.shield_task_categories(p_title text, p_icon text, p_task_window text, p_current_window text)
returns text[]
language sql
immutable
set search_path = public
as $$
  with t as (
    select lower(coalesce(p_title, '') || ' ' || coalesce(p_icon, '')) as txt,
           case when p_task_window = 'both' then p_current_window else coalesce(p_task_window, 'evening') end as win
  )
  select array_remove(array[
    case when txt ~ '(read|book|diary|workbook|homework|page|독서|책|일기|문제집|숙제)' then 'learning' end,
    case when txt ~ '(bible|qt|pray|prayer|faith|reflection|묵상|성경|기도)' then 'faith' end,
    case when txt ~ '(clean|cleanup|laundry|room|toy|bed|pajama|정리|빨래|장난감|침구|잠옷)' then 'responsibility' end,
    case when txt ~ '(exercise|workout|move|run|운동|스트레칭)' then 'exercise' end,
    case when txt ~ '(brush|tooth|wash|lotion|vitamin|supplement|hygiene|양치|세수|로션|비타민|영양제)' then 'health' end,
    case when txt ~ '(school|backpack|bag|prepare|학교|가방|준비)' then 'school' end,
    case when txt ~ '(morning|affirmation|아침|확언)' or win = 'morning' then 'morning' end,
    case when txt ~ '(evening|night|pajama|저녁|밤|잠옷)' or win = 'evening' then 'evening' end
  ], null)
  from t;
$$;

create or replace function public.shield_current_month(p_family_id uuid, p_at timestamptz default statement_timestamp())
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc('month', p_at at time zone public.shield_family_timezone(p_family_id))::date;
$$;
grant execute on function public.shield_current_month(uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Monthly finalization (service role only, idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.finalize_shield_month(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := (p_payload ->> 'family_id')::uuid;
  v_user text := p_payload ->> 'user_id';
  v_month date := (p_payload ->> 'evaluation_month')::date;
  v_end date := ((p_payload ->> 'evaluation_month')::date + interval '1 month - 1 day')::date;
  v_eval uuid;
  v_award jsonb;
  v_count integer := 0;
begin
  if not exists (select 1 from public.users where id = v_user and family_id = v_family) then
    raise exception 'Member does not belong to family';
  end if;
  if extract(day from v_month) <> 1 then raise exception 'evaluation_month must be the first day of a month'; end if;
  if v_end >= (now() at time zone public.shield_family_timezone(v_family))::date then
    raise exception 'Month has not ended in the family timezone';
  end if;

  insert into public.shield_evaluations (family_id, user_id, period_type, period_start, period_end, candidate_results, selected_candidate, evaluation_status, eligibility_summary, evaluation_version)
  values (v_family, v_user, 'month', v_month, v_end, p_payload -> 'candidate_results', null, p_payload ->> 'evaluation_status', p_payload -> 'eligibility_summary', p_payload ->> 'evaluation_version')
  on conflict (user_id, period_type, period_start) do nothing
  returning id into v_eval;
  if v_eval is null then return jsonb_build_object('created', false); end if;

  for v_award in select * from jsonb_array_elements(coalesce(p_payload -> 'awards', '[]'::jsonb)) loop
    insert into public.shield_monthly_awards (family_id, user_id, evaluation_id, evaluation_month, equipment_month, shield_type, tier, category, scope, bonus_rate_bp, qualification_metrics, config_version, evaluation_version)
    values (v_family, v_user, v_eval, v_month, (v_month + interval '1 month')::date, v_award ->> 'shield_type', v_award ->> 'tier', v_award ->> 'category', v_award -> 'scope', (v_award ->> 'bonus_rate_bp')::integer, v_award -> 'qualification_metrics', p_payload ->> 'config_version', p_payload ->> 'evaluation_version');
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('created', true, 'evaluation_id', v_eval, 'awards', v_count);
end;
$$;
revoke all on function public.finalize_shield_month(jsonb) from public, anon, authenticated;
grant execute on function public.finalize_shield_month(jsonb) to service_role;

-- Close equipment rows left open from earlier months (tidiness only —
-- bonus eligibility always checks the current month, so a missed run can
-- never keep an old Shield active).
create or replace function public.close_expired_shield_equipment()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.shield_equipment e
  set unequipped_at = greatest(e.equipped_at, ((e.equipment_month + interval '1 month')::timestamp at time zone public.shield_family_timezone(e.family_id)))
  where e.unequipped_at is null
    and e.equipment_month < public.shield_current_month(e.family_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.close_expired_shield_equipment() from public, anon, authenticated;
grant execute on function public.close_expired_shield_equipment() to service_role;

-- ---------------------------------------------------------------------------
-- 7. Equipment changes (family members; validated server-side)
-- ---------------------------------------------------------------------------
-- Sets a member's whole loadout for the current month in one transaction.
-- p_award_ids order = slot order. Unchanged Shields keep their original
-- equipped_at; removed ones are closed now; nothing is ever retroactive.
create or replace function public.shield_set_loadout(p_user_id text, p_award_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public.get_my_family_id();
  v_month date;
  v_ids uuid[] := coalesce(p_award_ids, array[]::uuid[]);
  v_award public.shield_monthly_awards;
  v_slot integer := 0;
  v_now timestamptz := statement_timestamp();
  v_existing public.shield_equipment;
begin
  if v_family is null or auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users where id = p_user_id and family_id = v_family and deleted_at is null) then
    raise exception 'Member not found';
  end if;
  if array_length(v_ids, 1) > 3 then raise exception 'At most three Shields can be equipped'; end if;
  if (select count(distinct x) from unnest(v_ids) x) <> coalesce(array_length(v_ids, 1), 0) then raise exception 'Duplicate Shield'; end if;

  -- Serialize concurrent edits for this member (two family devices).
  perform pg_advisory_xact_lock(hashtextextended('shield-loadout:' || p_user_id, 0));
  v_month := public.shield_current_month(v_family, v_now);

  -- Validate every requested award first.
  if exists (
    select 1 from unnest(v_ids) req(id)
    left join public.shield_monthly_awards a on a.id = req.id
    where a.id is null or a.user_id <> p_user_id or a.family_id <> v_family or a.equipment_month <> v_month
  ) then
    raise exception 'Only this month''s Shields earned by this member can be equipped';
  end if;
  if (select count(distinct a.shield_type) from public.shield_monthly_awards a where a.id = any(v_ids)) <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'Only one Shield per type can be equipped';
  end if;

  -- Close everything that is not staying in the same slot.
  for v_existing in
    select * from public.shield_equipment
    where user_id = p_user_id and equipment_month = v_month and unequipped_at is null
    for update
  loop
    if array_position(v_ids, v_existing.award_id) is distinct from v_existing.slot_number then
      update public.shield_equipment set unequipped_at = v_now where id = v_existing.id;
    end if;
  end loop;

  foreach v_slot in array (select coalesce(array_agg(i), array[]::int[]) from generate_subscripts(v_ids, 1) i) loop
    if not exists (select 1 from public.shield_equipment where user_id = p_user_id and equipment_month = v_month and unequipped_at is null and award_id = v_ids[v_slot]) then
      select * into v_award from public.shield_monthly_awards where id = v_ids[v_slot];
      insert into public.shield_equipment (family_id, user_id, award_id, shield_type, slot_number, equipment_month, equipped_at)
      values (v_family, p_user_id, v_award.id, v_award.shield_type, v_slot, v_month, v_now);
    end if;
  end loop;

  return jsonb_build_object('equipmentMonth', v_month, 'equipped', to_jsonb(v_ids), 'at', v_now);
end;
$$;
revoke all on function public.shield_set_loadout(text, uuid[]) from public, anon;
grant execute on function public.shield_set_loadout(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Bonus calculation and issuance (called only from the completion RPC)
-- ---------------------------------------------------------------------------
create or replace function public.shield_bonus_quote(p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_task public.tasks;
  v_cfg public.shield_config;
  v_month date;
  v_cats text[];
  v_mission_tasks text[] := array[]::text[];
  v_week_start date;
  v_sum integer := 0;
  v_cap integer;
  v_rate integer;
  v_snapshot jsonb := '[]'::jsonb;
  v_row record;
  v_applies boolean;
begin
  select * into v_cfg from public.shield_config where id = 1;
  if coalesce(v_cfg.mode, 'off') = 'off' then return null; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = p_user_id;
  if not found then return null; end if;
  v_family := v_task.family_id;
  v_month := public.shield_current_month(v_family, p_at);
  v_cats := public.shield_task_categories(v_task.title, v_task.icon, v_task.time_window, p_current_window);
  v_week_start := (date_trunc('week', p_at at time zone public.shield_family_timezone(v_family)))::date;
  select coalesce(array_agg(distinct s ->> 'taskId'), array[]::text[]) into v_mission_tasks
  from public.family_mission_weeks w,
       jsonb_array_elements(w.rules -> 'participants') p,
       jsonb_array_elements(p -> 'slots') s
  where w.family_id = v_family and w.week_start = v_week_start and w.status = 'active' and p ->> 'id' = p_user_id;

  for v_row in
    select e.id as equipment_id, a.id as award_id, a.shield_type, a.tier, a.scope, a.bonus_rate_bp, e.slot_number
    from public.shield_equipment e
    join public.shield_monthly_awards a on a.id = e.award_id
    where e.user_id = p_user_id
      and e.equipment_month = v_month
      and a.equipment_month = v_month
      and e.equipped_at <= p_at
      and (e.unequipped_at is null or e.unequipped_at > p_at)
    order by e.slot_number
  loop
    v_applies := case v_row.scope ->> 'kind'
      when 'all' then true
      when 'categories' then exists (select 1 from jsonb_array_elements_text(v_row.scope -> 'categories') c where c = any(v_cats))
      when 'mission' then p_task_id = any(v_mission_tasks)
      else false
    end;
    if v_applies then v_sum := v_sum + v_row.bonus_rate_bp; end if;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('equipmentId', v_row.equipment_id, 'awardId', v_row.award_id, 'type', v_row.shield_type, 'tier', v_row.tier, 'rateBp', v_row.bonus_rate_bp, 'scope', v_row.scope, 'applies', v_applies));
  end loop;
  if jsonb_array_length(v_snapshot) = 0 then return null; end if;

  v_cap := coalesce((v_cfg.rules ->> 'capBp')::integer, 3000);
  v_rate := least(v_sum, v_cap);
  return jsonb_build_object(
    'month', v_month,
    'categories', to_jsonb(v_cats),
    'snapshot', v_snapshot,
    'sumBp', v_sum,
    'rateBp', v_rate,
    'basePoints', greatest(p_base_points, 0),
    -- Integer math only: floor(base × rate / 10000).
    'bonusPoints', (greatest(p_base_points, 0) * v_rate) / 10000,
    'mode', v_cfg.mode,
    'version', v_cfg.version,
    'countsTowardXp', coalesce((v_cfg.rules ->> 'countsTowardXp')::boolean, false),
    'maxClockSkewHours', coalesce((v_cfg.rules ->> 'maxClockSkewHours')::integer, 36)
  );
end;
$$;
revoke all on function public.shield_bonus_quote(text, text, text, integer, timestamptz) from public, anon, authenticated;

create or replace function public.apply_shield_bonus(p_completion_id text, p_user_id text, p_task_id text, p_current_window text, p_base_points integer, p_completed_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_server_now timestamptz := statement_timestamp();
  v_quote jsonb;
  v_family uuid;
  v_bonus integer;
  v_entry uuid;
  v_xp boolean;
  v_level public.levels;
  v_new_total integer;
begin
  -- Equipment is judged at server time; a completion whose client timestamp
  -- is far from server time (offline replay, clock tampering) earns nothing.
  v_quote := public.shield_bonus_quote(p_user_id, p_task_id, p_current_window, p_base_points, v_server_now);
  if v_quote is null then return null; end if;
  if abs(extract(epoch from (v_server_now - p_completed_at))) > (v_quote ->> 'maxClockSkewHours')::integer * 3600
     or public.shield_current_month((select family_id from public.users where id = p_user_id), p_completed_at) <> (v_quote ->> 'month')::date then
    return jsonb_build_object('bonusPoints', 0, 'reason', 'time_mismatch');
  end if;

  select family_id into v_family from public.users where id = p_user_id;
  v_bonus := (v_quote ->> 'bonusPoints')::integer;
  v_xp := (v_quote ->> 'countsTowardXp')::boolean;

  insert into public.shield_bonus_ledger (family_id, user_id, task_completion_id, task_id, entry_type, mode, equipment_month, equipment_snapshot, eligible_base_points, applicable_rate_bp, bonus_points, counted_toward_xp, calculation_version)
  values (v_family, p_user_id, p_completion_id, p_task_id, 'award', v_quote ->> 'mode', (v_quote ->> 'month')::date, v_quote -> 'snapshot', (v_quote ->> 'basePoints')::integer, (v_quote ->> 'rateBp')::integer, v_bonus, v_xp and v_quote ->> 'mode' = 'live', v_quote ->> 'version')
  on conflict (task_completion_id, entry_type) do nothing
  returning id into v_entry;
  if v_entry is null then return jsonb_build_object('bonusPoints', 0, 'reason', 'duplicate'); end if;

  if v_quote ->> 'mode' = 'live' and v_bonus > 0 then
    select * into v_level from public.levels where user_id = p_user_id for update;
    v_new_total := v_level.total_points + case when v_xp then v_bonus else 0 end;
    update public.levels
    set spendable_balance = spendable_balance + v_bonus,
        total_points = v_new_total,
        current_level = case when v_xp then public.level_for_points(v_new_total) else current_level end,
        updated_at = v_server_now
    where user_id = p_user_id;
  end if;
  return jsonb_build_object('bonusPoints', case when v_quote ->> 'mode' = 'live' then v_bonus else 0 end, 'simulatedBonusPoints', v_bonus, 'rateBp', (v_quote ->> 'rateBp')::integer, 'mode', v_quote ->> 'mode', 'ledgerId', v_entry);
end;
$$;
revoke all on function public.apply_shield_bonus(text, text, text, text, integer, timestamptz) from public, anon, authenticated;

-- Reverses a completion's live Shield bonus exactly once. Raises (rolling
-- back the undo) if the bonus has already been spent — same rule the app
-- already uses for task points; no negative balances.
create or replace function public.reverse_shield_bonus(p_completion_id text, p_user_id text, p_points_awarded integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.shield_bonus_ledger;
  v_level public.levels;
  v_total integer;
begin
  select * into v_entry from public.shield_bonus_ledger
  where task_completion_id = p_completion_id and entry_type = 'award' and user_id = p_user_id;
  if not found then return 0; end if;
  if exists (select 1 from public.shield_bonus_ledger where task_completion_id = p_completion_id and entry_type = 'reversal') then return 0; end if;

  if v_entry.mode = 'live' and v_entry.bonus_points > 0 then
    select * into v_level from public.levels where user_id = p_user_id for update;
    if coalesce(v_level.spendable_balance, 0) < v_entry.bonus_points + greatest(coalesce(p_points_awarded, 0), 0) then
      raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
    end if;
    v_total := greatest(v_level.total_points - case when v_entry.counted_toward_xp then v_entry.bonus_points else 0 end, 0);
    update public.levels
    set spendable_balance = spendable_balance - v_entry.bonus_points,
        total_points = v_total,
        current_level = case when v_entry.counted_toward_xp then public.level_for_points(v_total) else current_level end,
        updated_at = statement_timestamp()
    where user_id = p_user_id;
  end if;

  insert into public.shield_bonus_ledger (family_id, user_id, task_completion_id, task_id, entry_type, mode, equipment_month, equipment_snapshot, eligible_base_points, applicable_rate_bp, bonus_points, counted_toward_xp, calculation_version, reverses_entry_id)
  values (v_entry.family_id, v_entry.user_id, v_entry.task_completion_id, v_entry.task_id, 'reversal', v_entry.mode, v_entry.equipment_month, v_entry.equipment_snapshot, v_entry.eligible_base_points, v_entry.applicable_rate_bp, -v_entry.bonus_points, v_entry.counted_toward_xp, v_entry.calculation_version, v_entry.id);
  return case when v_entry.mode = 'live' then v_entry.bonus_points else 0 end;
end;
$$;
revoke all on function public.reverse_shield_bonus(text, text, integer) from public, anon, authenticated;

-- Default loadout (service role, called by the monthly cron right after
-- finalization). Applies only when the member has never touched this month's
-- loadout, so a manual choice is never overridden. The best combination is
-- chosen by lib/shields/equipment.ts (autoEquip) and validated here.
create or replace function public.shield_auto_equip(p_user_id text, p_award_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_month date;
  v_ids uuid[] := coalesce(p_award_ids, array[]::uuid[]);
  v_now timestamptz := statement_timestamp();
  i integer;
begin
  select family_id into v_family from public.users where id = p_user_id and deleted_at is null;
  if v_family is null then raise exception 'Member not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shield-loadout:' || p_user_id, 0));
  v_month := public.shield_current_month(v_family, v_now);
  if exists (select 1 from public.shield_equipment where user_id = p_user_id and equipment_month = v_month) then
    return false;
  end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then return false; end if;
  if array_length(v_ids, 1) > 3
     or (select count(*) from public.shield_monthly_awards a where a.id = any(v_ids) and a.user_id = p_user_id and a.equipment_month = v_month) <> array_length(v_ids, 1)
     or (select count(distinct a.shield_type) from public.shield_monthly_awards a where a.id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Invalid default loadout';
  end if;
  for i in 1 .. array_length(v_ids, 1) loop
    insert into public.shield_equipment (family_id, user_id, award_id, shield_type, slot_number, equipment_month, equipped_at)
    select v_family, p_user_id, a.id, a.shield_type, i, v_month, v_now from public.shield_monthly_awards a where a.id = v_ids[i];
  end loop;
  return true;
end;
$$;
revoke all on function public.shield_auto_equip(text, uuid[]) from public, anon, authenticated;
grant execute on function public.shield_auto_equip(text, uuid[]) to service_role;

-- Browsers read only; every write goes through the functions above.
revoke all on public.shield_config, public.shield_monthly_awards, public.shield_equipment, public.shield_bonus_ledger from anon;
revoke insert, update, delete, truncate on public.shield_config, public.shield_monthly_awards, public.shield_equipment, public.shield_bonus_ledger from authenticated;
grant select on public.shield_config, public.shield_monthly_awards, public.shield_equipment, public.shield_bonus_ledger to service_role;

-- ---------------------------------------------------------------------------
-- 9. Hook into the authoritative completion / undo RPCs.
--    Bodies are the live definitions verbatim; only the marked blocks are new.
--    The bonus never changes pointsAwarded: it is a separate ledger credit.
-- ---------------------------------------------------------------------------
create or replace function public.process_task_completion_atomic(p_user_id text, p_task_id text, p_partial boolean, p_day_start timestamp with time zone, p_day_key text, p_time_window text, p_now timestamp with time zone, p_bonus_percent numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_role text;
  v_expected_window text;
  v_sale_context jsonb;
  v_sale_day boolean := false;
  -- Shield equipment
  v_result jsonb;
  v_completion_id text;
  v_partial boolean;
  v_base integer;
  v_shield jsonb;
  v_level_json jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' and p_time_window = 'evening' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day
    and p_time_window = 'evening' and p_now >= p_day_start + interval '22 hours'
  then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  v_result := public.process_task_completion_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_partial, p_day_start, p_day_key,
    p_time_window, p_now, p_bonus_percent
  );

  -- Shield equipment bonus: same transaction, on base points only, once per
  -- completion (ledger unique key). Duplicate completions award 0 points
  -- upstream and are skipped here.
  if coalesce((v_result ->> 'pointsAwarded')::integer, 0) > 0 then
    select c.id, c.partial, t.base_points into v_completion_id, v_partial, v_base
    from public.task_completions c join public.tasks t on t.id = c.task_id
    where c.user_id = p_user_id and c.task_id = p_task_id and c.completed_at = p_now
    order by c.id limit 1;
    if v_completion_id is not null then
      v_shield := public.apply_shield_bonus(
        v_completion_id, p_user_id, p_task_id, p_time_window,
        case when v_partial then ceil(v_base * 0.5)::integer else v_base end,
        p_now);
      if v_shield is not null then
        select jsonb_build_object('userId', l.user_id, 'currentLevel', l.current_level, 'totalPoints', l.total_points, 'spendableBalance', l.spendable_balance, 'updatedAt', l.updated_at)
          into v_level_json from public.levels l where l.user_id = p_user_id;
        v_result := v_result || jsonb_build_object('shieldBonus', v_shield, 'level', v_level_json);
      end if;
    end if;
  end if;
  return v_result;
end;
$function$;

create or replace function public.process_task_undo_atomic(p_user_id text, p_task_id text, p_day_start timestamp with time zone, p_day_key text, p_time_window text, p_now timestamp with time zone)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_role text;
  v_expected_window text;
  v_sale_context jsonb;
  v_sale_day boolean := false;
  -- Shield equipment
  v_undo_task public.tasks;
  v_undo_completion text;
  v_undo_points integer;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' and p_time_window = 'evening' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day
    and p_time_window = 'evening' and p_now >= p_day_start + interval '22 hours'
  then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  -- Reverse the Shield bonus of the completion about to be undone (same row
  -- the inner function deletes). Raises if the bonus was already spent, which
  -- rolls back the whole undo.
  select tt.* into v_undo_task from public.tasks tt where tt.id = p_task_id and tt.user_id = p_user_id;
  select c.id, c.points_awarded into v_undo_completion, v_undo_points
  from public.task_completions c
  where c.user_id = p_user_id and c.task_id = p_task_id
    and c.completed_at >= public.task_completion_window_start(p_day_start, v_undo_task.time_window, p_time_window)
    and c.completed_at < public.task_completion_window_end(p_day_start, v_undo_task.time_window, p_time_window)
  order by c.completed_at desc limit 1;
  if v_undo_completion is not null then
    perform public.reverse_shield_bonus(v_undo_completion, p_user_id, v_undo_points);
  end if;

  return public.process_task_undo_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_day_start, p_day_key, p_time_window, p_now
  );
end;
$function$;

notify pgrst, 'reload schema';
