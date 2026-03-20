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

## Supabase-konfigurasjon (hemmeligheter)

- **`website/config.js`** inneholder API-nøkler og er **ikke** med i Git (se `.gitignore`).
- Etter `git clone`: kopier `website/config.example.js` til `website/config.js` og fyll inn dine verdier fra Supabase.

```powershell
copy website\config.example.js website\config.js
```

Rediger deretter `config.js` med din **Project URL** og **anon public key**.

---

## Kjøre nettsiden lokalt

Fra rotmappen (eller fra `website/`):

```powershell
cd website
npx serve .
```

Åpne nettleseren på adressen som vises i terminalen (ofte `http://localhost:3000`).

Mer detaljer finnes i `website/SUPABASE-SETUP.md` om du bruker Supabase.

---

## Mappestruktur (kort)

| Mappe / fil | Innhold |
|-------------|---------|
| `website/` | Statisk nettside (`index.html`, `app.js`, `styles.css`) |
| `supabase/` | SQL og dokumentasjon for database |
| `src/` | Annen app-kode (f.eks. Vite/React) om du bruker den |

Git-kommandoene skal kjøres i **rot** (`Cursor AI APP`), ikke bare inne i `website/`, med mindre du bevisst bare vil versionere undermappen.
