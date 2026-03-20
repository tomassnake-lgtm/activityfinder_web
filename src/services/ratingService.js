import { supabase } from '../lib/supabaseClient.js'

export async function getActivityLeaderRating(hostName, userId) {
	if (!supabase) return null
	
	try {
		// Get all activities by this host
		const { data: activities, error: activitiesError } = await supabase
			.from('activities')
			.select('id')
			.eq('host', hostName)
		
		if (activitiesError || !activities || activities.length === 0) {
			return {
				averageRating: 0,
				totalRatings: 0,
				ratings: []
			}
		}
		
		const activityIds = activities.map(a => a.id)
		
		// Get all ratings for these activities
		const { data: ratings, error: ratingsError } = await supabase
			.from('activity_ratings')
			.select('*')
			.in('activity_id', activityIds)
		
		if (ratingsError && ratingsError.code !== '42P01') {
			console.error('Error fetching ratings:', ratingsError)
			return {
				averageRating: 0,
				totalRatings: 0,
				ratings: []
			}
		}
		
		if (!ratings || ratings.length === 0) {
			return {
				averageRating: 0,
				totalRatings: 0,
				ratings: []
			}
		}
		
		const totalRatings = ratings.length
		const sumRatings = ratings.reduce((sum, r) => sum + (r.rating || 0), 0)
		const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0
		
		return {
			averageRating: Math.round(averageRating * 10) / 10,
			totalRatings,
			ratings: ratings.map(r => ({
				rating: r.rating,
				comment: r.comment,
				created_at: r.created_at
			}))
		}
	} catch (err) {
		console.error('Error getting rating:', err)
		return {
			averageRating: 0,
			totalRatings: 0,
			ratings: []
		}
	}
}

export async function submitRating(activityId, userId, rating, comment) {
	if (!supabase) return null
	
	try {
		const { data, error } = await supabase
			.from('activity_ratings')
			.insert({
				activity_id: activityId,
				user_id: userId,
				rating: rating,
				comment: comment || null,
				created_at: new Date().toISOString()
			})
			.select()
			.single()
		
		if (error && error.code !== '42P01') {
			console.error('Error submitting rating:', error)
			return null
		}
		
		return data
	} catch (err) {
		console.error('Error submitting rating:', err)
		return null
	}
}

export function renderStars(rating) {
	const fullStars = Math.floor(rating)
	const hasHalfStar = rating % 1 >= 0.5
	const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
	
	let stars = ''
	for (let i = 0; i < fullStars; i++) {
		stars += '⭐'
	}
	if (hasHalfStar) {
		stars += '✨'
	}
	for (let i = 0; i < emptyStars; i++) {
		stars += '☆'
	}
	
	return stars
}

