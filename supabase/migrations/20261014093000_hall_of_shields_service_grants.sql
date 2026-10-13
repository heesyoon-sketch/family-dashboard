-- The Hall of Shields cron route uses the service role. Browser roles keep
-- no access to these functions.
grant execute on function public.shield_family_timezone(uuid) to service_role;
grant execute on function public.capture_shield_daily_schedules(timestamptz) to service_role;
grant execute on function public.finalize_shield_period(jsonb) to service_role;
grant execute on function public.correct_shield_award(uuid, text, text, text, text) to service_role;
