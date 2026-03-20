import { supabase } from '../lib/supabaseClient.js'
import { state } from '../state/appState.js'

export const BADGES = {
	ACTIVITY_LEADER: {
		id: 'activity_leader',
		name: 'Aktivitetsleder',
		icon: '🎓',
		description: 'Ble en aktivitetsleder ved å gjøre ferdig kurset',
		condition: (user, stats) => stats.isActivityLeader
	},
	FIRST_PARTICIPATION: {
		id: 'first_participation',
		name: 'Første deltakelse',
		icon: '🎉',
		description: 'Deltok i sin første aktivitet',
		condition: (user, stats) => stats.participatedCount >= 1
	},
	TEN_DAYS: {
		id: 'ten_days',
		name: '10 dager',
		icon: '📅',
		description: 'Har vært på appen i 10 dager',
		condition: (user, stats) => stats.daysSinceJoin >= 10
	},
	FIVE_HOSTED: {
		id: 'five_hosted',
		name: '5 arrangert',
		icon: '⭐',
		description: 'Har holdt 5 aktiviteter',
		condition: (user, stats) => stats.hostedCount >= 5
	},
	TEN_PARTICIPATED: {
		id: 'ten_participated',
		name: '10 deltakelser',
		icon: '🏆',
		description: 'Har deltatt på 10 aktiviteter',
		condition: (user, stats) => stats.participatedCount >= 10
	},
	THIRTY_DAYS: {
		id: 'thirty_days',
		name: '30 dager',
		icon: '📆',
		description: 'Har vært på appen i 30 dager',
		condition: (user, stats) => stats.daysSinceJoin >= 30
	},
	FORUM_POST: {
		id: 'forum_post',
		name: 'Diskusjonsdeltaker',
		icon: '💬',
		description: 'Har opprettet et innlegg i diskusjon',
		condition: (user, stats) => stats.forumPostsCount >= 1
	}
}

export function calculateUserStats(user) {
	if (!user) return null
	
	const hostName = user.user_metadata?.name || user.email?.split('@')[0] || ''
	const userActivities = state.activities.filter(activity => activity.host === hostName)
	const hostedCount = userActivities.length
	
	// Calculate participated count (simplified - in real app, this would come from database)
	const participatedCount = 0 // TODO: Get from database
	
	// Calculate days since join
	const joinDate = user.created_at ? new Date(user.created_at) : new Date()
	const daysSinceJoin = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24))
	
	// Check if user is activity leader
	const userType = user.user_metadata?.user_type || 'user'
	const isActivityLeader = userType === 'activity_leader' || userType === 'partner' || userType === 'admin'
	
	// Count forum posts by this user
	const forumPostsCount = state.forumPosts.filter(post => 
		post.author === hostName || post.user_id === user.id
	).length
	
	return {
		hostedCount,
		participatedCount,
		daysSinceJoin,
		isActivityLeader,
		forumPostsCount
	}
}

export function checkBadges(user, previousBadges = []) {
	if (!user) return []
	
	const stats = calculateUserStats(user)
	if (!stats) return []
	
	const earnedBadges = []
	
	Object.values(BADGES).forEach(badge => {
		if (badge.condition(user, stats)) {
			earnedBadges.push(badge)
		}
	})
	
	// Find newly earned badges
	const newBadges = earnedBadges.filter(badge => 
		!previousBadges.some(prev => prev.id === badge.id)
	)
	
	return { earnedBadges, newBadges }
}

export async function saveBadgesToSupabase(userId, badges) {
	if (!supabase) return
	
	try {
		const { error } = await supabase
			.from('user_badges')
			.upsert({
				user_id: userId,
				badges: badges.map(b => b.id),
				updated_at: new Date().toISOString()
			})
		
		if (error && error.code !== '42P01') {
			console.error('Error saving badges:', error)
		}
	} catch (err) {
		console.log('user_badges table might not exist')
	}
}

export async function loadBadgesFromSupabase(userId) {
	if (!supabase) return []
	
	try {
		const { data, error } = await supabase
			.from('user_badges')
			.select('badges')
			.eq('user_id', userId)
			.single()
		
		if (error && error.code !== 'PGRST116') {
			console.error('Error loading badges:', error)
			return []
		}
		
		if (data && data.badges) {
			return data.badges.map(badgeId => 
				Object.values(BADGES).find(b => b.id === badgeId)
			).filter(Boolean)
		}
		
		return []
	} catch (err) {
		return []
	}
}

