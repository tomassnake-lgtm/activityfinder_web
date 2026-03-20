import { supabase } from '../lib/supabaseClient.js'

export const USER_TYPES = {
	USER: 'user',
	ACTIVITY_LEADER: 'activity_leader',
	PARTNER: 'partner',
	ADMIN: 'admin'
}

const ADMIN_EMAILS = ['tomas.snake@live.no']

export function getUserType(user) {
	if (!user || !user.email) return USER_TYPES.USER
	
	if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
		return USER_TYPES.ADMIN
	}
	
	return user.user_metadata?.user_type || USER_TYPES.USER
}

export function canCreateActivities(user) {
	const userType = getUserType(user)
	return userType === USER_TYPES.ACTIVITY_LEADER || 
		   userType === USER_TYPES.PARTNER || 
		   userType === USER_TYPES.ADMIN
}

export function isAdmin(user) {
	return getUserType(user) === USER_TYPES.ADMIN
}

export async function updateUserProfile(userId, updates) {
	if (!supabase) return null
	
	const { data, error } = await supabase
		.from('user_profiles')
		.upsert({
			user_id: userId,
			...updates,
			updated_at: new Date().toISOString()
		})
		.select()
		.single()
	
	if (error) {
		console.error('Failed to update user profile', error)
		return null
	}
	
	return data
}

export async function getUserProfile(userId) {
	if (!supabase) return null
	
	const { data, error } = await supabase
		.from('user_profiles')
		.select('*')
		.eq('user_id', userId)
		.single()
	
	if (error) {
		console.error('Failed to fetch user profile', error)
		return null
	}
	
	return data
}

