-- =====================================================
-- PRODUCTION-READY SESSIONS ARCHITECTURE
-- =====================================================
-- This schema implements:
-- activities (concepts) -> activity_sessions (instances) -> signups (participants)
-- =====================================================
-- All statements are idempotent - safe to run multiple times
-- =====================================================

-- =====================================================
-- USER PROFILES
-- =====================================================

-- User Profiles table
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  bio text,
  avatar_url text,
  show_email boolean default true,
  user_type text default 'user' check (user_type in ('user', 'activity_leader', 'partner', 'admin')),
  points integer default 0,
  badges jsonb default '[]'::jsonb,
  login_dates text[] default '{}'::text[], -- Array of dates (YYYY-MM-DD) when user logged in
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security on user_profiles
alter table public.user_profiles enable row level security;

-- Policy: Anyone can read public profile data
drop policy if exists "Public profiles are viewable by everyone" on public.user_profiles;
create policy "Public profiles are viewable by everyone"
  on public.user_profiles
  for select
  using (true);

-- Policy: Users can update their own profile
drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = user_id);

-- Policy: Users can insert their own profile
drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

-- Function to automatically create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, name, avatar_url, login_dates)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    ARRAY[to_char(now(), 'YYYY-MM-DD')] -- Track first login date
  );
  return new;
end;
$$;

-- Trigger to create profile on new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Index for user_profiles
create index if not exists idx_user_profiles_user_type on public.user_profiles(user_type);

-- =====================================================
-- ACTIVITIES (CONCEPTS/TEMPLATES)
-- =====================================================

-- Rename old activities table if it exists (with failsafe)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'activities')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'default_location') then
    alter table public.activities rename to activities_old;
  end if;
end $$;

-- Activities table now represents activity concepts/templates
-- Example: "Sosial Gåtur", "Yoga på Stranden", "Basketball i Parken"
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  -- Template location (can be overridden in sessions)
  default_location text,
  default_latitude double precision,
  default_longitude double precision,
  default_coords point,
  -- Visual
  photo_id text,
  custom_photo_url text,
  color text,
  -- Pricing (can be overridden in sessions)
  default_price decimal(10,2) default 0,
  -- Default settings
  default_max_participants integer,
  default_duration_minutes integer,
  -- Metadata
  is_recurring boolean default false,
  recurrence_pattern text, -- 'weekly', 'monthly', 'custom'
  status text default 'active' check (status in ('active', 'archived', 'draft')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure activity name is unique per user
  unique(user_id, name)
);

-- Enable Row Level Security on activities (concepts)
alter table public.activities enable row level security;

-- Policy: Anyone can read active activity concepts
drop policy if exists "Active activity concepts are viewable by everyone" on public.activities;
create policy "Active activity concepts are viewable by everyone"
  on public.activities
  for select
  using (status = 'active');

-- Policy: Authenticated users can create activity concepts
drop policy if exists "Authenticated users can create activity concepts" on public.activities;
create policy "Authenticated users can create activity concepts"
  on public.activities
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Policy: Users can update their own activity concepts
drop policy if exists "Users can update own activity concepts" on public.activities;
create policy "Users can update own activity concepts"
  on public.activities
  for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own activity concepts
drop policy if exists "Users can delete own activity concepts" on public.activities;
create policy "Users can delete own activity concepts"
  on public.activities
  for delete
  using (auth.uid() = user_id);

-- Indexes for activities (concepts)
create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_category on public.activities(category);
create index if not exists idx_activities_status on public.activities(status);
create index if not exists idx_activities_recurring on public.activities(is_recurring);

-- =====================================================
-- ACTIVITY SESSIONS
-- =====================================================

-- Activity Sessions represent individual instances/occurrences
-- Example: "Sosial Gåtur - Jan 15, 2024 10:00", "Sosial Gåtur - Jan 22, 2024 10:00"
create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete set null,
  
  -- Session-specific details (can override activity defaults)
  name text, -- Optional: custom name for this session
  location text not null,
  session_date timestamptz not null,
  session_end_date timestamptz,
  latitude double precision,
  longitude double precision,
  coords point,
  
  -- Session-specific settings
  price decimal(10,2),
  max_participants integer,
  duration_minutes integer,
  
  -- Host info (can be different from activity creator)
  host_name text,
  
  -- Participation stats (auto-updated by triggers)
  signed_up_count integer default 0,
  attended_count integer default 0,
  
  -- Status
  status text default 'scheduled' check (status in (
    'scheduled',    -- Future session
    'confirmed',    -- Confirmed and ready
    'in_progress',  -- Currently happening
    'completed',    -- Finished
    'cancelled'     -- Cancelled
  )),
  
  -- Notes and metadata
  session_notes text,
  weather_conditions text,
  actual_duration_minutes integer,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security on activity_sessions
alter table public.activity_sessions enable row level security;

-- Policy: Anyone can read scheduled/confirmed sessions
drop policy if exists "Public sessions are viewable by everyone" on public.activity_sessions;
create policy "Public sessions are viewable by everyone"
  on public.activity_sessions
  for select
  using (status in ('scheduled', 'confirmed', 'in_progress', 'completed'));

-- Policy: Authenticated users can create sessions for their activities
drop policy if exists "Users can create sessions for their activities" on public.activity_sessions;
create policy "Users can create sessions for their activities"
  on public.activity_sessions
  for insert
  with check (
    auth.role() = 'authenticated' 
    and exists (
      select 1 from public.activities
      where activities.id = activity_sessions.activity_id
      and activities.user_id = auth.uid()
    )
  );

-- Policy: Users can update sessions for their activities
drop policy if exists "Users can update sessions for their activities" on public.activity_sessions;
create policy "Users can update sessions for their activities"
  on public.activity_sessions
  for update
  using (
    exists (
      select 1 from public.activities
      where activities.id = activity_sessions.activity_id
      and activities.user_id = auth.uid()
    )
  );

-- Policy: Users can delete sessions for their activities
drop policy if exists "Users can delete sessions for their activities" on public.activity_sessions;
create policy "Users can delete sessions for their activities"
  on public.activity_sessions
  for delete
  using (
    exists (
      select 1 from public.activities
      where activities.id = activity_sessions.activity_id
      and activities.user_id = auth.uid()
    )
  );

-- Indexes for activity_sessions
create index if not exists idx_sessions_activity_id on public.activity_sessions(activity_id);
create index if not exists idx_sessions_user_id on public.activity_sessions(user_id);
create index if not exists idx_sessions_date on public.activity_sessions(session_date);
create index if not exists idx_sessions_status on public.activity_sessions(status);
create index if not exists idx_sessions_upcoming on public.activity_sessions(session_date) 
  where status in ('scheduled', 'confirmed');

-- =====================================================
-- SIGNUPS
-- =====================================================

-- Drop old activity_participants table and recreate as signups
drop table if exists public.activity_participants cascade;

-- Signups track participation in specific sessions
create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Signup status
  status text default 'confirmed' check (status in (
    'confirmed',    -- Signed up and confirmed
    'cancelled',    -- Cancelled signup
    'waitlist',     -- On waitlist (session full)
    'attended',     -- Attended the session
    'no_show'       -- Did not show up
  )),
  
  -- Attendance tracking
  attended boolean default false,
  attended_at timestamptz,
  check_in_time timestamptz,
  check_out_time timestamptz,
  
  -- Notes
  participant_notes text,
  host_notes text,
  
  -- Timestamps
  signed_up_at timestamptz default now(),
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one signup per user per session
  unique(session_id, user_id)
);

-- Enable Row Level Security on signups
alter table public.signups enable row level security;

-- Policy: Anyone can read signups (to see participation)
drop policy if exists "Signups are viewable by everyone" on public.signups;
create policy "Signups are viewable by everyone"
  on public.signups
  for select
  using (true);

-- Policy: Users can sign up for sessions
drop policy if exists "Users can sign up for sessions" on public.signups;
create policy "Users can sign up for sessions"
  on public.signups
  for insert
  with check (auth.uid() = user_id);

-- Policy: Users can cancel their own signups
drop policy if exists "Users can cancel own signups" on public.signups;
create policy "Users can cancel own signups"
  on public.signups
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: Session hosts can update attendance
drop policy if exists "Session hosts can update attendance" on public.signups;
create policy "Session hosts can update attendance"
  on public.signups
  for update
  using (
    exists (
      select 1 
      from public.activity_sessions s
      join public.activities a on a.id = s.activity_id
      where s.id = signups.session_id
      and a.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own signups
drop policy if exists "Users can delete own signups" on public.signups;
create policy "Users can delete own signups"
  on public.signups
  for delete
  using (auth.uid() = user_id);

-- Indexes for signups
create index if not exists idx_signups_session_id on public.signups(session_id);
create index if not exists idx_signups_user_id on public.signups(user_id);
create index if not exists idx_signups_status on public.signups(status);
create index if not exists idx_signups_attended on public.signups(attended);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to check and enforce max participants per session
create or replace function public.check_max_participants_session()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
  max_count integer;
begin
  -- Get current signup count and max participants for this session
  select 
    count(*) filter (where status in ('confirmed', 'attended')),
    s.max_participants
  into current_count, max_count
  from public.activity_sessions s
  where s.id = new.session_id
  group by s.max_participants;

  -- If max_participants is null, allow unlimited
  if max_count is null then
    return new;
  end if;

  -- If already at or over max, and trying to confirm
  if current_count >= max_count and new.status = 'confirmed' then
    -- Check if this is an update from waitlist
    if tg_op = 'UPDATE' and old.status = 'waitlist' then
      return new;
    end if;
    -- Put on waitlist instead
    new.status := 'waitlist';
    raise notice 'Session is full, added to waitlist';
  end if;

  return new;
end;
$$;

-- Trigger to enforce max participants on insert/update
drop trigger if exists enforce_max_participants_session on public.signups;
create trigger enforce_max_participants_session
  before insert or update on public.signups
  for each row
  when (new.status in ('confirmed', 'waitlist'))
  execute function public.check_max_participants_session();

-- Function to automatically update session signup/attendance counts
create or replace function public.update_session_stats()
returns trigger
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  -- Determine session_id from new or old
  v_session_id := coalesce(new.session_id, old.session_id);

  -- Update session statistics
  update public.activity_sessions
  set 
    signed_up_count = (
      select count(*) 
      from public.signups 
      where session_id = v_session_id
      and status in ('confirmed', 'attended')
    ),
    attended_count = (
      select count(*) 
      from public.signups 
      where session_id = v_session_id
      and attended = true
    ),
    updated_at = now()
  where id = v_session_id;
  
  return coalesce(new, old);
end;
$$;

-- Trigger to update session stats when signups change
drop trigger if exists update_session_stats on public.signups;
create trigger update_session_stats
  after insert or update or delete on public.signups
  for each row
  execute function public.update_session_stats();

-- Function to mark attendance for a participant
create or replace function public.mark_session_attendance(
  p_session_id uuid,
  p_user_id uuid,
  p_attended boolean
)
returns public.signups
language plpgsql
security definer
as $$
declare
  v_result public.signups;
  v_host_id uuid;
begin
  -- Check if user is the host of this session's activity
  select a.user_id into v_host_id
  from public.activity_sessions s
  join public.activities a on a.id = s.activity_id
  where s.id = p_session_id;

  if v_host_id != auth.uid() then
    raise exception 'Only activity host can mark attendance';
  end if;

  -- Update attendance
  update public.signups
  set 
    attended = p_attended,
    attended_at = case when p_attended then now() else null end,
    check_in_time = case when p_attended then now() else null end,
    status = case 
      when p_attended then 'attended'
      when status = 'attended' then 'confirmed'
      else status
    end,
    updated_at = now()
  where session_id = p_session_id
    and user_id = p_user_id
  returning * into v_result;

  if not found then
    raise exception 'Participant not found for this session';
  end if;

  return v_result;
end;
$$;

-- Function to get session statistics
create or replace function public.get_session_stats(p_session_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_stats json;
begin
  select json_build_object(
    'total_signed_up', count(*) filter (where status in ('confirmed', 'attended')),
    'total_attended', count(*) filter (where attended = true),
    'total_waitlist', count(*) filter (where status = 'waitlist'),
    'total_cancelled', count(*) filter (where status = 'cancelled'),
    'total_no_show', count(*) filter (where status = 'no_show'),
    'max_participants', (select max_participants from public.activity_sessions where id = p_session_id),
    'available_spots', (
      (select max_participants from public.activity_sessions where id = p_session_id) - 
      count(*) filter (where status in ('confirmed', 'attended'))
    ),
    'attendance_rate', case 
      when count(*) filter (where status in ('confirmed', 'attended')) > 0 then
        round(
          (count(*) filter (where attended = true)::numeric / 
           count(*) filter (where status in ('confirmed', 'attended'))::numeric) * 100,
          2
        )
      else 0
    end
  ) into v_stats
  from public.signups
  where session_id = p_session_id;

  return v_stats;
end;
$$;

-- Function to get activity concept statistics (across all sessions)
create or replace function public.get_activity_stats(p_activity_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_stats json;
begin
  select json_build_object(
    'total_sessions', count(distinct s.id),
    'completed_sessions', count(distinct s.id) filter (where s.status = 'completed'),
    'upcoming_sessions', count(distinct s.id) filter (where s.status in ('scheduled', 'confirmed') and s.session_date > now()),
    'total_participants', count(distinct su.user_id),
    'total_signups', count(su.id),
    'total_attended', count(su.id) filter (where su.attended = true),
    'average_attendance_rate', case 
      when count(distinct s.id) > 0 then
        round(
          avg(
            case 
              when s.attended_count > 0 and s.signed_up_count > 0 then
                (s.attended_count::numeric / s.signed_up_count::numeric) * 100
              else 0
            end
          ),
          2
        )
      else 0
    end,
    'unique_participants', count(distinct su.user_id),
    'returning_participants', count(distinct su.user_id) filter (
      where exists (
        select 1
        from public.signups su2
        join public.activity_sessions s2 on s2.id = su2.session_id
        where su2.user_id = su.user_id
          and s2.activity_id = p_activity_id
          and su2.attended = true
        group by su2.user_id
        having count(*) > 1
      )
    )
  ) into v_stats
  from public.activity_sessions s
  left join public.signups su on su.session_id = s.id
  where s.activity_id = p_activity_id;

  return v_stats;
end;
$$;

-- =====================================================
-- FORUM TABLES (if not already created)
-- =====================================================

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

-- =====================================================
-- ANALYTICS
-- =====================================================

-- Simple analytics events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  properties jsonb default '{}'::jsonb,
  user_agent text,
  path text,
  created_at timestamptz default now()
);
