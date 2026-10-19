-- Bonus Shield: Legendary needs 6 bonus days instead of all 7.
--
-- Bonus tasks are optional, so the top tier should not demand every single
-- day; one rest day still earns Legendary. Other tiers are unchanged
-- (Bronze 1 · Silver 3 · Gold 4 · Epic 5).

update public.shield_config
set rules = jsonb_set(rules, '{bonus,legendary}', '6'),
    version = 'weekly-v3',
    updated_at = now()
where id = 1;
