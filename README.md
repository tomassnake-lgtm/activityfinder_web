# ActivityFinder

Nettside og relatert kode for ActivityFinder. Den offentlige nettsiden ligger i mappen **`website/`**.

**GitHub-repo (tom):** [activityfinder_web](https://github.com/tomassnake-lgtm/activityfinder_web)

---

## Hvor du skal kjøre Git-kommandoene (viktig)

Du må stå i **rotmappen til prosjektet** – den som inneholder bl.a. `package.json`, mappen `website/` og mappen `supabase/`.

### Full sti på din PC (Windows)

```text
C:\Users\Lenovo\Documents\Alle Dokumenter\Jobb\ActivityFinder\Cursor AI APP
```

Merk: Mappen heter **`Cursor AI APP`** (med mellomrom). I PowerShell **må** stien ha anførselstegn.

### Slik åpner du riktig mappe i PowerShell

1. Trykk **Win + R**, skriv `powershell`, Enter.
2. Lim inn (eller skriv) dette og trykk Enter:

```powershell
cd "C:\Users\Lenovo\Documents\Alle Dokumenter\Jobb\ActivityFinder\Cursor AI APP"
```

3. Sjekk at du er riktig sted:

```powershell
dir
```

Du skal bl.a. se: `website`, `supabase`, eventuelt `package.json`.

**Alternativ:** I Cursor/VS Code: høyreklikk på mappen `Cursor AI APP` i filutforskeren → **Open in Integrated Terminal** – da er du allerede i riktig mappe.

---

## Første gang: push til GitHub

Repoet ditt er tomt. Kjør dette **fra rotmappen** over.

```powershell
git init
git add .
git commit -m "Initial commit: ActivityFinder"
git branch -M main
git remote add origin https://github.com/tomassnake-lgtm/activityfinder_web.git
git push -u origin main
```

Ved `git push` logger du inn på GitHub (nettleser eller brukernavn + **Personal Access Token** som passord hvis du bruker HTTPS).

### Vanlige feil

| Problem | Løsning |
|--------|---------|
| `fatal: not a git repository` | Du er ikke i rotmappen. Kjør `cd "…\Cursor AI APP"` først. |
| `remote origin already exists` | Du har allerede lagt til origin. Bruk `git remote -v` for å sjekke. Bytte URL: `git remote set-url origin https://github.com/tomassnake-lgtm/activityfinder_web.git` |
| `failed to push` / auth | Opprett [Personal Access Token](https://github.com/settings/tokens) (repo-tilgang) og bruk det som passord, eller bruk GitHub Desktop / SSH. |

---

## Supabase-konfigurasjon (hemmeligheter) – forklart steg for steg

Nettsiden i mappen `website/` må vite **hvilket Supabase-prosjekt** den skal snakke med. Det gjør den via filen **`website/config.js`**, som setter to verdier i nettleseren:

- **Project URL** – adressen til Supabase-prosjektet ditt  
- **anon (public) key** – en offentlig nøkkel som brukes fra frontend (den er ment å ligge i nettleseren, men vi unngår likevel å legge den åpent på GitHub i dette oppsettet)

### Hvorfor står dette i README når du allerede har pushet til GitHub?

- Filen **`website/config.js`** er listet i **`.gitignore`**. Det betyr: Git / GitHub Desktop **committer den ikke** (med mindre den ble lagt til før ignore-regelen).  
- På GitHub ligger derfor ofte bare **`website/config.example.js`** – en **mal uten ekte nøkler**, så andre (eller du på en ny PC) vet *hva* som må fylles inn.
- **På din egen maskin** har du (eller lager du) en ekte **`config.js`** med dine verdier, slik at nettsiden fungerer lokalt.

### Hvis du **allerede** har `website/config.js` på PC-en

Da trenger du **ikke** å kopiere noe – bare åpne `website/config.js` og sjekk at URL og nøkkel stemmer med Supabase. Hopp over kopier-steget under.

### Hvis du **mangler** `config.js` (ny PC, eller du slettet filen)

1. Åpne **PowerShell** og gå til **rotmappen** til prosjektet (den med `website`-mappen):

   ```powershell
   cd "C:\Users\Lenovo\Documents\Alle Dokumenter\Jobb\ActivityFinder\Cursor AI APP"
   ```

2. Kopier malen til en ny fil som heter `config.js`:

   ```powershell
   copy website\config.example.js website\config.js
   ```

3. Åpne **`website/config.js`** i Cursor/Notepad og erstatt platsholderne:
   - `https://DITT-PROSJEKT.supabase.co` → din **Project URL**
   - `DIN_ANON_PUBLIC_KEY_HER` → din **anon public** API-nøkkel

4. **Hvor finner du URL og nøkkel i Supabase?**
   - Logg inn på [supabase.com](https://supabase.com) → velg prosjektet ditt  
   - Gå til **Project Settings** (tannhjul) → **API**  
   - Under **Project URL** kopierer du URL-en  
   - Under **Project API keys** bruker du **`anon` `public`** (ikke `service_role` – den skal aldri i frontend-kode som lastes i nettleseren)

5. Lagre `config.js`. Kjør nettsiden lokalt (`cd website` → `npx serve .`) og test innlogging / aktiviteter.

### Viktig å huske

- **`service_role`-nøkkelen** skal **aldri** i `config.js` eller i GitHub – den omgår sikkerhetsregler.  
- **Vercel:** Se avsnittet [Deploy på Vercel](#deploy-på-vercel) under – der genereres `config.js` fra miljøvariabler ved deploy.

---

## Deploy på Vercel

I samme Git-repo ligger **Vite/React-appen** (rot `package.json`) og den **statiske nettsiden** i mappen **`website/`**. Vercel velger ofte automatisk Vite og bygger `dist/` – da får du «feil» side.

### Løsning i dette prosjektet

1. **Filen `vercel.json` i rot** er satt opp til å:
   - **ikke** bruke Vite som rammeverk for denne deployen (`framework: null`)
   - **hoppe over** `npm install` i rot (`installCommand: true` – vi trenger ikke `node_modules` for den statiske siden)
   - kjøre **`node scripts/vercel-website-config.js`**, som skriver **`website/supabase-runtime.js`** (og `config.js`) fra miljøvariabler. `supabase-runtime.js` er **ikke** i `.gitignore`, så den kommer alltid med i deploy – det unngår «Supabase ikke konfigurert» når `config.js` mangler i bygg-artefaktet.
   - publisere innholdet i **`website/`** som nettside (`outputDirectory: "website"`)

   Hvis `SUPABASE_URL` eller `SUPABASE_ANON_KEY` mangler i Vercel, **feiler bygget** med rød deploy (med vilje), så du ser det med én gang.

2. **I Vercel Dashboard** (Project → **Settings** → **Environment Variables**), legg inn for **Production** (og ev. Preview):

   | Navn | Verdi |
   |------|--------|
   | `SUPABASE_URL` | Din Project URL fra Supabase (Settings → API) |
   | `SUPABASE_ANON_KEY` | `anon` `public` nøkkelen (ikke `service_role`) |

3. **Deploy på nytt** (Redeploy) etter at variablene er lagret.

### Alternativ: kun endre innstillinger i Vercel (uten å stole på `vercel.json`)

1. **Settings** → **General** → **Root Directory** → sett til **`website`**
2. **Settings** → **General** → **Framework Preset** → **Other**
3. **Build Command** → tom (ingen build)
4. **Output Directory** → **`.`** (punktum, siden roten nå er `website`)

Da må du fortsatt sørge for at **`config.js` finnes** på deploy (f.eks. ved å bruke scriptet over i en egen build, eller midlertidig commit av config – ikke anbefalt for offentlig repo).

---

## Kjøre nettsiden lokalt

**Viktig:** I prosjektroten ligger **to** ting: Vite/React-appen (`index.html` + `src/`) og den statiske nettsiden i **`website/`**.  
Hvis du kjører `npx serve .` **fra rot** og åpner `http://localhost:3000/`, får du **ikke** `website/`-versjonen – du får rot-`index.html`. Da ser du **ikke** endringer i `website/activityfinder-ui.css` osv.

**Slik ser du riktig nettside:**

```powershell
cd website
npx serve .
```

Eller fra rot (uten å bytte mappe):

- Åpne **`http://localhost:3000/website/`** (merk `/website/` på slutten).

Eller bruk npm-script fra rot:

```powershell
npm run serve:web
```

Etter endringer i CSS/JS: bruk **hard refresh** (Ctrl+Shift+R) eller «Empty cache» – ellers kan nettleseren vise gammel CSS (HTTP 304).

**Sjekk at du får ny HTML:** Høyreklikk → **Vis sidekilde** (Ctrl+U) og søk etter `activityfinder-ui.css`. Stilarket heter **`website/activityfinder-ui.css`**.

**304 på CSS lokalt:** Nettleseren kan bruke gammel hurtiglagret CSS. Kjør `serve` med **`--no-etag`**: `npm run serve:root` (fra rot) eller `npm run serve:web` (kun `website/`). Alternativt: tøm nettleserdata for `localhost`.

Ved `npx serve .` fra rot brukes **`serve.json`** (start `serve` på nytt etter endring).

Mer detaljer finnes i `website/SUPABASE-SETUP.md` om du bruker Supabase.

---

## Mappestruktur (kort)

| Mappe / fil | Innhold |
|-------------|---------|
| `website/` | Statisk nettside (`index.html`, `app.js`, `activityfinder-ui.css`) |
| `vercel.json` | Deploy av **website/** til Vercel (ikke Vite-appen i rot) |
| `scripts/vercel-website-config.js` | Lager `website/config.js` på Vercel fra miljøvariabler |
| `supabase/` | SQL og dokumentasjon for database |
| `src/` | Annen app-kode (f.eks. Vite/React) om du bruker den |

Git-kommandoene skal kjøres i **rot** (`Cursor AI APP`), ikke bare inne i `website/`, med mindre du bevisst bare vil versionere undermappen.
