-- ==========================================
-- PLANORA DATABASE SCHEMA WITH ROW LEVEL SECURITY
-- ==========================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  user_id uuid default auth.uid(),
  name text not null default '',
  college text,
  program text,
  daily_hours numeric not null default 2,
  session_min int not null default 45,
  break_min int not null default 10,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists program text;

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Profile trigger for automatic profile creation on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, name, daily_hours, session_min, break_min)
  values (new.id, new.id, coalesce(new.raw_user_meta_data->>'name', 'Student'), 2, 45, 10)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. SUBJECTS TABLE (difficulty removed, exam_date nullable)
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  color_key text not null default '1',
  exam_date date,
  priority int not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now()
);

alter table public.subjects drop column if exists difficulty;
alter table public.subjects alter column exam_date drop not null;

alter table public.subjects enable row level security;

create policy "Users can view own subjects"
  on public.subjects for select
  using (auth.uid() = user_id);

create policy "Users can insert own subjects"
  on public.subjects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subjects"
  on public.subjects for update
  using (auth.uid() = user_id);

create policy "Users can delete own subjects"
  on public.subjects for delete
  using (auth.uid() = user_id);

-- 3. CHAPTERS TABLE
create table if not exists public.chapters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  subject_id uuid references public.subjects on delete cascade not null,
  title text not null,
  est_min int not null check (est_min > 0),
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.chapters enable row level security;

create policy "Users can view own chapters"
  on public.chapters for select
  using (auth.uid() = user_id);

create policy "Users can insert own chapters"
  on public.chapters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chapters"
  on public.chapters for update
  using (auth.uid() = user_id);

create policy "Users can delete own chapters"
  on public.chapters for delete
  using (auth.uid() = user_id);

-- 4. BLOCKS TABLE
create table if not exists public.blocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  chapter_id uuid references public.chapters on delete cascade not null,
  date date not null,
  start_min int not null,
  duration_min int not null check (duration_min > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'missed')),
  created_at timestamptz not null default now()
);

alter table public.blocks enable row level security;

create policy "Users can view own blocks"
  on public.blocks for select
  using (auth.uid() = user_id);

create policy "Users can insert own blocks"
  on public.blocks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own blocks"
  on public.blocks for update
  using (auth.uid() = user_id);

create policy "Users can delete own blocks"
  on public.blocks for delete
  using (auth.uid() = user_id);

-- Helpful indices for rapid querying
create index if not exists idx_subjects_user on public.subjects(user_id);
create index if not exists idx_chapters_user_subject on public.chapters(user_id, subject_id);
create index if not exists idx_blocks_user_date on public.blocks(user_id, date);
create index if not exists idx_blocks_chapter on public.blocks(chapter_id);
