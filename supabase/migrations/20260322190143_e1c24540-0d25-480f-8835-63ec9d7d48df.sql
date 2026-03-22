-- New projects system tables

-- projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'planning' check (status in ('planning','active','paused','completed')),
  difficulty text check (difficulty in ('Beginner','Intermediate','Advanced','Expert')),
  estimated_minutes integer,
  actual_minutes integer,
  safety_warnings text[] default '{}',
  ai_generated boolean default false,
  started_at timestamptz,
  completed_at timestamptz,
  timer_running boolean default false,
  timer_started_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects"
on public.projects for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- project_parts
create table public.project_parts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  part_number text,
  brand text,
  quantity integer default 1,
  estimated_cost decimal,
  actual_cost decimal,
  notes text,
  have_it boolean default false,
  buy_url_rockauto text,
  buy_url_amazon text,
  sort_order integer default 0
);

alter table public.project_parts enable row level security;

create policy "Users can CRUD own project parts"
on public.project_parts for all to authenticated
using (exists (select 1 from public.projects where projects.id = project_parts.project_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.projects where projects.id = project_parts.project_id and projects.user_id = auth.uid()));

-- project_tools
create table public.project_tools (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  spec text,
  required boolean default true,
  have_it boolean default false,
  sort_order integer default 0
);

alter table public.project_tools enable row level security;

create policy "Users can CRUD own project tools"
on public.project_tools for all to authenticated
using (exists (select 1 from public.projects where projects.id = project_tools.project_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.projects where projects.id = project_tools.project_id and projects.user_id = auth.uid()));

-- project_steps
create table public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_number integer not null,
  title text not null,
  description text not null,
  torque_specs jsonb,
  sub_steps text[],
  tip text,
  safety_note text,
  estimated_minutes integer,
  status text default 'todo' check (status in ('todo','in_progress','done','skipped')),
  photo_urls text[] default '{}',
  completed_at timestamptz,
  notes text,
  sort_order integer
);

alter table public.project_steps enable row level security;

create policy "Users can CRUD own project steps"
on public.project_steps for all to authenticated
using (exists (select 1 from public.projects where projects.id = project_steps.project_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.projects where projects.id = project_steps.project_id and projects.user_id = auth.uid()));

-- project_notes
create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id uuid references public.project_steps(id),
  content text not null,
  created_at timestamptz default now()
);

alter table public.project_notes enable row level security;

create policy "Users can CRUD own project notes"
on public.project_notes for all to authenticated
using (exists (select 1 from public.projects where projects.id = project_notes.project_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.projects where projects.id = project_notes.project_id and projects.user_id = auth.uid()));