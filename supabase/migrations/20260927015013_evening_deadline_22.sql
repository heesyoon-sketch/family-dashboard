-- Move the evening routine deadline from 21:00 to 22:00.
--
-- Covers both halves of the evening deadline:
-- * the evening routine penalty (checked from 22:00, counting evening
--   completions made before 22:00), and
-- * the child evening completion/undo lock.
-- Each function is re-created from its live definition with only the
-- '21 hours' offset changed, so grants, sale-day exemptions, and the rest of
-- the logic stay exactly as deployed.
do $$
declare
  v_fn regprocedure;
  v_def text;
begin
  foreach v_fn in array array[
    'public.apply_evening_routine_penalties(timestamptz, text, date)'::regprocedure,
    'public.apply_evening_routine_penalties_before_sale_exemption(timestamptz, text, date)'::regprocedure,
    'public.process_task_completion_atomic(text, text, boolean, timestamptz, text, text, timestamptz, numeric)'::regprocedure,
    'public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz)'::regprocedure
  ] loop
    v_def := pg_get_functiondef(v_fn);
    if position('interval ''21 hours''' in v_def) = 0 then
      raise exception 'expected a 21:00 deadline in %', v_fn;
    end if;
    execute replace(v_def, 'interval ''21 hours''', 'interval ''22 hours''');
  end loop;
end
$$;
