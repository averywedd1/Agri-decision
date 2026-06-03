create table if not exists public.agridecision_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  farm_name text,
  last_farm_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agridecision_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agridecision_profiles enable row level security;
alter table public.agridecision_projects enable row level security;

drop policy if exists "Users can read their own profile" on public.agridecision_profiles;
create policy "Users can read their own profile"
on public.agridecision_profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.agridecision_profiles;
create policy "Users can insert their own profile"
on public.agridecision_profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.agridecision_profiles;
create policy "Users can update their own profile"
on public.agridecision_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read their own projects" on public.agridecision_projects;
create policy "Users can read their own projects"
on public.agridecision_projects for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own projects" on public.agridecision_projects;
create policy "Users can insert their own projects"
on public.agridecision_projects for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own projects" on public.agridecision_projects;
create policy "Users can update their own projects"
on public.agridecision_projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own projects" on public.agridecision_projects;
create policy "Users can delete their own projects"
on public.agridecision_projects for delete
using (auth.uid() = user_id);
