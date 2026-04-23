-- Migration: create family_settings table for global app configuration
-- Run this in Supabase Dashboard > SQL Editor

create table if not exists public.family_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.family_settings enable row level security;

create policy "auth users full access" on public.family_settings
  for all using (auth.role() = 'authenticated');

-- Optional: seed a default admin_pin_hash row if you already have a PIN.
-- Replace <your_hashed_pin> with the hash from hashPin() in lib/pin.ts,
-- or leave empty and set it via the Admin UI "Change Admin PIN" section.
-- insert into public.family_settings (key, value) values ('admin_pin_hash', '<your_hashed_pin>');
