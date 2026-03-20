import { supabase } from '../lib/supabaseClient.js'

export async function trackEvent(eventName, properties = {}) {
	if (!supabase) return

	try {
		const payload = {
			event_name: eventName,
			properties,
			user_agent: navigator.userAgent,
			path: window.location.pathname
		}

		await supabase.from('analytics_events').insert(payload)
	} catch (error) {
		console.error('Failed to track analytics event', error)
	}
}


