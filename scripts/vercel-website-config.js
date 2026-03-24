/**
 * Kjøres på Vercel før deploy: skriver website/supabase-runtime.js fra miljøvariabler.
 * (config.js er ofte i .gitignore og kan utelates fra deploy-artefakt – derfor egen fil.)
 *
 * Sett i Vercel → Project → Settings → Environment Variables:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 */
const fs = require('fs');
const path = require('path');

const onVercel =
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true' ||
  !!process.env.VERCEL_ENV;

if (!onVercel) {
  console.log(
    '[vercel-website-config] Hopper over (ikke Vercel-build). Lokalt: bruk supabase-runtime.js og/eller config.js.'
  );
  process.exit(0);
}

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const websiteDir = path.join(__dirname, '..', 'website');
const outRuntime = path.join(websiteDir, 'supabase-runtime.js');
const outConfig = path.join(websiteDir, 'config.js');

const fileBody =
  '/**\n' +
  ' * Generert ved deploy (Vercel). Ikke rediger her.\n' +
  ' */\n' +
  'window.SUPABASE_URL = ' +
  JSON.stringify(url) +
  ';\n' +
  'window.SUPABASE_ANON_KEY = ' +
  JSON.stringify(key) +
  ';\n';

if (!url || !key) {
  console.error(
    '[vercel-website-config] FEIL: SUPABASE_URL eller SUPABASE_ANON_KEY mangler eller er tomme. ' +
      'Legg dem inn under Vercel → Settings → Environment Variables (Production + ev. Preview), deretter Redeploy.'
  );
  process.exit(1);
}

fs.writeFileSync(outRuntime, fileBody, 'utf8');
console.log('[vercel-website-config] Skrev', outRuntime);
/* Ekstra: skriv også config.js i build-output (nyttig hvis noe laster den). */
fs.writeFileSync(outConfig, fileBody, 'utf8');
console.log('[vercel-website-config] Skrev', outConfig);
