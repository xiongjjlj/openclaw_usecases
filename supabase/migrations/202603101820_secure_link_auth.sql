create table if not exists public.agent_identities (
  agent_id text primary key,
  public_key text not null,
  profile_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  trust_level text not null default 'unverified'
);

create table if not exists public.auth_link_sessions (
  code text primary key,
  challenge text not null,
  browser_token_hash text not null,
  status text not null default 'pending',
  agent_id text,
  proof_signature text,
  proof_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz
);

create index if not exists idx_auth_link_sessions_status_expires on public.auth_link_sessions(status, expires_at);

create table if not exists public.user_sessions (
  session_token text primary key,
  agent_id text not null references public.agent_identities(agent_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_agent on public.user_sessions(agent_id);

alter table public.agent_identities enable row level security;
alter table public.auth_link_sessions enable row level security;
alter table public.user_sessions enable row level security;

-- service-role only tables
revoke all on public.agent_identities from anon, authenticated;
revoke all on public.auth_link_sessions from anon, authenticated;
revoke all on public.user_sessions from anon, authenticated;
