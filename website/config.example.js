/**
 * Eksempel – kopier til config.js og fyll inn verdier fra Supabase:
 * Prosjekt → Settings → API → Project URL og anon (public) key.
 * Filen config.js er ignorert av Git og skal ikke committes.
 *
 * index.html laster først supabase-runtime.js (tom mal / generert på Vercel),
 * deretter config.js som overstyrer lokalt.
 */
window.SUPABASE_URL = 'https://DITT-PROSJEKT.supabase.co';
window.SUPABASE_ANON_KEY = 'DIN_ANON_PUBLIC_KEY_HER';
