create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists app_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists app_session_token_hash_idx on app_session(token_hash);

create table if not exists photo_session (
  id uuid primary key,
  owner_id uuid references app_user(id) on delete cascade,
  frame_id text not null,
  completed_at timestamptz not null default now(),
  deleted_at timestamptz,
  guest_deletion_token text unique,
  guest_purge_at timestamptz,
  check ((owner_id is not null and guest_deletion_token is null and guest_purge_at is null) or (owner_id is null and guest_deletion_token is not null and guest_purge_at is not null))
);
create index if not exists photo_session_owner_idx on photo_session(owner_id, completed_at desc) where deleted_at is null;
create index if not exists photo_session_guest_purge_idx on photo_session(guest_purge_at) where owner_id is null and deleted_at is null;

create table if not exists media_object (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references photo_session(id) on delete cascade,
  storage_key text not null unique,
  content_type text not null,
  kind text not null check (kind in ('original', 'strip'))
);
