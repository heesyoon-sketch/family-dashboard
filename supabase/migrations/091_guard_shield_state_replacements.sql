-- Migration 091: make Shield Wall state monotonic unless a validated RPC
-- explicitly performs a user-intent replacement or undo-driven revocation.
--
-- Older PWA tabs can keep running obsolete JavaScript after a deploy. Those
-- clients previously upserted stale snapshots that removed unlocks and
-- equipped shields. The trigger below makes generic authenticated upserts
-- additive, so stale clients cannot delete current state. Exact replacements
-- are restricted to the two family-validated security-definer RPCs.

create or replace function public.merge_jsonb_text_arrays(
  p_existing jsonb,
  p_incoming jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(items.value) order by items.source_order, items.item_order), '[]'::jsonb)
  from (
    select existing_item.value, 0 as source_order, existing_item.ordinality as item_order
    from jsonb_array_elements_text(coalesce(p_existing, '[]'::jsonb)) with ordinality as existing_item(value, ordinality)

    union all

    select incoming_item.value, 1 as source_order, incoming_item.ordinality as item_order
    from jsonb_array_elements_text(coalesce(p_incoming, '[]'::jsonb)) with ordinality as incoming_item(value, ordinality)
    where not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_existing, '[]'::jsonb)) as existing_value(value)
      where existing_value.value = incoming_item.value
    )
  ) as items;
$$;

revoke all on function public.merge_jsonb_text_arrays(jsonb, jsonb) from public;

create or replace function public.guard_achievement_state_replacement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_achievement_state_replace', true), 'off') <> 'on' then
    -- Engine-owned progress is monotonic for generic clients. Existing unlock
    -- timestamps win so a stale client cannot rewrite achievement history.
    new.unlocked_at_by_achievement_id :=
      coalesce(new.unlocked_at_by_achievement_id, '{}'::jsonb)
      || coalesce(old.unlocked_at_by_achievement_id, '{}'::jsonb);
    new.awarded_achievement_ids := public.merge_jsonb_text_arrays(
      old.awarded_achievement_ids,
      new.awarded_achievement_ids
    );
    new.unlocked_visual_style_ids := public.merge_jsonb_text_arrays(
      old.unlocked_visual_style_ids,
      new.unlocked_visual_style_ids
    );
    new.unlock_baseline_at := least(old.unlock_baseline_at, new.unlock_baseline_at);

    -- User intent may be added by an older client but removal/reordering must
    -- go through the validated RPC below. This blocks stale auto-unequip writes.
    new.equipped_insignia_ids := public.merge_jsonb_text_arrays(
      old.equipped_insignia_ids,
      new.equipped_insignia_ids
    );
    new.pinned_achievement_ids := public.merge_jsonb_text_arrays(
      old.pinned_achievement_ids,
      new.pinned_achievement_ids
    );
  end if;
  return new;
end;
$$;

revoke all on function public.guard_achievement_state_replacement() from public;

drop trigger if exists trg_achievement_states_guard_replacement on public.achievement_states;
create trigger trg_achievement_states_guard_replacement
before update on public.achievement_states
for each row
execute function public.guard_achievement_state_replacement();

create or replace function public.replace_achievement_state_intent(
  p_family_id uuid,
  p_user_id text,
  p_equipped_insignia_ids jsonb,
  p_pinned_achievement_ids jsonb,
  p_quest_claims jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = p_user_id and u.family_id = p_family_id
  ) then
    raise exception 'achievement state user is not in family';
  end if;
  if jsonb_typeof(p_equipped_insignia_ids) <> 'array'
    or jsonb_typeof(p_pinned_achievement_ids) <> 'array'
    or jsonb_typeof(p_quest_claims) <> 'object'
  then
    raise exception 'invalid achievement intent payload';
  end if;

  perform set_config('app.allow_achievement_state_replace', 'on', true);
  insert into public.achievement_states (
    family_id, user_id, equipped_insignia_ids, pinned_achievement_ids, quest_claims
  ) values (
    p_family_id, p_user_id, p_equipped_insignia_ids, p_pinned_achievement_ids, p_quest_claims
  )
  on conflict (family_id, user_id) do update set
    equipped_insignia_ids = excluded.equipped_insignia_ids,
    pinned_achievement_ids = excluded.pinned_achievement_ids,
    quest_claims = excluded.quest_claims;
end;
$$;

revoke all on function public.replace_achievement_state_intent(uuid, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_achievement_state_intent(uuid, text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.replace_achievement_unlock_state(
  p_family_id uuid,
  p_user_id text,
  p_unlocked_at_by_achievement_id jsonb,
  p_awarded_achievement_ids jsonb,
  p_unlocked_visual_style_ids jsonb,
  p_unlock_baseline_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'not allowed';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = p_user_id and u.family_id = p_family_id
  ) then
    raise exception 'achievement state user is not in family';
  end if;
  if jsonb_typeof(p_unlocked_at_by_achievement_id) <> 'object'
    or jsonb_typeof(p_awarded_achievement_ids) <> 'array'
    or jsonb_typeof(p_unlocked_visual_style_ids) <> 'array'
    or p_unlock_baseline_at is null
  then
    raise exception 'invalid achievement unlock payload';
  end if;

  perform set_config('app.allow_achievement_state_replace', 'on', true);
  insert into public.achievement_states (
    family_id,
    user_id,
    unlocked_at_by_achievement_id,
    awarded_achievement_ids,
    unlocked_visual_style_ids,
    unlock_baseline_at
  ) values (
    p_family_id,
    p_user_id,
    p_unlocked_at_by_achievement_id,
    p_awarded_achievement_ids,
    p_unlocked_visual_style_ids,
    p_unlock_baseline_at
  )
  on conflict (family_id, user_id) do update set
    unlocked_at_by_achievement_id = excluded.unlocked_at_by_achievement_id,
    awarded_achievement_ids = excluded.awarded_achievement_ids,
    unlocked_visual_style_ids = excluded.unlocked_visual_style_ids,
    unlock_baseline_at = excluded.unlock_baseline_at;
end;
$$;

revoke all on function public.replace_achievement_unlock_state(uuid, text, jsonb, jsonb, jsonb, timestamptz) from public;
grant execute on function public.replace_achievement_unlock_state(uuid, text, jsonb, jsonb, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
