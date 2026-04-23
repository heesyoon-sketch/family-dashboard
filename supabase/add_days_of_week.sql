-- Migration: add days_of_week column to tasks
-- Run this in Supabase Dashboard > SQL Editor

alter table public.tasks
  add column if not exists days_of_week text[];

-- Backfill from legacy recurrence values
update public.tasks
set days_of_week = case
  when recurrence = 'weekdays' then ARRAY['MON','TUE','WED','THU','FRI']
  when recurrence = 'weekend'  then ARRAY['SAT','SUN']
  else                              ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN']
end
where days_of_week is null;
