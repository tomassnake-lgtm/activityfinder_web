import { supabase } from '../lib/supabaseClient.js'
import { DEFAULT_COORDS } from '../constants/sampleData.js'
import { getPhotoAccent } from '../constants/photoLibrary.js'

/**
 * Sessions Service
 * Handles activity concepts (templates) and activity sessions (instances)
 * 
 * Architecture:
 * - activities (concepts) -> activity_sessions (instances) -> signups (participants)
 */

// ============================================
// ACTIVITY CONCEPTS (Templates)
// ============================================

const ACTIVITY_CONCEPT_SELECT = `
  id,
  user_id,
  name,
  description,
  category,
  default_location,
  default_latitude,
  default_longitude,
  default_coords,
  photo_id,
  custom_photo_url,
  color,
  default_price,
  default_max_participants,
  default_duration_minutes,
  is_recurring,
  recurrence_pattern,
  status,
  created_at,
  updated_at
`

/**
 * Fetch all active activity concepts
 */
export async function fetchActivityConcepts() {
	if (!supabase) return []

	try {
		const { data, error } = await supabase
			.from('activities')
			.select(ACTIVITY_CONCEPT_SELECT)
			.eq('status', 'active')
			.order('created_at', { ascending: false })

		if (error) throw error
		if (!data) return []
		return data.map(normalizeActivityConcept)
	} catch (error) {
		console.error('Failed to fetch activity concepts:', error)
		return []
	}
}

/**
 * Create a new activity concept
 */
export async function createActivityConcept(concept) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	const payload = serializeActivityConcept(concept)

	try {
		const { data, error } = await supabase
			.from('activities')
			.insert(payload)
			.select(ACTIVITY_CONCEPT_SELECT)
			.single()

		if (error) throw error
		return normalizeActivityConcept(data)
	} catch (error) {
		console.error('Failed to create activity concept:', error)
		throw error
	}
}

/**
 * Update an existing activity concept
 */
export async function updateActivityConcept(conceptId, updates) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	try {
		const { data, error } = await supabase
			.from('activities')
			.update({
				...updates,
				updated_at: new Date().toISOString()
			})
			.eq('id', conceptId)
			.select(ACTIVITY_CONCEPT_SELECT)
			.single()

		if (error) throw error
		return normalizeActivityConcept(data)
	} catch (error) {
		console.error('Failed to update activity concept:', error)
		throw error
	}
}

// ============================================
// ACTIVITY SESSIONS (Instances)
// ============================================

const SESSION_SELECT = `
  id,
  activity_id,
  user_id,
  name,
  location,
  session_date,
  session_end_date,
  latitude,
  longitude,
  coords,
  price,
  max_participants,
  duration_minutes,
  host_name,
  signed_up_count,
  attended_count,
  status,
  session_notes,
  weather_conditions,
  actual_duration_minutes,
  created_at,
  updated_at,
  activities:activity_id (
    ${ACTIVITY_CONCEPT_SELECT}
  )
`

/**
 * Fetch upcoming activity sessions
 */
export async function fetchUpcomingSessions(options = {}) {
	if (!supabase) return []

	const {
		limit = null,
		activityId = null,
		status = ['scheduled', 'confirmed'],
		includePast = false
	} = options

	try {
		let query = supabase
			.from('activity_sessions')
			.select(SESSION_SELECT)
			.in('status', Array.isArray(status) ? status : [status])
			.order('session_date', { ascending: true })

		if (activityId) {
			query = query.eq('activity_id', activityId)
		}

		if (!includePast) {
			query = query.gte('session_date', new Date().toISOString())
		}

		if (limit) {
			query = query.limit(limit)
		}

		const { data, error } = await query

		if (error) throw error
		if (!data) return []
		return data.map(normalizeSession)
	} catch (error) {
		console.error('Failed to fetch upcoming sessions:', error)
		return []
	}
}

/**
 * Fetch all sessions for a specific activity concept
 */
export async function fetchSessionsForActivity(activityId) {
	if (!supabase) return []

	try {
		const { data, error } = await supabase
			.from('activity_sessions')
			.select(SESSION_SELECT)
			.eq('activity_id', activityId)
			.order('session_date', { ascending: true })

		if (error) throw error
		if (!data) return []
		return data.map(normalizeSession)
	} catch (error) {
		console.error('Failed to fetch sessions for activity:', error)
		return []
	}
}

/**
 * Create a new activity session
 */
export async function createSession(activityId, sessionData) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	// Get activity concept to merge defaults
	const { data: activityConcept } = await supabase
		.from('activities')
		.select(ACTIVITY_CONCEPT_SELECT)
		.eq('id', activityId)
		.single()

	if (!activityConcept) {
		throw new Error('Activity concept not found')
	}

	// Merge session data with activity concept defaults
	const payload = {
		activity_id: activityId,
		user_id: sessionData.userId,
		name: sessionData.name || null,
		location: sessionData.location || activityConcept.default_location,
		session_date: sessionData.sessionDate,
		session_end_date: sessionData.sessionEndDate || null,
		latitude: sessionData.latitude || activityConcept.default_latitude,
		longitude: sessionData.longitude || activityConcept.default_longitude,
		coords: sessionData.coords 
			? `(${sessionData.coords[0]},${sessionData.coords[1]})`
			: (activityConcept.default_coords || null),
		price: sessionData.price !== undefined 
			? sessionData.price 
			: (activityConcept.default_price || 0),
		max_participants: sessionData.maxParticipants !== undefined
			? sessionData.maxParticipants
			: (activityConcept.default_max_participants || null),
		duration_minutes: sessionData.durationMinutes 
			? sessionData.durationMinutes 
			: (activityConcept.default_duration_minutes || null),
		host_name: sessionData.hostName || null,
		status: sessionData.status || 'scheduled'
	}

	try {
		const { data, error } = await supabase
			.from('activity_sessions')
			.insert(payload)
			.select(SESSION_SELECT)
			.single()

		if (error) throw error
		return normalizeSession(data)
	} catch (error) {
		console.error('Failed to create session:', error)
		throw error
	}
}

/**
 * Update an existing session
 */
export async function updateSession(sessionId, updates) {
	if (!supabase) {
		console.warn('Supabase not configured')
		return null
	}

	try {
		const { data, error } = await supabase
			.from('activity_sessions')
			.update({
				...updates,
				updated_at: new Date().toISOString()
			})
			.eq('id', sessionId)
			.select(SESSION_SELECT)
			.single()

		if (error) throw error
		return normalizeSession(data)
	} catch (error) {
		console.error('Failed to update session:', error)
		throw error
	}
}

/**
 * Get a single session by ID
 */
export async function getSession(sessionId) {
	if (!supabase) return null

	try {
		const { data, error } = await supabase
			.from('activity_sessions')
			.select(SESSION_SELECT)
			.eq('id', sessionId)
			.single()

		if (error) throw error
		return normalizeSession(data)
	} catch (error) {
		console.error('Failed to get session:', error)
		return null
	}
}

/**
 * Subscribe to real-time changes in activity_sessions
 */
export function subscribeToSessionChanges(callback) {
	if (!supabase || typeof supabase.channel !== 'function') return () => {}

	const channel = supabase
		.channel('activity_sessions_changes')
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'activity_sessions'
			},
			async () => {
				// Refetch sessions when changes occur
				const sessions = await fetchUpcomingSessions()
				callback(sessions)
			}
		)
		.subscribe()

	return () => channel.unsubscribe()
}

// ============================================
// NORMALIZATION & SERIALIZATION
// ============================================

/**
 * Normalize activity concept from database row
 */
function normalizeActivityConcept(row) {
	const coords = parseCoords(row.default_coords) || [
		row.default_latitude || DEFAULT_COORDS[0],
		row.default_longitude || DEFAULT_COORDS[1]
	]

	return {
		id: row.id,
		userId: row.user_id,
		name: row.name,
		description: row.description || '',
		category: row.category,
		defaultLocation: row.default_location,
		defaultLatitude: row.default_latitude,
		defaultLongitude: row.default_longitude,
		defaultCoords: coords,
		photoId: row.photo_id || 'lake',
		customPhotoUrl: row.custom_photo_url,
		color: row.color || getPhotoAccent(row.photo_id || 'lake'),
		defaultPrice: parseFloat(row.default_price) || 0,
		defaultMaxParticipants: row.default_max_participants,
		defaultDurationMinutes: row.default_duration_minutes,
		isRecurring: row.is_recurring || false,
		recurrencePattern: row.recurrence_pattern,
		status: row.status || 'active',
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}
}

/**
 * Normalize session from database row (includes activity concept)
 */
function normalizeSession(row) {
	const activity = row.activities ? normalizeActivityConcept(row.activities) : null
	const coords = parseCoords(row.coords) || [
		row.latitude || activity?.defaultCoords?.[0] || DEFAULT_COORDS[0],
		row.longitude || activity?.defaultCoords?.[1] || DEFAULT_COORDS[1]
	]

	return {
		id: row.id,
		activityId: row.activity_id,
		userId: row.user_id,
		name: row.name || activity?.name,
		location: row.location,
		sessionDate: row.session_date,
		sessionEndDate: row.session_end_date,
		latitude: row.latitude,
		longitude: row.longitude,
		coords: coords,
		price: row.price !== null && row.price !== undefined 
			? parseFloat(row.price) 
			: (activity?.defaultPrice || 0),
		maxParticipants: row.max_participants !== null && row.max_participants !== undefined
			? row.max_participants
			: (activity?.defaultMaxParticipants || null),
		durationMinutes: row.duration_minutes || activity?.defaultDurationMinutes,
		hostName: row.host_name || activity?.userId || '',
		signedUpCount: row.signed_up_count || 0,
		attendedCount: row.attended_count || 0,
		status: row.status || 'scheduled',
		sessionNotes: row.session_notes,
		weatherConditions: row.weather_conditions,
		actualDurationMinutes: row.actual_duration_minutes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		// Include full activity concept
		activity: activity
	}
}

/**
 * Serialize activity concept for database
 */
function serializeActivityConcept(concept) {
	const [lat, lon] = concept.defaultCoords || DEFAULT_COORDS

	return {
		user_id: concept.userId,
		name: concept.name,
		description: concept.description || '',
		category: concept.category,
		default_location: concept.defaultLocation,
		default_latitude: lat,
		default_longitude: lon,
		default_coords: `(${lat},${lon})`,
		photo_id: concept.photoId || 'lake',
		custom_photo_url: concept.customPhotoUrl || null,
		color: concept.color || getPhotoAccent(concept.photoId || 'lake'),
		default_price: concept.defaultPrice || 0,
		default_max_participants: concept.defaultMaxParticipants || null,
		default_duration_minutes: concept.defaultDurationMinutes || null,
		is_recurring: concept.isRecurring || false,
		recurrence_pattern: concept.recurrencePattern || null,
		status: concept.status || 'active'
	}
}

/**
 * Parse coordinates from various formats
 */
function parseCoords(coords) {
	if (!coords) return null

	// If it's already an array
	if (Array.isArray(coords)) {
		return coords.length >= 2 ? [coords[0], coords[1]] : null
	}

	// If it's a PostgreSQL point type string like "(59.43,10.68)"
	if (typeof coords === 'string') {
		const match = coords.match(/\(([^,]+),([^)]+)\)/)
		if (match) {
			return [parseFloat(match[1]), parseFloat(match[2])]
		}
		// Try comma-separated
		const parts = coords.split(',')
		if (parts.length >= 2) {
			return [parseFloat(parts[0].trim()), parseFloat(parts[1].trim())]
		}
	}

	return null
}
