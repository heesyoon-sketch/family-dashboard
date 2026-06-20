-- Migration 092: fully lock legacy direct updates to Shield Wall-owned columns.
--
-- Migration 091 made stale writes additive. That prevents disappearance, but
-- an obsolete client could still resurrect a shield deliberately revoked by a
-- newer undo. From this migration forward, generic table updates preserve all
-- shield-owned columns exactly. New clients use the validated merge/replace
-- RPCs; unrelated columns and row-level access remain governed by existing RLS.

create or replace function public.guard_achievement_state_replacement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_achievement_state_replace', true), 'off') <> 'on' then
    new.unlocked_at_by_achievement_id := old.unlocked_at_by_achievement_id;
    new.awarded_achievement_ids := old.awarded_achievement_ids;
    new.unlocked_visual_style_ids := old.unlocked_visual_style_ids;
    new.unlock_baseline_at := old.unlock_baseline_at;
    new.equipped_insignia_ids := old.equipped_insignia_ids;
    new.pinned_achievement_ids := old.pinned_achievement_ids;
    new.quest_claims := old.quest_claims;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_achievement_state_replacement() from public;

create or replace function public.merge_achievement_unlock_state(
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
    -- Existing timestamps win; incoming keys are additions only.
    unlocked_at_by_achievement_id =
      excluded.unlocked_at_by_achievement_id
      || achievement_states.unlocked_at_by_achievement_id,
    awarded_achievement_ids = public.merge_jsonb_text_arrays(
      achievement_states.awarded_achievement_ids,
      excluded.awarded_achievement_ids
    ),
    unlocked_visual_style_ids = public.merge_jsonb_text_arrays(
      achievement_states.unlocked_visual_style_ids,
      excluded.unlocked_visual_style_ids
    ),
    unlock_baseline_at = least(
      achievement_states.unlock_baseline_at,
      excluded.unlock_baseline_at
    );
end;
$$;

revoke all on function public.merge_achievement_unlock_state(uuid, text, jsonb, jsonb, jsonb, timestamptz) from public;
grant execute on function public.merge_achievement_unlock_state(uuid, text, jsonb, jsonb, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
