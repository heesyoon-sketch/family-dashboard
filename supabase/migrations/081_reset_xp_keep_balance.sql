-- Migration 081: reset every user's XP and current level back to the
-- starting state, while leaving spendable_balance (the redeemable shop
-- currency) intact. The progression redesign deserves a clean slate so
-- the new gentle level curve and bonus economy paint on a blank canvas,
-- but kids shouldn't lose the points they've already saved up.
--
-- This is a one-shot data migration. It does not change any function
-- signatures.
--
-- Apply with: supabase migration up
-- Safe to run on production — only the levels table is touched, and
-- spendable_balance is preserved.

update public.levels
set total_points = 0,
    current_level = 1,
    updated_at = now();

notify pgrst, 'reload schema';
