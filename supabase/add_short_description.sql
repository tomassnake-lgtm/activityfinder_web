-- Kjør denne i Supabase SQL Editor for å legge til kort beskrivelse på aktiviteter.
-- Kort beskrivelse vises på kort og i «Alle aktiviteter»; lang beskrivelse vises i aktivitetsdetaljer.

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS short_description text;
