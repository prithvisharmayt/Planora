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
  code text,
  color_key text not null default '1',
  exam_date date,
  priority int not null default 2 check (priority between 1 and 3),
  confidence int not null default 2 check (confidence between 1 and 3),
  weekly_target_min int not null default 120,
  notes text,
  resource_url text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.subjects drop column if exists difficulty;
alter table public.subjects alter column exam_date drop not null;
alter table public.subjects add column if not exists code text;
alter table public.subjects add column if not exists confidence int not null default 2;
alter table public.subjects add column if not exists weekly_target_min int not null default 120;
alter table public.subjects add column if not exists notes text;
alter table public.subjects add column if not exists resource_url text;
alter table public.subjects add column if not exists is_archived boolean not null default false;

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
  unit_title text,
  est_min int not null check (est_min > 0),
  is_done boolean not null default false,
  status text not null default 'not_started' check (status in ('not_started', 'learning', 'revising', 'completed')),
  position int not null default 0,
  notes text,
  resource_url text,
  confidence int not null default 2 check (confidence between 1 and 3),
  last_studied_date date,
  completed_focus_min int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.chapters add column if not exists unit_title text;
alter table public.chapters add column if not exists status text not null default 'not_started';
alter table public.chapters add column if not exists notes text;
alter table public.chapters add column if not exists resource_url text;
alter table public.chapters add column if not exists confidence int not null default 2;
alter table public.chapters add column if not exists last_studied_date date;
alter table public.chapters add column if not exists completed_focus_min int not null default 0;

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
  subject_id uuid references public.subjects on delete cascade,
  date date not null,
  start_min int not null,
  duration_min int not null check (duration_min > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'missed')),
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.blocks add column if not exists is_locked boolean not null default false;
alter table public.blocks add column if not exists subject_id uuid references public.subjects on delete cascade;

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

-- 5. ACADEMIC EVENTS TABLE (Exams, Assignments, Fixed Sessions, Holidays)
create table if not exists public.academic_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  subject_id uuid references public.subjects on delete cascade,
  title text not null,
  event_type text not null default 'exam' check (event_type in ('exam', 'assignment', 'class', 'holiday', 'other')),
  event_date date not null,
  start_time text,
  end_time text,
  location text,
  raw_text text,
  source_page int,
  created_at timestamptz not null default now()
);

alter table public.academic_events enable row level security;

create policy "Users can view own academic events"
  on public.academic_events for select using (auth.uid() = user_id);

create policy "Users can insert own academic events"
  on public.academic_events for insert with check (auth.uid() = user_id);

create policy "Users can update own academic events"
  on public.academic_events for update using (auth.uid() = user_id);

create policy "Users can delete own academic events"
  on public.academic_events for delete using (auth.uid() = user_id);

-- 6. FOCUS LOGS TABLE (Real focus session logs)
create table if not exists public.focus_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  block_id uuid references public.blocks on delete set null,
  chapter_id uuid references public.chapters on delete set null,
  subject_id uuid references public.subjects on delete set null,
  actual_seconds int not null default 0,
  completed boolean not null default true,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

alter table public.focus_logs enable row level security;

create policy "Users can view own focus logs"
  on public.focus_logs for select using (auth.uid() = user_id);

create policy "Users can insert own focus logs"
  on public.focus_logs for insert with check (auth.uid() = user_id);

create policy "Users can update own focus logs"
  on public.focus_logs for update using (auth.uid() = user_id);

create policy "Users can delete own focus logs"
  on public.focus_logs for delete using (auth.uid() = user_id);

-- 7. IMPORT BATCHES TABLE (History of syllabus & schedule imports)
create table if not exists public.import_batches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  filename text not null,
  extracted_subjects_count int not null default 0,
  extracted_events_count int not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table public.import_batches enable row level security;

create policy "Users can view own import batches"
  on public.import_batches for select using (auth.uid() = user_id);

create policy "Users can insert own import batches"
  on public.import_batches for insert with check (auth.uid() = user_id);

create policy "Users can delete own import batches"
  on public.import_batches for delete using (auth.uid() = user_id);

-- 8. SCHEDULE SNAPSHOTS TABLE (For 1-click Undo of Schedule Regeneration)
create table if not exists public.schedule_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  snapshot_data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.schedule_snapshots enable row level security;

create policy "Users can view own schedule snapshots"
  on public.schedule_snapshots for select using (auth.uid() = user_id);

create policy "Users can insert own schedule snapshots"
  on public.schedule_snapshots for insert with check (auth.uid() = user_id);

create policy "Users can delete own schedule snapshots"
  on public.schedule_snapshots for delete using (auth.uid() = user_id);

-- Helpful indices for rapid querying
create index if not exists idx_subjects_user on public.subjects(user_id);
create index if not exists idx_chapters_user_subject on public.chapters(user_id, subject_id);
create index if not exists idx_blocks_user_date on public.blocks(user_id, date);
create index if not exists idx_blocks_chapter on public.blocks(chapter_id);
create index if not exists idx_academic_events_user on public.academic_events(user_id, event_date);
create index if not exists idx_focus_logs_user on public.focus_logs(user_id, started_at);
create index if not exists idx_import_batches_user on public.import_batches(user_id);
