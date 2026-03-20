import { supabase } from '../lib/supabaseClient.js'

/**
 * Participation Service
 * Handles user signups and attendance for activity sessions
 */

const SIGNUP_SELECT = `
  id,
  session_id,
  user_id,
  status,
  attended,
  attended_at,
  check_in_time,
  check_out_time,
  participant_notes,
  host_notes,
  signed_up_at,
  cancelled_at,
  created_at,
  updated_at,
  user_profiles:user_id (
    user_id,
    name,
    avatar_url
  )
`

/**
 * Sign up for a session
 */
export async function signUpForSession(sessionId, userId) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	try {
		const { data, error } = await supabase
			.from('signups')
			.insert({
				session_id: sessionId,
				user_id: userId,
				status: 'confirmed',
				signed_up_at: new Date().toISOString()
			})
			.select(SIGNUP_SELECT)
			.single()

		if (error) throw error
		return data
	} catch (error) {
		console.error('Failed to sign up for session:', error)
		throw error
	}
}

/**
 * Cancel a signup
 */
export async function cancelSignup(sessionId, userId) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	try {
		const { data, error } = await supabase
			.from('signups')
			.update({
				status: 'cancelled',
				cancelled_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq('session_id', sessionId)
			.eq('user_id', userId)
			.select(SIGNUP_SELECT)
			.single()

		if (error) throw error
		return data
	} catch (error) {
		console.error('Failed to cancel signup:', error)
		throw error
	}
}

/**
 * Get all participants for a session
 */
export async function getActivityParticipants(sessionId) {
	if (!supabase) return []

	try {
		const { data, error } = await supabase
			.from('signups')
			.select(SIGNUP_SELECT)
			.eq('session_id', sessionId)
			.in('status', ['confirmed', 'attended', 'waitlist'])
			.order('signed_up_at', { ascending: true })

		if (error) throw error
		return data || []
	} catch (error) {
		console.error('Failed to get participants:', error)
		return []
	}
}

/**
 * Get session statistics
 */
export async function getSessionStats(sessionId) {
	if (!supabase) return null

	try {
		const { data, error } = await supabase.rpc('get_session_stats', {
			p_session_id: sessionId
		})

		if (error) throw error
		return data
	} catch (error) {
		console.error('Failed to get session stats:', error)
		return null
	}
}

/**
 * Mark attendance for a participant
 */
export async function markSessionAttendance(sessionId, userId, attended) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	try {
		const { data, error } = await supabase.rpc('mark_session_attendance', {
			p_session_id: sessionId,
			p_user_id: userId,
			p_attended: attended
		})

		if (error) throw error
		return data
	} catch (error) {
		console.error('Failed to mark attendance:', error)
		throw error
	}
}

/**
 * Check if user is signed up for a session
 */
export async function isSignedUp(sessionId, userId) {
	if (!supabase || !userId) return false

	try {
		const { data, error } = await supabase
			.from('signups')
			.select('id')
			.eq('session_id', sessionId)
			.eq('user_id', userId)
			.in('status', ['confirmed', 'attended', 'waitlist'])
			.single()

		return !error && data !== null
	} catch (error) {
		return false
	}
}

/**
 * Get participation status for a user and session
 */
export async function getParticipationStatus(sessionId, userId) {
	if (!supabase || !userId) return null

	try {
		const { data, error } = await supabase
			.from('signups')
			.select('status, attended')
			.eq('session_id', sessionId)
			.eq('user_id', userId)
			.single()

		if (error || !data) return null
		return {
			status: data.status,
			attended: data.attended || false
		}
	} catch (error) {
		return null
	}
}

/**
 * Get all sessions a user has signed up for
 */
export async function getMyParticipations(userId) {
	if (!supabase || !userId) return []

	try {
		const { data, error } = await supabase
			.from('signups')
			.select(`
				*,
				activity_sessions:session_id (
					id,
					activity_id,
					location,
					session_date,
					status,
					activities:activity_id (
						id,
						name,
						category
					)
				)
			`)
			.eq('user_id', userId)
			.in('status', ['confirmed', 'attended', 'waitlist'])
			.order('signed_up_at', { ascending: false })

		if (error) throw error
		return data || []
	} catch (error) {
		console.error('Failed to get participations:', error)
		return []
	}
}
