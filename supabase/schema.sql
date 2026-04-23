-- ============================================================
-- Family Dashboard — Supabase Schema
-- Supabase 대시보드 > SQL Editor 에서 실행
-- ============================================================

-- users
create table if not exists public.users (
  id          text primary key,
  name        text not null,
  role        text not null check (role in ('PARENT', 'CHILD')),
  theme       text not null,
  avatar_url  text,
  pin_hash    text,
  created_at  timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "auth users full access" on public.users
  for all using (auth.role() = 'authenticated');

-- tasks
create table if not exists public.tasks (
  id           text primary key,
  user_id      text not null references public.users(id) on delete cascade,
  code         text,
  title        text not null,
  icon         text not null default 'circle',
  difficulty   text not null check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  base_points  integer not null default 10,
  recurrence   text not null default 'daily',
  days_of_week text[],  -- ['MON','TUE','WED','THU','FRI','SAT','SUN']; null = use recurrence fallback
  time_window  text check (time_window in ('morning', 'afternoon', 'evening')),
  active       integer not null default 1,
  sort_order   integer not null default 0
);
alter table public.tasks enable row level security;
create policy "auth users full access" on public.tasks
  for all using (auth.role() = 'authenticated');

-- task_completions
create table if not exists public.task_completions (
  id               text primary key,
  user_id          text not null references public.users(id) on delete cascade,
  task_id          text not null references public.tasks(id) on delete cascade,
  completed_at     timestamptz not null,
  points_awarded   integer not null default 0,
  partial          boolean not null default false,
  forgiveness_used boolean not null default false
);
alter table public.task_completions enable row level security;
create policy "auth users full access" on public.task_completions
  for all using (auth.role() = 'authenticated');
create index if not exists idx_tc_user_date on public.task_completions(user_id, completed_at);

-- streaks
create table if not exists public.streaks (
  id                  text primary key,
  user_id             text not null references public.users(id) on delete cascade,
  task_id             text not null references public.tasks(id) on delete cascade,
  current             integer not null default 0,
  longest             integer not null default 0,
  last_completed_at   timestamptz,
  forgiveness_used_at timestamptz
);
alter table public.streaks enable row level security;
create policy "auth users full access" on public.streaks
  for all using (auth.role() = 'authenticated');

-- badges
create table if not exists public.badges (
  id             text primary key,
  code           text not null unique,
  name           text not null,
  description    text not null,
  icon           text not null,
  category       text not null check (category in ('habit', 'points', 'event')),
  condition_json jsonb not null,
  active         integer not null default 1
);
alter table public.badges enable row level security;
create policy "auth users full access" on public.badges
  for all using (auth.role() = 'authenticated');

-- user_badges
create table if not exists public.user_badges (
  id        text primary key,
  user_id   text not null references public.users(id) on delete cascade,
  badge_id  text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null
);
alter table public.user_badges enable row level security;
create policy "auth users full access" on public.user_badges
  for all using (auth.role() = 'authenticated');

-- levels
create table if not exists public.levels (
  user_id       text primary key references public.users(id) on delete cascade,
  current_level integer not null default 1,
  total_points  integer not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.levels enable row level security;
create policy "auth users full access" on public.levels
  for all using (auth.role() = 'authenticated');
