-- Activities table
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  date timestamptz not null,
  category text,
  host text,
  description text,
  joined integer default 0,
  latitude double precision,
  longitude double precision,
  photo_id text,
  color text,
  created_at timestamptz default now()
);

-- Forum posts
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  context text,
  content text not null,
  likes integer default 0,
  created_at timestamptz default now()
);

-- Forum comments
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.forum_posts (id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz default now()
);

-- Simple analytics events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  properties jsonb default '{}'::jsonb,
  user_agent text,
  path text,
  created_at timestamptz default now()
);

-- Storage bucket for activity images (run once in Dashboard SQL or CLI)
-- select storage.create_bucket('activity-images', jsonb_build_object('public', true));


