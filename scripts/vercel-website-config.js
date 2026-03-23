/**
 * Kjøres på Vercel før deploy: skriver website/config.js fra miljøvariabler.
 * Sett i Vercel → Project → Settings → Environment Variables:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * Kjører bare når VERCEL=1 (Vercel sitt build-miljø), så lokalt kjøring
 * overskriver ikke din egen config.js.
 */
const fs = require('fs');
const path = require('path');

if (process.env.VERCEL !== '1') {
  console.log(
    '[vercel-website-config] Hopper over (ikke Vercel-build). Lokalt: bruk website/config.js som vanlig.'
  );
  process.exit(0);
}

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const out = path.join(__dirname, '..', 'website', 'config.js');

if (!url || !key) {
  console.warn(
    '[vercel-website-config] SUPABASE_URL eller SUPABASE_ANON_KEY mangler. ' +
      'Legg dem inn under Vercel → Environment Variables, ellers får ikke nettsiden kontakt med Supabase.'
  );
}

const content =
  '/**\n' +
  ' * Generert ved deploy (Vercel). Ikke rediger manuelt på server.\n' +
  ' */\n' +
  'window.SUPABASE_URL = ' +
  JSON.stringify(url) +
  ';\n' +
  'window.SUPABASE_ANON_KEY = ' +
  JSON.stringify(key) +
  ';\n';

fs.writeFileSync(out, content, 'utf8');
console.log('[vercel-website-config] Skrev', out);
