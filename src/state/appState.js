import { photoLibrary } from '../constants/photoLibrary.js'

export const state = {
	activities: [],
	forumPosts: [],
	currentUser: null,
	discoverMode: 'list',
	activitiesViewMode: 'upcoming',
	selectedPhotoId: photoLibrary[0]?.id || null,
	customPhotoUrl: null,
	navButtons: [],
	forumLikes: new Set(),
	searchRadiusKm: 5,
	userLocation: null,
	userBadges: [], // Array of badge objects
	userPoints: 0, // User points
	previousActivityDescriptions: {} // For notification system
}

