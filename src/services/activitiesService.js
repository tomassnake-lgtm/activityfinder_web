import { supabase } from '../lib/supabaseClient.js'
import { DEFAULT_COORDS } from '../constants/sampleData.js'
import { getPhotoAccent } from '../constants/photoLibrary.js'

const ACTIVITY_SELECT = `
  id,
  name,
  location,
  date,
  category,
  host,
  description,
  joined,
  latitude,
  longitude,
  photo_id,
  color,
  price,
  tags,
  custom_photo_url
`

let activityChannel

export async function fetchActivities() {
	if (!supabase) return []

	try {
		const { data, error } = await supabase.from('activities').select(ACTIVITY_SELECT).order('date', {
			ascending: true
		})

		if (error) throw error
		if (!data) return []
		return data.map(normalizeActivity)
	} catch (error) {
		console.error('Failed to fetch activities from Supabase.', error)
		return []
	}
}

export async function createActivity(activity) {
	if (!supabase) {
		console.warn('Supabase is not configured, creating activity locally.')
		return {
			...activity,
			id: `local-${Date.now()}`
		}
	}

	const payload = serializeActivity(activity)

	try {
		const { data, error } = await supabase
			.from('activities')
			.insert(payload)
			.select(ACTIVITY_SELECT)
			.single()

		if (error) throw error
		return normalizeActivity(data)
	} catch (error) {
		console.error('Failed to create activity in Supabase, keeping local copy.', error)
		return {
			...activity,
			id: `local-${Date.now()}`
		}
	}
}

export function subscribeToActivityChanges(callback) {
	if (!supabase || typeof supabase.channel !== 'function') return () => {}

	if (activityChannel) {
		activityChannel.unsubscribe()
	}

	activityChannel = supabase
		.channel('public:activities')
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'activities' },
			payload => callback?.(payload)
		)
		.subscribe(status => {
			if (status === 'CLOSED') {
				activityChannel = null
			}
		})

	return () => activityChannel?.unsubscribe()
}

function normalizeActivity(row) {
	const lat = row.latitude ?? row.lat ?? row.coords?.[0] ?? DEFAULT_COORDS[0]
	const lon = row.longitude ?? row.lng ?? row.coords?.[1] ?? DEFAULT_COORDS[1]
	const photoId = row.photo_id || row.photoId || 'lake'
	return {
		id: row.id,
		name: row.name || row.title || 'Ny aktivitet',
		location: row.location || 'Moss',
		date: row.date || row.date_time || new Date().toISOString(),
		category: row.category || 'Community',
		host: row.host || row.host_name || 'Local host',
		description: row.description || 'Detaljer kommer.',
		joined: row.joined || row.joined_count || 0,
		coords: [lat, lon],
		color: row.color || getPhotoAccent(photoId),
		photoId,
		price: row.price || 0,
		tags: row.tags || [],
		customPhotoUrl: row.custom_photo_url || null
	}
}

function serializeActivity(activity) {
	const [latitude, longitude] = activity.coords || DEFAULT_COORDS
	return {
		name: activity.name,
		location: activity.location,
		date: activity.date,
		category: activity.category,
		host: activity.host,
		description: activity.description,
		joined: activity.joined,
		latitude,
		longitude,
		photo_id: activity.photoId,
		color: activity.color,
		price: activity.price || 0,
		tags: activity.tags || [],
		custom_photo_url: activity.customPhotoUrl || null
	}
}

