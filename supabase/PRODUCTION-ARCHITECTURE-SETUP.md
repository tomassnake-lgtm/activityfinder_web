# Production-Ready Architecture Setup Guide

Denne guiden beskriver hvordan du setter opp den nye, produksjonsklare arkitekturen for ActivityFinder.

## 🏗️ Arkitektur Oversikt

Den nye arkitekturen skiller mellom:
- **Activity Concepts** (`activities` tabell) - Maler/konsepter for aktiviteter
- **Activity Sessions** (`activity_sessions` tabell) - Individuelle gjennomføringer
- **Signups** (`signups` tabell) - Påmeldinger til sessions

### Eksempel:
- **Concept:** "Sosial Gåtur" (ukentlig aktivitet)
- **Session 1:** "Sosial Gåtur - 15. januar 2024, 10:00"
- **Session 2:** "Sosial Gåtur - 22. januar 2024, 10:00"
- **Signups:** Liste over hvem som har meldt seg på hver session

## 📋 Forutsetninger

- Supabase prosjekt opprettet
- Tilgang til Supabase SQL Editor
- Backup av eksisterende data (hvis relevant)

## 🚀 Setup Steg

### Steg 1: Kjør Schema SQL

1. Åpne Supabase Dashboard → SQL Editor
2. Kopier innholdet fra `supabase/schema-sessions.sql`
3. Kjør SQL-en

**Viktig:** Alle statements er idempotente, så du kan kjøre scriptet flere ganger uten feil.

### Steg 2: Verifiser Setup

Følg `supabase/VERIFICATION-SETUP.md` for å verifisere at alt er satt opp riktig.

### Steg 3: Migrer Eksisterende Data (Hvis nødvendig)

Hvis du har eksisterende `activities` data i den gamle strukturen, må du migrere dem:

```sql
-- Eksempel migrering (tilpass etter ditt behov)
-- 1. Opprett activity concept fra gammel activity
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
)
SELECT 
    user_id,
    name,
    description,
    category,
    location,
    latitude,
    longitude,
    price,
    status
FROM public.activities_old
WHERE id = 'OLD_ACTIVITY_ID'::uuid;

-- 2. Opprett session fra gammel activity
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
)
SELECT 
    (SELECT id FROM public.activities WHERE name = activities_old.name LIMIT 1),
    user_id,
    location,
    date,
    latitude,
    longitude,
    price,
    max_participants,
    status
FROM public.activities_old
WHERE id = 'OLD_ACTIVITY_ID'::uuid;
```

## 🔑 Viktige Features

### 1. Max Participants Enforcement
- Automatisk waitlist når session er full
- Håndteres av `check_max_participants_session()` trigger

### 2. Automatic Statistics
- `signed_up_count` og `attended_count` oppdateres automatisk
- Håndteres av `update_session_stats()` trigger

### 3. Attendance Tracking
- Hosts kan markere oppmøte via `mark_session_attendance()` funksjon
- Støtter check-in/check-out tider

### 4. Statistics Functions
- `get_session_stats()` - Statistikk for en session
- `get_activity_stats()` - Aggregerte stats for et aktivitetskonsept

## 📊 Database Struktur

```
user_profiles
├── user_id (PK)
├── name
├── badges
├── login_dates (array)
└── ...

activities (concepts)
├── id (PK)
├── user_id (FK)
├── name
├── default_location
├── default_price
├── default_max_participants
└── ...

activity_sessions (instances)
├── id (PK)
├── activity_id (FK -> activities)
├── user_id (FK)
├── location
├── session_date
├── max_participants
├── signed_up_count (auto-updated)
└── ...

signups
├── id (PK)
├── session_id (FK -> activity_sessions)
├── user_id (FK)
├── status (confirmed/waitlist/attended/cancelled)
├── attended
└── ...
```

## 🔒 Security (RLS)

Alle tabeller har Row Level Security aktivert:

- **user_profiles:** Alle kan lese, brukere kan oppdatere egen
- **activities:** Alle kan lese aktive, brukere kan opprette/oppdatere/slette egne
- **activity_sessions:** Alle kan lese, brukere kan opprette/oppdatere/slette for egne aktiviteter
- **signups:** Alle kan lese, brukere kan melde seg på/av, hosts kan oppdatere attendance

## 🧪 Testing

Se `supabase/VERIFICATION-SETUP.md` for detaljerte test-scenarios.

## 📝 Notater

- Alle SQL statements er idempotente (kan kjøres flere ganger)
- `login_dates` array i `user_profiles` brukes for badge-tracking
- Sessions kan overstyre activity concept defaults (pris, max participants, etc.)
- Triggers håndterer automatisk oppdatering av statistikk

---

**Oppdatert:** Basert på produksjonsklare sessions-arkitektur
