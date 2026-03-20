# Verifikasjon og Testing av Sessions-Struktur

Denne filen inneholder SQL-kommandoer for å verifisere at sessions-strukturen er satt opp riktig i Supabase.

## 📋 Forutsetninger

Før du starter, må du ha:
- ✅ Kjørt `schema-sessions.sql` i Supabase SQL Editor
- ✅ Kjørt `schema.sql` (for user_profiles) i Supabase SQL Editor
- ✅ Verifisert at alle tabeller er opprettet

## 🔍 Steg 1: Verifiser at alle tabeller eksisterer

Kjør denne SQL-en for å se alle tabeller:

```sql
-- Sjekk at alle tabeller eksisterer
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'user_profiles',
        'activities',
        'activity_sessions',
        'signups'
    )
ORDER BY table_name;
```

**Forventet resultat:** Du skal se alle 4 tabeller.

---

## 🔍 Steg 2: Verifiser RLS (Row Level Security) er aktivert

```sql
-- Sjekk RLS status på alle tabeller
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'user_profiles',
        'activities',
        'activity_sessions',
        'signups'
    )
ORDER BY tablename;
```

**Forventet resultat:** Alle tabeller skal ha `rls_enabled = true`.

---

## 🔍 Steg 3: Verifiser RLS Policies

```sql
-- Sjekk alle RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'user_profiles',
        'activities',
        'activity_sessions',
        'signups'
    )
ORDER BY tablename, policyname;
```

**Forventet resultat:** Du skal se policies for:
- `user_profiles`: Public read, Users can update/insert own
- `activities`: Public read active, Users can create/update/delete own
- `activity_sessions`: Public read, Users can create/update/delete for their activities
- `signups`: Public read, Users can sign up, cancel own, Hosts can update attendance

---

## 🔍 Steg 4: Verifiser Triggers

```sql
-- Check triggers in public schema
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN (
        'user_profiles',
        'activities',
        'activity_sessions',
        'signups'
    )
ORDER BY event_object_table, trigger_name;

-- Check triggers in auth schema (for on_auth_user_created)
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
    AND event_object_table = 'users'
ORDER BY trigger_name;
```

**Forventet resultat:**

**Fra første spørring (public schema):**
- `signups`: `enforce_max_participants_session` (for max participants)
- `signups`: `update_session_stats` (for å oppdatere session counts)

**Fra andre spørring (auth schema):**
- `users`: `on_auth_user_created` (for å opprette user_profiles automatisk)

**Note:** `on_auth_user_created` triggeren er i `auth` schema, ikke `public`, derfor trenger vi en separat spørring for å se den.

---

## 🔍 Steg 5: Verifiser Functions

```sql
-- Sjekk alle functions
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'handle_new_user',
        'check_max_participants_session',
        'update_session_stats',
        'mark_session_attendance',
        'get_session_stats',
        'get_activity_stats'
    )
ORDER BY routine_name;
```

**Forventet resultat:** Du skal se alle 6 funksjoner.

---

## 🧪 Steg 6: Test Data Insertion

### Test 1: Opprett en test-bruker (hvis du ikke har en)

```sql
-- Dette skjer automatisk når du oppretter en bruker via Supabase Auth
-- Men du kan sjekke at user_profiles ble opprettet:
SELECT 
    up.user_id,
    up.name,
    up.login_dates,
    au.email,
    au.created_at
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.user_id
ORDER BY au.created_at DESC
LIMIT 5;
```

### Test 2: Opprett et aktivitetskonsept

```sql
-- Først, få din user_id
SELECT id, email FROM auth.users WHERE email = 'din-email@example.com';

-- Så opprett et aktivitetskonsept (erstatt 'YOUR_USER_ID' med faktisk UUID)
INSERT INTO public.activities (
    user_id,
    name,
    description,
    category,
    default_location,
    default_latitude,
    default_longitude,
    default_price,
    status
) VALUES (
    'YOUR_USER_ID'::uuid,
    'Sosial Gåtur',
    'En hyggelig gåtur i naturen',
    'Outdoors',
    'Vansjø, Moss',
    59.43,
    10.68,
    0,
    'active'
) RETURNING *;
```

### Test 3: Opprett en session

```sql
-- Først, få activity_id fra forrige steg
SELECT id, name FROM public.activities WHERE name = 'Sosial Gåtur';

-- Opprett en session (erstatt 'YOUR_ACTIVITY_ID' og 'YOUR_USER_ID' med faktiske UUIDs)
INSERT INTO public.activity_sessions (
    activity_id,
    user_id,
    location,
    session_date,
    latitude,
    longitude,
    price,
    max_participants,
    status
) VALUES (
    'YOUR_ACTIVITY_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Vansjø, Moss',
    NOW() + INTERVAL '7 days',
    59.43,
    10.68,
    0,
    10,
    'scheduled'
) RETURNING *;
```

### Test 4: Test signup

```sql
-- Først, få session_id fra forrige steg
SELECT id, location, session_date FROM public.activity_sessions ORDER BY created_at DESC LIMIT 1;

-- Opprett en signup (erstatt 'YOUR_SESSION_ID' og 'YOUR_USER_ID' med faktiske UUIDs)
INSERT INTO public.signups (
    session_id,
    user_id,
    status
) VALUES (
    'YOUR_SESSION_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'confirmed'
) RETURNING *;

-- Sjekk at session stats ble oppdatert automatisk
SELECT 
    id,
    location,
    session_date,
    signed_up_count,
    attended_count
FROM public.activity_sessions
WHERE id = 'YOUR_SESSION_ID'::uuid;
```

**Forventet resultat:** `signed_up_count` skal være 1 etter signup.

---

## 🧪 Steg 7: Test Max Participants Enforcement

```sql
-- Opprett en session med max_participants = 2
INSERT INTO public.activity_sessions (
    activity_id,
    user_id,
    location,
    session_date,
    max_participants,
    status
) VALUES (
    'YOUR_ACTIVITY_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Test Location',
    NOW() + INTERVAL '7 days',
    2,
    'scheduled'
) RETURNING id, max_participants;

-- Opprett 3 signups (den tredje skal automatisk settes til 'waitlist')
-- Første signup
INSERT INTO public.signups (session_id, user_id, status)
VALUES ('SESSION_ID'::uuid, 'USER_1'::uuid, 'confirmed');

-- Andre signup
INSERT INTO public.signups (session_id, user_id, status)
VALUES ('SESSION_ID'::uuid, 'USER_2'::uuid, 'confirmed');

-- Tredje signup (skal automatisk settes til 'waitlist')
INSERT INTO public.signups (session_id, user_id, status)
VALUES ('SESSION_ID'::uuid, 'USER_3'::uuid, 'confirmed');

-- Sjekk resultatet
SELECT 
    user_id,
    status
FROM public.signups
WHERE session_id = 'SESSION_ID'::uuid
ORDER BY signed_up_at;
```

**Forventet resultat:** 
- Første 2 signups skal ha `status = 'confirmed'`
- Tredje signup skal ha `status = 'waitlist'`

---

## 🧪 Steg 8: Test Attendance Marking

```sql
-- Bruk mark_session_attendance funksjonen
SELECT public.mark_session_attendance(
    'YOUR_SESSION_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    true  -- attended = true
);

-- Sjekk at attendance ble oppdatert
SELECT 
    user_id,
    attended,
    attended_at,
    status
FROM public.signups
WHERE session_id = 'YOUR_SESSION_ID'::uuid
    AND user_id = 'YOUR_USER_ID'::uuid;

-- Sjekk at session stats ble oppdatert
SELECT 
    id,
    signed_up_count,
    attended_count
FROM public.activity_sessions
WHERE id = 'YOUR_SESSION_ID'::uuid;
```

**Forventet resultat:**
- `attended` skal være `true`
- `attended_at` skal være satt
- `status` skal være `'attended'`
- `attended_count` på session skal være oppdatert

---

## 🧪 Steg 9: Test Statistics Functions

```sql
-- Test get_session_stats
SELECT public.get_session_stats('YOUR_SESSION_ID'::uuid);

-- Test get_activity_stats
SELECT public.get_activity_stats('YOUR_ACTIVITY_ID'::uuid);
```

**Forventet resultat:** JSON-objekter med statistikk for session/activity.

---

## ✅ Verifikasjon Checkliste

- [ ] Alle tabeller eksisterer
- [ ] RLS er aktivert på alle tabeller
- [ ] Alle nødvendige policies er opprettet
- [ ] Alle triggers er opprettet (inkludert `on_auth_user_created` i auth schema)
- [ ] Alle funksjoner er opprettet
- [ ] Test data insertion fungerer
- [ ] Max participants enforcement fungerer
- [ ] Attendance marking fungerer
- [ ] Statistics functions returnerer korrekt data

---

## 🐛 Troubleshooting

### Problem: `on_auth_user_created` trigger vises ikke

**Løsning:** Triggeren er i `auth` schema, ikke `public`. Bruk den andre spørringen i Steg 4.

### Problem: Policies vises ikke

**Løsning:** Sjekk at du har kjørt alle `DROP POLICY IF EXISTS` og `CREATE POLICY` statements i `schema-sessions.sql`.

### Problem: Triggers fungerer ikke

**Løsning:** Sjekk at funksjonene eksisterer først (Steg 5), deretter sjekk at triggerene er knyttet til riktige tabeller.

### Problem: Max participants enforcement fungerer ikke

**Løsning:** Sjekk at `enforce_max_participants_session` triggeren eksisterer og er knyttet til `signups` tabellen.

---

**Oppdatert:** Basert på sessions-arkitektur med idempotente statements
