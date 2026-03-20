import { supabase } from '../lib/supabaseClient.js'
import { state } from '../state/appState.js'

export async function initAuth() {
	if (!supabase) return null

	try {
		// Add timeout to prevent hanging on network errors
		const sessionPromise = supabase.auth.getSession()
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Session load timeout')), 5000)
		)

		const {
			data: { session },
			error
		} = await Promise.race([sessionPromise, timeoutPromise]).catch(async (err) => {
			// If timeout or network error, return null session
			if (err.message?.includes('timeout') || err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
				console.warn('Network unavailable - continuing without session')
				return { data: { session: null }, error: null }
			}
			throw err
		})

		if (error) {
			// Only log non-network errors
			if (!error.message?.includes('Failed to fetch') && !error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
				console.error('Error getting session:', error)
			}
			// Clear any invalid session data
			if (error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('network')) {
				// Invalid token or network error, clear localStorage
				try {
					const keys = Object.keys(localStorage)
					keys.forEach(key => {
						if (key.includes('supabase') || key.includes('auth') || key.includes('activityfinder')) {
							localStorage.removeItem(key)
						}
					})
				} catch (e) {
					// Ignore localStorage errors
				}
			}
			updateAuthState(null)
		} else {
			updateAuthState(session?.user || null)
		}

		supabase.auth.onAuthStateChange((_event, session) => {
			updateAuthState(session?.user || null)
		})
	} catch (err) {
		// Silently handle network errors
		if (!err.message?.includes('Failed to fetch') && !err.message?.includes('ERR_NAME_NOT_RESOLVED') && !err.message?.includes('timeout')) {
			console.error('Failed to initialize auth:', err)
		}
		// If it's a network error, clear any stale session data
		if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED') || err.message?.includes('timeout')) {
			// Silently clear stale data
			try {
				const keys = Object.keys(localStorage)
				keys.forEach(key => {
					if (key.includes('supabase') || key.includes('auth') || key.includes('activityfinder')) {
						localStorage.removeItem(key)
					}
				})
			} catch (e) {
				// Ignore localStorage errors
			}
		}
		// Still set up the auth state change listener but with null user
		updateAuthState(null)
		supabase.auth.onAuthStateChange((_event, session) => {
			updateAuthState(session?.user || null)
		})
	}

	return state.currentUser
}

export async function signInWithGoogle() {
	if (!supabase) {
		alert('Supabase er ikke konfigurert. Legg inn VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i .env filen.')
		console.error('Supabase client is null. Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
		return
	}

	try {
		// Use full URL including port for localhost development
		const redirectTo = window.location.origin + window.location.pathname
		console.log('Attempting Google sign-in with redirect:', redirectTo)
		console.log('Current location:', window.location.href)

		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: redirectTo,
				queryParams: {
					access_type: 'offline',
					prompt: 'consent',
				}
			}
		})

		if (error) {
			console.error('Google sign-in error:', error)
			if (error.message?.includes('network') || error.message?.includes('fetch')) {
				alert('Nettverksfeil: Kunne ikke koble til Supabase. Sjekk internettforbindelsen din og at Supabase-prosjektet er aktivt.')
			} else {
				alert('Kunne ikke logge inn med Google: ' + error.message)
			}
		} else {
			console.log('Google sign-in initiated:', data)
			// OAuth redirect will happen automatically
		}
	} catch (err) {
		console.error('Unexpected error during Google sign-in:', err)
		if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
			alert('Nettverksfeil: Kunne ikke koble til Supabase. Sjekk internettforbindelsen din og at Supabase-prosjektet er aktivt.')
		} else {
			alert('En uventet feil oppstod: ' + err.message)
		}
	}
}

export async function signOut() {
	if (!supabase) {
		// Clear local state even if Supabase is not configured
		state.currentUser = null
		return
	}
	
	const { error } = await supabase.auth.signOut()
	if (error) {
		console.error('Sign out error', error)
		alert('Kunne ikke logge ut: ' + error.message)
		return
	}
	
	// Clear local state
	state.currentUser = null
}

function updateAuthState(user) {
	state.currentUser = user
	
	// Hide login modal and show app if user is logged in
	if (user) {
		if (window.hideLoginModal) {
			window.hideLoginModal()
		}
		// Initialize app if not already done
		const appShell = document.getElementById('app-shell')
		if (appShell && appShell.style.display === 'none') {
			// App not initialized yet, need to set up event listeners
			// Reset initialization flag to allow bootstrap to run
			if (window.resetInitialization) {
				window.resetInitialization()
			}
			if (window.bootstrap && typeof window.bootstrap === 'function') {
				// Re-run bootstrap to set up all event listeners
				window.bootstrap()
			}
		} else {
			// App already visible, just update UI
			if (window.updateUIForUser) {
				window.updateUIForUser()
			}
			if (window.renderProfile) {
				window.renderProfile()
			}
			if (window.updateHeaderAvatar) {
				window.updateHeaderAvatar()
			}
		}
	} else {
		if (window.showLoginModal) {
			window.showLoginModal()
		}
		// Reset initialization when user logs out
		if (window.resetInitialization) {
			window.resetInitialization()
		}
	}
}

// Fallback tekst når vi ikke har egen profil i databasen ennå
const userProfileFallback = {
	bio: 'Adventure host & community builder in Moss.'
}


