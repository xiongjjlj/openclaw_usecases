create extension if not exists pgcrypto;

create table if not exists public.use_cases (
  id text primary key,
  title text not null,
  summary text not null,
  problem text not null,
  workflow text not null,
  repro_mode text not null default 'semi-auto',
  repro_prompt text,
  manual_steps text,
  category text not null default 'General',
  tags jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  source_date date,
  evidence_note text,
  submitted_by text not null default 'anonymous',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_use_cases_status_created on public.use_cases(status, created_at desc);
create index if not exists idx_use_cases_category on public.use_cases(category);

create table if not exists public.use_case_edits (
  edit_id uuid primary key default gen_random_uuid(),
  use_case_id text not null references public.use_cases(id) on delete cascade,
  editor text not null default 'system',
  note text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_use_case_edits_case_time on public.use_case_edits(use_case_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_use_cases_updated_at on public.use_cases;
create trigger trg_use_cases_updated_at
before update on public.use_cases
for each row execute procedure public.set_updated_at();

alter table public.use_cases enable row level security;
alter table public.use_case_edits enable row level security;

-- Read-only public access for listing/detail pages; writes should go through service role.
drop policy if exists "public can read published use_cases" on public.use_cases;
create policy "public can read published use_cases"
on public.use_cases
for select
using (status = 'published');
