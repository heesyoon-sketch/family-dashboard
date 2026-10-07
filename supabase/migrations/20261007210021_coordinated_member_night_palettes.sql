-- Set the four requested members to distinct, coordinated night palettes.
-- No matching family is a no-op on new installations. Multiple matches fail
-- the scalar subquery rather than changing an unrelated family's preferences.
with requested_family as (
  select u.family_id
  from public.users u
  where u.deleted_at is null
    and u.name in ('윤희식', '장아람', '윤준서', '윤지우')
  group by u.family_id
  having count(distinct u.name) = 4
)

  update public.users
  set theme = case name
    when '윤희식' then 'dark_minimal'
    when '장아람' then 'warm_minimal'
    when '윤준서' then 'robot_neon'
    when '윤지우' then 'pastel_cute'
  end
  where family_id = (select family_id from requested_family)
    and deleted_at is null
    and name in ('윤희식', '장아람', '윤준서', '윤지우');
