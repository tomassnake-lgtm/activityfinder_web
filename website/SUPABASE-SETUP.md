# ActivityFinder nettside – Supabase-oppsett

Nettsiden bruker det **eksisterende** Supabase-skjemaet ditt. Under er det du må legge inn i **Supabase SQL Editor** og gjøre i **Supabase Dashboard** for at alt skal fungere.

---

## 1. SQL du må kjøre i Supabase

Åpne **Supabase Dashboard** → prosjektet ditt → **SQL Editor** → **New query**, lim inn følgende og kjør.

### 1.1 Nye kolonner på `activities`

Disse kolonnene brukes av nettsiden og finnes ikke i ditt opprinnelige skjema:

```sql
-- Lenke til aktivitetens eksterne nettside (vises på kort og i detaljvisning)
alter table public.activities
add column if not exists external_url text;

-- Om aktiviteten skal vises i «Ukens aktiviteter»-karusellen
alter table public.activities
add column if not exists is_weekly_featured boolean default false;

-- Valgfri indeks for raskere spørring på ukens aktiviteter
create index if not exists idx_activities_weekly_featured
on public.activities(is_weekly_featured)
where is_weekly_featured = true;

-- Type aktivitet: arrangement (én dato/tid) eller periode (fra–til eller uendelig)
alter table public.activities
add column if not exists activity_type text default 'event' check (activity_type in ('event', 'period'));

-- For arrangement: dato og tidspunkt
alter table public.activities
add column if not exists event_date date;
alter table public.activities
add column if not exists event_time text;

-- For periode-aktivitet: start- og sluttdato (null = uendelig)
alter table public.activities
add column if not exists period_start date;
alter table public.activities
add column if not exists period_end date;

-- Posisjon på kart (Moss-området); brukes av kartet på forsiden og i admin
alter table public.activities
add column if not exists default_latitude double precision;
alter table public.activities
add column if not exists default_longitude double precision;

-- Sted (tekst), bilde-URL og pris; brukes på kort og i admin
alter table public.activities
add column if not exists default_location text;
alter table public.activities
add column if not exists custom_photo_url text;
alter table public.activities
add column if not exists default_price numeric;
```

### 1.2 Policy slik at admin kan se egne aktiviteter (alle statuser)

I dag kan alle bare **lese** aktiviteter med `status = 'active'`. For at admin-siden skal kunne vise **dine egne** aktiviteter (inkludert utkast og arkiverte), legg til denne policyen:

```sql
-- Brukere kan lese sine egne aktiviteter uavhengig av status (for admin-listen)
drop policy if exists "Users can view own activities" on public.activities;
create policy "Users can view own activities"
  on public.activities
  for select
  using (auth.uid() = user_id);
```

Eksisterende policy «Active activity concepts are viewable by everyone» står fortsatt; med begge kan alle se aktive aktiviteter, og innloggede brukere kan i tillegg se sine egne (alle statuser).

---

## 2. Slik kobler du nettsiden til Supabase

### 2.1 Hente URL og anon key

1. Gå til **Supabase Dashboard** → ditt prosjekt.
2. Klikk **Settings** (tannhjul) → **API**.
3. Kopier:
   - **Project URL** (f.eks. `https://xxxxx.supabase.co`)
   - **anon public** key (under «Project API keys»).

### 2.2 Opprette config.js (lokal konfigurasjon)

1. I mappen `website/` ligger filen **config.example.js**.
2. **Kopier** den og **gi kopien navnet** `config.js` (samme mappe).
3. Åpne `config.js` og erstatt placeholder-verdiene:

```js
window.SUPABASE_URL = 'https://ditt-prosjekt.supabase.co';   // Project URL
window.SUPABASE_ANON_KEY = 'din-anon-key-her';               // anon public key
```

4. **Viktig:** Legg `website/config.js` i `.gitignore` så du ikke committer nøklene. Eksempel i prosjektrot:

```
website/config.js
```

Nettleseren henter da Supabase-klienten fra CDN; `app.js` bruker `config.js` for å koble til prosjektet ditt.

---

## 3. Brukere som kan bruke admin-verktøyet

Admin-siden vises bare for brukere som har **user_type** `admin` eller `activity_leader` i **user_profiles**.

### 3.1 Sette en bruker som admin (første gang)

1. **Opprett bruker** via nettsiden (Logg inn) eller via Supabase Dashboard → **Authentication** → **Users** → **Add user** (e-post + passord).
2. Finn brukerens **UUID** under **Authentication** → **Users** → klikk på brukeren → kopier **User UID**.
3. Gå til **SQL Editor** og kjør (erstatt `DIN-BRUKER-UUID` med den faktiske UUID-en):

```sql
update public.user_profiles
set user_type = 'admin'
where user_id = 'DIN-BRUKER-UUID';
```

Hvis brukeren nettopp er opprettet og ikke har rad i `user_profiles` ennå (f.eks. trigger som ikke har kjørt), kan du bruke:

```sql
insert into public.user_profiles (user_id, name, user_type)
values ('DIN-BRUKER-UUID', 'Ditt navn', 'admin')
on conflict (user_id) do update set user_type = 'admin';
```

Etter dette vil denne brukeren se **Admin**-lenken i headeren og kunne opprette og redigere aktiviteter.

### 3.2 Aktivere e-post/passord-innlogging (hvis du ikke har gjort det)

1. Supabase Dashboard → **Authentication** → **Providers**.
2. Slå på **Email**.
3. Du kan la «Confirm email» være av for enklere testing, eller slå den på for produksjon.

### 3.3 Logg inn med Google (valgfritt)

Nettsiden har en «Logg inn med Google»-knapp på profilsiden. For at den skal fungere:

1. Supabase Dashboard → **Authentication** → **Providers** → slå på **Google**.
2. Opprett OAuth-credentials i [Google Cloud Console](https://console.cloud.google.com/): opprett et prosjekt (eller bruk eksisterende), aktiver «Google+ API» / «Google Identity», opprett OAuth 2.0 Client ID (type «Web application»), og legg inn Supabase sin redirect-URL under «Authorized redirect URIs» (står i Supabase under Google-provider: «Callback URL»).
3. Lim inn **Client ID** og **Client Secret** i Supabase under Google-provideren og lagre.
4. **Viktig for nettsiden:** Legg inn nettsidens fulle URL **uten** hash (f.eks. `https://dittdomene.no/website/index.html` eller `http://localhost:3000/website/`) under **Authentication** → **URL Configuration** → **Redirect URLs**. Da sender Supabase brukeren tilbake til nettsiden etter Google-innlogging. Appen leser deretter `access_token` fra URL-en, lagrer session og viser profilsiden.

Etter det vil brukere kunne logge inn med Google; profilen opprettes som vanlig i `user_profiles` (via trigger). For å gi en Google-bruker admin-rettigheter, bruk samme SQL som over med brukerens `user_id` fra **Authentication** → **Users** etter innlogging.

---

## 4. Kort oversikt over hvordan nettsiden bruker tabellene

| Funksjon | Tabell | Felt / betydning |
|----------|--------|-------------------|
| Ukens aktiviteter | `activities` | `status = 'active'` og `is_weekly_featured = true` |
| Alle aktiviteter (liste + kart) | `activities` | `status = 'active'` |
| Filtrering på tema | `activities` | `category` (f.eks. snø, vann, skog, ball, sosial, familie) |
| Kart-pins | `activities` | `default_latitude`, `default_longitude` (eller `default_coords`) |
| Bilde på kort | `activities` | `custom_photo_url` (brukes som bakgrunn bak teksten) |
| Arrangement / periode | `activities` | `activity_type`, `event_date`, `event_time`, `period_start`, `period_end` (null = uendelig) |
| Tid/sted og pris på kort | `activities` | `default_location`, `default_price` + dato fra event eller periode |
| Lenke til arrangør | `activities` | `external_url` (må legges til i SQL, se over) |
| Innlogging / profil | `auth.users` + `user_profiles` | Eksisterende |
| Admin: hvem får se Admin? | `user_profiles` | `user_type` = `admin` eller `activity_leader` |
| Admin: opprette/redigere | `activities` | Samme felter som over; RLS sørger for at kun eier kan oppdatere/slette |

Du trenger **ikke** å endre `activity_sessions` eller `signups` for den nåværende nettsiden; den er kun basert på `activities` og `user_profiles`.

---

## 5. Feilsøking

- **«Ingen ukens aktiviteter» / tom liste:** Sjekk at du har kjørt SQL for `external_url` og `is_weekly_featured`, og at minst én aktivitet har `is_weekly_featured = true` og `status = 'active'`. Admin kan sette dette via skjemaet.
- **Admin-lenken vises ikke:** Sjekk at `user_profiles.user_type` er satt til `admin` eller `activity_leader` for din bruker (SQL over).
- **«Feil ved lagring» i admin:** Sjekk at du er innlogget og at RLS-policyene er som beskrevet (brukere kan oppdatere egne aktiviteter; policy for å vise egne aktiviteter er lagt til).
- **Kartet viser ingen pins:** Aktiviteter må ha `default_latitude` og `default_longitude` (eller gyldig `default_coords`) satt. I admin kan du klikke på kartet for å plassere en pin, eller fylle inn manuelt.
- **Bildeopplasting feiler:** Sjekk at du har opprettet bucket `activity_images` og kjørt Storage-policyene under (punkt 6).

Når dette er på plass, er nettsiden modellert opp mot det eksisterende Supabase-skjemaet med kun de tilleggene som er beskrevet over.

---

## 6. Supabase Storage for aktivitetsbilder (PDF/bilder)

For å lagre bilder (og PDF-er) til aktiviteter i Supabase slik at du eier filene og har enkel tilgang, brukes **Supabase Storage**. Da trenger du ikke å hoste bildene andre steder.

### 6.1 Opprette bucket i Dashboard

1. Gå til **Supabase Dashboard** → ditt prosjekt → **Storage**.
2. Klikk **New bucket**.
3. **Name:** `activity_images` (navnet må matche nøyaktig).
4. Kryss av for **Public bucket** (slik at nettsiden kan vise bildene uten innlogging).
5. Klikk **Create bucket**.

### 6.2 Tillatelser (policies) for bucket

Etter at bucketen er opprettet, må innloggede brukere kunne laste opp, og alle (inkl. anonyme) må kunne lese:

1. I **Storage** → klikk på bucketen **activity_images** → **Policies** (eller **New policy**).
2. Legg til to policies (eller kjør SQL under).

**Alternativ: Kjør i SQL Editor**

Åpne **SQL Editor** → **New query**, lim inn (erstatt `activity_images` kun hvis du bruker et annet bucket-navn):

```sql
-- Tillat alle å lese (vise) bilder i activity_images
create policy "Public read for activity_images"
on storage.objects for select
using (bucket_id = 'activity_images');

-- Tillat innloggede brukere å laste opp til activity_images
create policy "Authenticated upload for activity_images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'activity_images');
```

### 6.3 Slik fungerer det på nettsiden

- I **Admin** → Ny aktivitet / Rediger aktivitet finner du feltet **Bilde (last opp til Supabase eller lim inn URL)**.
- **Last opp:** Velg en fil (bilde eller PDF). Filen lastes opp til Supabase Storage, og URL-en settes automatisk inn i bilde-URL-feltet. Denne URL-en lagres på aktiviteten og brukes på forsiden.
- **Eller lim inn URL:** Du kan fortsatt lime inn en ekstern bilde-URL (f.eks. fra et annet domene) i stedet for å laste opp.

Filene lagres under `activity_images/{bruker-id}/{tidsstempel}-{id}.{filtype}` så du kan finne dem i Storage-tabellen i Supabase.
