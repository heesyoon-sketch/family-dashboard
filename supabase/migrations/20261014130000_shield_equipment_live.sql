-- Shield Wall 4.0 goes live (approved by the family admin on 2026-10-13).
-- Equipped Shield bonuses now credit spendable points (never XP).
-- Kill switch: update public.shield_config set mode = 'off';
update public.shield_config set mode = 'live', updated_at = now() where id = 1;
