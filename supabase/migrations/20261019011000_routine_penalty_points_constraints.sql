-- Penalty rows may now record any configured amount (1-1000), not just 50.
alter table public.morning_routine_penalties
  drop constraint if exists morning_routine_penalties_penalty_points_check,
  drop constraint if exists morning_routine_penalties_points_deducted_check,
  add constraint morning_routine_penalties_penalty_points_check
    check (penalty_points between 1 and 1000),
  add constraint morning_routine_penalties_points_deducted_check
    check (points_deducted >= 0 and points_deducted <= penalty_points);

alter table public.evening_routine_penalties
  drop constraint if exists evening_routine_penalties_penalty_points_check,
  drop constraint if exists evening_routine_penalties_points_deducted_check,
  add constraint evening_routine_penalties_penalty_points_check
    check (penalty_points between 1 and 1000),
  add constraint evening_routine_penalties_points_deducted_check
    check (points_deducted >= 0 and points_deducted <= penalty_points);
