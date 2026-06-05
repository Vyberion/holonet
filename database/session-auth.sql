create table if not exists public.users (
  roblox_id text primary key,
  roblox_username text not null,
  roblox_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  session_id text primary key,
  roblox_id text not null references public.users(roblox_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_roblox_id_idx on public.sessions(roblox_id);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
