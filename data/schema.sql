create extension if not exists pgcrypto;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  issue_type text not null check (issue_type in ('lighting', 'plumbing', 'furniture', 'other')),
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_by text not null default 'anonymous',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests enable row level security;
drop policy if exists "CampusFix requests are visible to visitors" on public.requests;
create policy "CampusFix requests are visible to visitors"
  on public.requests for select to anon using (true);
drop policy if exists "Visitors can submit CampusFix requests" on public.requests;
create policy "Visitors can submit CampusFix requests"
  on public.requests for insert to anon with check (status = 'open');

grant usage on schema public to anon;
grant select (id, title, location, issue_type, description, priority, status, created_at, updated_at)
  on public.requests to anon;
grant insert (title, location, issue_type, description, priority)
  on public.requests to anon;
