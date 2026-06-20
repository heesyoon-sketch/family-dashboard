-- Migration 093: reject revoke audit noise from obsolete background clients.
--
-- A shield may only be revoked by the explicit undo workflow. Old PWA tabs
-- running the former reconciliation code can still call the append-only audit
-- RPC even though migrations 091/092 now block their state mutation. Rejecting
-- those impossible revoke sources keeps the ledger trustworthy and prevents an
-- audit-write storm while clients update.

create or replace function public.guard_achievement_audit_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_type = 'REVOKED'
    and new.source not in ('task_undo', 'revokeUnmetAchievements')
  then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_achievement_audit_event() from public;

drop trigger if exists trg_achievement_audit_events_guard on public.achievement_audit_events;
create trigger trg_achievement_audit_events_guard
before insert on public.achievement_audit_events
for each row
execute function public.guard_achievement_audit_event();
