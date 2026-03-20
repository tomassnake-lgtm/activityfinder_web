import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
	supabaseUrl && supabaseKey
		? createClient(supabaseUrl, supabaseKey, {
			auth: {
				autoRefreshToken: true, // Re-enabled now that Supabase is working
				persistSession: true, // Re-enabled to keep users logged in
				detectSessionInUrl: true,
				storage: typeof window !== 'undefined' ? window.localStorage : undefined,
				storageKey: 'activityfinder-auth'
			}
		})
		: null

if (!supabase) {
	console.error(
		'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
	)
} else {
	console.log('Supabase client initialized successfully')
	console.log('Supabase URL:', supabaseUrl)
}

