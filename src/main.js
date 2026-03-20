import { photoLibrary, getPhotoSvg, getPhotoAccent } from './constants/photoLibrary.js'
import { userProfile } from './constants/sampleData.js'
import { state } from './state/appState.js'
import { fetchActivities, createActivity, subscribeToActivityChanges } from './services/activitiesService.js'
import 'leaflet/dist/leaflet.css'
import {
	fetchForumPosts,
	createForumPost,
	createForumComment,
	updateForumLikes,
	subscribeToForumChanges
} from './services/forumService.js'
import { formatDateTime, formatRelativeTime } from './utils/format.js'
import {
	ensureMap,
	refreshMarkers,
	refreshAllMarkers,
	setupRadiusControl,
	setupLocateMeButton,
	tryLocateUser,
	getMapInstance
} from './map/mapController.js'
import { initAuth, signInWithGoogle, signOut } from './services/authService.js'
import { trackEvent } from './services/analyticsService.js'
import { getUserType, canCreateActivities, isAdmin } from './services/userService.js'
import { supabase } from './lib/supabaseClient.js'
import { checkBadges, saveBadgesToSupabase, loadBadgesFromSupabase, BADGES } from './services/badgeService.js'
import { getActivityLeaderRating, renderStars } from './services/ratingService.js'

document.addEventListener('DOMContentLoaded', () => {
	bootstrap()
})

let isInitialized = false

async function bootstrap() {
	// Prevent multiple initializations
	if (isInitialized) {
		return
	}

	await initAuth()

	// Always set up login modal handlers first
	setupLoginModal()

	// Check if user is logged in, show login modal if not
	if (!state.currentUser) {
		showLoginModal()
		// Still set up basic navigation so login modal buttons work
		return
	}

	// Mark as initialized
	isInitialized = true

	// User is logged in, initialize app
	hideLoginModal()
	renderPhotoLibrary()
	renderActivities()
	renderProfile()
	setupNavigation()
	setupDiscoverToggle()
	setupSearchAndFilters()
	setupCreateForm()
	setupForumComposer()
	setupActivitiesToggle()
	setupRadiusControl(state)
	setupLocateMeButton(() => tryLocateUser(state, { fallbackToDefault: true }))

	setupAuthButtons()
	setupProfileEditing()
	setupSettings()
	setupHeaderAvatar()
	setupAdminButton()
	setupActivityLeaderApplication()
	setupNotifications()
	updateUIForUser()

	await Promise.all([hydrateActivities(), hydrateForum()])

	tryLocateUser(state, { fallbackToDefault: true })

	subscribeToActivityChanges(() => hydrateActivities({ silent: true }))
	subscribeToForumChanges(() => hydrateForum({ silent: true }))

	// Load and check badges
	if (state.currentUser) {
		const savedBadges = await loadBadgesFromSupabase(state.currentUser.id)
		state.userBadges = savedBadges || []
		// Load user points from database
		state.userPoints = await loadUserPointsFromSupabase(state.currentUser.id) || state.currentUser.user_metadata?.points || 0
		updateUserPoints()
		checkAndRenderBadges(state.currentUser)
	}

	trackEvent('app_boot', {})
}

function showLoginModal() {
	const modal = document.getElementById('login-modal')
	const appShell = document.getElementById('app-shell')
	if (modal) {
		modal.style.display = 'flex'
		modal.style.pointerEvents = 'auto'
	}
	if (appShell) {
		appShell.style.display = 'none'
		appShell.style.pointerEvents = 'none'
	}
}

function hideLoginModal() {
	const modal = document.getElementById('login-modal')
	const appShell = document.getElementById('app-shell')
	if (modal) {
		modal.style.display = 'none'
		modal.style.pointerEvents = 'none'
	}
	if (appShell) {
		appShell.style.display = 'flex'
		appShell.style.pointerEvents = 'auto'
	}
}

function setupLoginModal() {
	const modalGoogleBtn = document.getElementById('modal-google-signin-btn')
	const emailLoginForm = document.getElementById('email-login-form')
	const showSignupLink = document.getElementById('show-signup')
	const showLoginLink = document.getElementById('show-login')
	const emailSignupForm = document.getElementById('email-signup-form')
	const loginContent = document.getElementById('login-content')
	const signupContent = document.getElementById('signup-content')

	if (modalGoogleBtn) {
		modalGoogleBtn.addEventListener('click', async () => {
			await signInWithGoogle()
		})
	}

	if (emailLoginForm) {
		emailLoginForm.addEventListener('submit', async (e) => {
			e.preventDefault()
			const email = document.getElementById('login-email').value
			const password = document.getElementById('login-password').value
			
			if (!supabase) {
				alert('Supabase er ikke konfigurert.')
				return
			}
			
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password
			})
			
			if (error) {
				alert('Kunne ikke logge inn: ' + error.message)
			}
			// Success handled by auth state change
		})
	}

	if (showSignupLink) {
		showSignupLink.addEventListener('click', (e) => {
			e.preventDefault()
			if (loginContent) loginContent.style.display = 'none'
			if (signupContent) signupContent.style.display = 'block'
		})
	}

	if (showLoginLink) {
		showLoginLink.addEventListener('click', (e) => {
			e.preventDefault()
			if (signupContent) signupContent.style.display = 'none'
			if (loginContent) loginContent.style.display = 'block'
		})
	}

	if (emailSignupForm) {
		emailSignupForm.addEventListener('submit', async (e) => {
			e.preventDefault()
			const name = document.getElementById('signup-name').value
			const email = document.getElementById('signup-email').value
			const password = document.getElementById('signup-password').value
			const passwordConfirm = document.getElementById('signup-password-confirm').value
			
			if (password !== passwordConfirm) {
				alert('Passordene matcher ikke.')
				return
			}
			
			if (password.length < 6) {
				alert('Passordet må være minst 6 tegn langt.')
				return
			}
			
			if (!supabase) {
				alert('Supabase er ikke konfigurert.')
				return
			}
			
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						name: name,
						full_name: name
					}
				}
			})
			
			if (error) {
				alert('Kunne ikke opprette konto: ' + error.message)
			} else {
				alert('Konto opprettet! Sjekk e-posten din for å bekrefte kontoen.')
			}
		})
	}
}

async function hydrateActivities({ silent = false } = {}) {
	const activities = await fetchActivities()
	// Filter out test activities
	state.activities = (activities || []).filter(
		activity => !activity.name.toLowerCase().includes('test')
	)
	await renderDiscover()
	const mapInstance = getMapInstance()
	if (mapInstance) {
		refreshAllMarkers(state.activities, state)
	}
}

async function hydrateForum({ silent = false } = {}) {
	const posts = await fetchForumPosts()
	state.forumPosts = posts || []
	if (!silent) {
		renderForum()
	} else {
		renderForum()
	}
}

function renderPhotoLibrary() {
	const grid = document.getElementById('photo-library')
	if (!grid) return
	grid.innerHTML = ''

	photoLibrary.forEach(option => {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'photo-option'
		const isSelected = option.id === state.selectedPhotoId && !state.customPhotoUrl
		if (isSelected) button.classList.add('active')
		button.setAttribute('role', 'radio')
		button.setAttribute('aria-checked', isSelected ? 'true' : 'false')
		button.innerHTML = `${option.svg}<span>${option.label}</span>`
		if (isSelected) {
			const ring = document.createElement('div')
			ring.className = 'photo-selection-ring'
			button.appendChild(ring)
		}
		button.addEventListener('click', () => {
			state.selectedPhotoId = option.id
			state.customPhotoUrl = null
			updatePhotoSelection()
		})
		grid.appendChild(button)
	})

	// Check if user can upload custom photos
	const hostName = state.currentUser?.user_metadata?.name || state.currentUser?.email?.split('@')[0] || userProfile.name
	const userActivities = state.activities.filter(activity => activity.host === hostName)
	const canUpload = userActivities.length > 0

	const uploadSection = document.getElementById('custom-photo-upload')
	if (uploadSection) {
		uploadSection.style.display = canUpload ? 'block' : 'none'
		if (canUpload) {
			setupCustomPhotoUpload()
		}
	}

	updatePhotoSelection()
}

function updatePhotoSelection() {
	const grid = document.getElementById('photo-library')
	if (!grid) return

	Array.from(grid.children).forEach((child, index) => {
		const option = photoLibrary[index]
		if (!option) return
		const isSelected = option.id === state.selectedPhotoId && !state.customPhotoUrl
		child.classList.toggle('active', isSelected)
		child.setAttribute('aria-checked', isSelected ? 'true' : 'false')
		const existingRing = child.querySelector('.photo-selection-ring')
		if (isSelected && !existingRing) {
			const ring = document.createElement('div')
			ring.className = 'photo-selection-ring'
			child.appendChild(ring)
		} else if (!isSelected && existingRing) {
			existingRing.remove()
		}
	})

	const preview = document.getElementById('custom-photo-preview')
	if (preview) {
		if (state.customPhotoUrl) {
			preview.innerHTML = `<img src="${state.customPhotoUrl}" alt="Custom photo" class="custom-photo-img" />`
		} else {
			preview.innerHTML = ''
		}
	}
}

function setupCustomPhotoUpload() {
	const fileInput = document.getElementById('photo-file-input')
	if (!fileInput) return

	// Remove existing listeners by cloning
	const newFileInput = fileInput.cloneNode(true)
	fileInput.parentNode.replaceChild(newFileInput, fileInput)

	newFileInput.addEventListener('change', event => {
		const file = event.target.files[0]
		if (!file) return

		if (!file.type.startsWith('image/')) {
			alert('Vennligst velg et bilde.')
			return
		}

		const reader = new FileReader()
		reader.onload = e => {
			state.customPhotoUrl = e.target.result
			state.selectedPhotoId = null
			updatePhotoSelection()
		}
		reader.readAsDataURL(file)
	})
}

// Filter and sort activities
function filterAndSortActivities(activities) {
	let filtered = [...activities]
	
	// Get filter values
	const sortBy = document.getElementById('sort-select')?.value || 'relevant'
	const freeChecked = document.getElementById('filter-free')?.checked ?? true
	const paidChecked = document.getElementById('filter-paid')?.checked ?? true
	const categoryFilters = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value)
	
	// Filter by price (free/paid)
	if (!freeChecked || !paidChecked) {
		filtered = filtered.filter(activity => {
			const isFree = !activity.price || activity.price === 0 || activity.price === '0'
			if (!freeChecked && isFree) return false
			if (!paidChecked && !isFree) return false
			return true
		})
	}
	
	// Filter by category
	if (categoryFilters.length > 0) {
		filtered = filtered.filter(activity => categoryFilters.includes(activity.category))
	}
	
	// Sort activities
	if (sortBy === 'nearest') {
		// Sort by distance (if user location is available)
		if (state.userLocation) {
			filtered.sort((a, b) => {
				const distA = getDistance(state.userLocation, a.coords || [])
				const distB = getDistance(state.userLocation, b.coords || [])
				return distA - distB
			})
		}
	} else if (sortBy === 'trust') {
		// Sort by trustworthiness (rating) - we'll need to fetch ratings
		// For now, sort by number of activities hosted by the host
		filtered.sort((a, b) => {
			const hostAActivities = activities.filter(act => act.host === a.host).length
			const hostBActivities = activities.filter(act => act.host === b.host).length
			return hostBActivities - hostAActivities
		})
	} else {
		// Relevant: sort by date (upcoming first)
		filtered.sort((a, b) => {
			const dateA = new Date(a.date)
			const dateB = new Date(b.date)
			const now = new Date()
			// Upcoming activities first
			if (dateA >= now && dateB < now) return -1
			if (dateA < now && dateB >= now) return 1
			// Then by date
			return dateA - dateB
		})
	}
	
	return filtered
}

// Calculate distance between two coordinates (Haversine formula)
function getDistance(coord1, coord2) {
	if (!coord1 || !coord2 || !coord1[0] || !coord2[0]) return Infinity
	const R = 6371 // Earth's radius in km
	const dLat = (coord2[0] - coord1[0]) * Math.PI / 180
	const dLon = (coord2[1] - coord1[1]) * Math.PI / 180
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

let activeQuickFilters = new Set()
let searchQuery = ''

function getWeeklyActivities(activities) {
	const now = new Date()
	const startOfWeek = new Date(now)
	startOfWeek.setDate(now.getDate() - now.getDay() + 1)
	startOfWeek.setHours(0, 0, 0, 0)
	
	const endOfWeek = new Date(startOfWeek)
	endOfWeek.setDate(startOfWeek.getDate() + 7)
	
	return activities.filter(activity => {
		const activityDate = new Date(activity.date)
		return activityDate >= now && activityDate <= endOfWeek
	}).sort((a, b) => new Date(a.date) - new Date(b.date))
}

async function renderWeeklyActivities() {
	const container = document.getElementById('weekly-activities-list')
	if (!container) return
	
	const weeklyActivities = getWeeklyActivities(state.activities)
	container.innerHTML = ''
	
	if (weeklyActivities.length === 0) {
		container.innerHTML = '<p style="color: var(--muted); font-size: 0.9rem; padding: 1rem;">Ingen aktiviteter denne uken</p>'
		return
	}
	
	for (const activity of weeklyActivities.slice(0, 5)) {
		const card = document.createElement('div')
		card.className = 'weekly-activity-card'
		card.style.cssText = 'min-width: 200px; flex-shrink: 0; background: var(--card); border-radius: 16px; padding: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08); scroll-snap-align: start; cursor: pointer;'
		
		const dateObj = new Date(activity.date)
		const dayName = dateObj.toLocaleDateString('nb-NO', { weekday: 'short' })
		const dayNum = dateObj.getDate()
		const month = dateObj.toLocaleDateString('nb-NO', { month: 'short' })
		
		card.innerHTML = `
			<div style="display: flex; gap: 0.75rem;">
				<div style="text-align: center; background: rgba(72, 199, 142, 0.15); border-radius: 12px; padding: 0.5rem 0.75rem; min-width: 50px;">
					<div style="font-size: 0.7rem; color: var(--green-dark); text-transform: uppercase;">${dayName}</div>
					<div style="font-size: 1.3rem; font-weight: 700; color: var(--green-dark);">${dayNum}</div>
					<div style="font-size: 0.7rem; color: var(--muted);">${month}</div>
				</div>
				<div style="flex: 1; min-width: 0;">
					<h4 style="margin: 0 0 0.25rem; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${activity.name}</h4>
					<p style="margin: 0; font-size: 0.8rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${activity.location}</p>
					<p style="margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--green);">${activity.price > 0 ? activity.price + ' kr' : 'Gratis'}</p>
				</div>
			</div>
		`
		
		card.addEventListener('click', () => showActivityDetail(activity))
		container.appendChild(card)
	}
}

function setupSearchAndFilters() {
	const searchInput = document.getElementById('activity-search-input')
	const quickFilterBtns = document.querySelectorAll('.quick-filter-btn')
	const filterToggleBtn = document.getElementById('filter-toggle-btn')
	const filterContent = document.getElementById('filter-content')
	
	if (searchInput) {
		searchInput.addEventListener('input', (e) => {
			searchQuery = e.target.value.toLowerCase().trim()
			renderDiscover()
		})
	}
	
	quickFilterBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const filter = btn.dataset.filter
			if (activeQuickFilters.has(filter)) {
				activeQuickFilters.delete(filter)
				btn.style.background = 'transparent'
				btn.style.color = 'inherit'
				btn.style.borderColor = 'rgba(72, 199, 142, 0.3)'
			} else {
				activeQuickFilters.add(filter)
				btn.style.background = 'var(--green)'
				btn.style.color = 'white'
				btn.style.borderColor = 'var(--green)'
			}
			renderDiscover()
		})
	})
	
	if (filterToggleBtn && filterContent) {
		filterToggleBtn.addEventListener('click', () => {
			const isHidden = filterContent.style.display === 'none'
			filterContent.style.display = isHidden ? 'block' : 'none'
			filterToggleBtn.textContent = isHidden ? 'Skjul' : 'Vis alle'
		})
	}
	
	const sortSelect = document.getElementById('sort-select')
	const filterFree = document.getElementById('filter-free')
	const filterPaid = document.getElementById('filter-paid')
	
	if (sortSelect) {
		sortSelect.addEventListener('change', () => renderDiscover())
	}
	if (filterFree) {
		filterFree.addEventListener('change', () => renderDiscover())
	}
	if (filterPaid) {
		filterPaid.addEventListener('change', () => renderDiscover())
	}
}

async function renderDiscover() {
	const list = document.getElementById('activity-list')
	if (!list) return
	list.innerHTML = ''
	
	await renderWeeklyActivities()

	if (!state.activities.length) {
		const empty = document.createElement('div')
		empty.className = 'card'
		empty.textContent = 'Ingen aktiviteter funnet ennå.'
		list.appendChild(empty)
		return
	}

	// Filter and sort activities
	let filteredActivities = filterAndSortActivities(state.activities)
	
	// Apply search query
	if (searchQuery) {
		filteredActivities = filteredActivities.filter(activity => 
			activity.name.toLowerCase().includes(searchQuery) ||
			activity.location.toLowerCase().includes(searchQuery) ||
			activity.category.toLowerCase().includes(searchQuery) ||
			activity.host.toLowerCase().includes(searchQuery) ||
			(activity.description && activity.description.toLowerCase().includes(searchQuery))
		)
	}
	
	// Apply quick filters
	if (activeQuickFilters.size > 0) {
		filteredActivities = filteredActivities.filter(activity => {
			if (activeQuickFilters.has('free') && activity.price > 0) return false
			if (activeQuickFilters.has('family') && !activity.tags?.includes('family')) return false
			if (activeQuickFilters.has('children') && !activity.tags?.includes('children')) return false
			return true
		})
	}
	
	if (!filteredActivities.length) {
		const empty = document.createElement('div')
		empty.className = 'card'
		empty.textContent = 'Ingen aktiviteter matcher filteret.'
		list.appendChild(empty)
		return
	}

	// Render activities with ratings
	const renderActivityCard = async (activity) => {
		const card = document.createElement('article')
		card.className = 'activity-card'
		card.style.cursor = 'pointer'

		const thumb = document.createElement('div')
		thumb.className = 'activity-thumb'
		if (activity.customPhotoUrl) {
			thumb.innerHTML = `<img src="${activity.customPhotoUrl}" alt="${activity.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 22px;" />`
		} else {
			const coverSvg = getPhotoSvg(activity.photoId)
			thumb.innerHTML = coverSvg || buildIllustration(activity.name, activity.color)
		}

		const info = document.createElement('div')
		info.className = 'activity-info'

		const title = document.createElement('h3')
		title.textContent = activity.name

		const details = document.createElement('p')
		details.textContent = `${activity.location} • ${formatDateTime(activity.date)}`

		const meta = document.createElement('div')
		meta.className = 'activity-meta'
		const priceText = activity.price > 0 ? `${activity.price} kr` : 'Gratis'
		meta.innerHTML = `<span>${priceText}</span><span>${activity.joined} deltakere</span><span>${activity.host}</span>`

		// Add rating display for activity leaders
		const ratingContainer = document.createElement('div')
		ratingContainer.className = 'activity-rating'
		ratingContainer.style.marginTop = '0.5rem'
		ratingContainer.style.fontSize = '0.85rem'
		
		// Check if host is an activity leader and get rating
		const hostName = activity.host
		const isActivityLeader = state.currentUser && (
			state.currentUser.user_metadata?.user_type === 'activity_leader' ||
			state.currentUser.user_metadata?.user_type === 'partner' ||
			state.currentUser.user_metadata?.user_type === 'admin' ||
			state.activities.filter(a => a.host === hostName).length > 0
		)
		
		if (isActivityLeader) {
			const ratingData = await getActivityLeaderRating(hostName, state.currentUser?.id)
			if (ratingData && ratingData.totalRatings > 0) {
				ratingContainer.innerHTML = `
					<span style="color: var(--green-dark); font-weight: 600;">
						${renderStars(ratingData.averageRating)} ${ratingData.averageRating.toFixed(1)} (${ratingData.totalRatings} vurderinger)
					</span>
				`
			} else {
				ratingContainer.innerHTML = `
					<span style="color: var(--muted); font-size: 0.8rem;">
						Ny aktivitetsleder - ingen vurderinger ennå
					</span>
				`
			}
		}

		info.appendChild(title)
		info.appendChild(details)
		info.appendChild(meta)
		if (ratingContainer.innerHTML) {
			info.appendChild(ratingContainer)
		}

		card.appendChild(thumb)
		card.appendChild(info)
		
		card.addEventListener('click', () => showActivityDetail(activity))
		
		list.appendChild(card)
	}
	
	// Render filtered activities
	for (const activity of filteredActivities) {
		await renderActivityCard(activity)
	}

	switchDiscoverMode(state.discoverMode, { force: true })
	
	// Update map markers with filtered activities
	if (state.discoverMode === 'map') {
		const { refreshAllMarkers } = await import('./map/mapController.js')
		refreshAllMarkers(filteredActivities, state)
	}
}

async function showActivityDetail(activity) {
	const modal = document.getElementById('activity-detail-modal')
	const title = document.getElementById('activity-detail-title')
	const body = document.getElementById('activity-detail-body')
	const closeBtn = document.getElementById('close-activity-modal')
	
	if (!modal || !title || !body) return
	
	title.textContent = activity.name
	
	const dateObj = new Date(activity.date)
	const formattedDate = dateObj.toLocaleDateString('nb-NO', { 
		weekday: 'long', 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	})
	const formattedTime = dateObj.toLocaleTimeString('nb-NO', { 
		hour: '2-digit', 
		minute: '2-digit' 
	})
	
	let ratingHtml = ''
	const ratingData = await getActivityLeaderRating(activity.host, state.currentUser?.id)
	if (ratingData && ratingData.totalRatings > 0) {
		ratingHtml = `
			<div style="margin-top: 0.5rem; color: var(--green-dark);">
				${renderStars(ratingData.averageRating)} ${ratingData.averageRating.toFixed(1)} (${ratingData.totalRatings} vurderinger)
			</div>
		`
	}
	
	const tagsHtml = activity.tags && activity.tags.length > 0 
		? `<div style="margin-top: 1rem;">
			<strong style="font-size: 0.9rem; color: var(--muted);">Aktivitetstype:</strong>
			<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
				${activity.tags.map(tag => `<span style="background: rgba(72, 199, 142, 0.15); color: var(--green-dark); padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.8rem;">${getTagLabel(tag)}</span>`).join('')}
			</div>
		</div>` 
		: ''
	
	body.innerHTML = `
		<div style="margin-bottom: 1rem;">
			${activity.customPhotoUrl 
				? `<img src="${activity.customPhotoUrl}" alt="${activity.name}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 12px;" />`
				: `<div style="width: 100%; height: 120px; background: rgba(72, 199, 142, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center;">${getPhotoSvg(activity.photoId) || ''}</div>`
			}
		</div>
		
		<div style="display: grid; gap: 0.75rem;">
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">📍</span>
				<span>${activity.location}</span>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">📅</span>
				<span>${formattedDate}</span>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">🕐</span>
				<span>${formattedTime}</span>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">💰</span>
				<span>${activity.price > 0 ? activity.price + ' kr' : 'Gratis'}</span>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">👥</span>
				<span>${activity.joined} deltakere</span>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<span style="font-size: 1.2rem;">👤</span>
				<span>Arrangør: ${activity.host}</span>
				${ratingHtml}
			</div>
		</div>
		
		${tagsHtml}
		
		${activity.description ? `
			<div style="margin-top: 1rem;">
				<strong style="font-size: 0.9rem; color: var(--muted);">Beskrivelse:</strong>
				<p style="margin: 0.5rem 0 0; line-height: 1.5;">${activity.description}</p>
			</div>
		` : ''}
		
		<button class="primary-btn" style="width: 100%; margin-top: 1.5rem;" onclick="alert('Påmelding kommer snart!')">
			Meld deg på
		</button>
	`
	
	modal.style.display = 'flex'
	
	const closeModal = () => {
		modal.style.display = 'none'
	}
	
	closeBtn.onclick = closeModal
	modal.onclick = (e) => {
		if (e.target === modal) closeModal()
	}
}

function getTagLabel(tag) {
	const labels = {
		'free': 'Gratis',
		'family': 'Familieaktivitet',
		'children': 'Barneaktivitet',
		'outdoor': 'Utendørs',
		'indoor': 'Innendørs',
		'weekend': 'Helg',
		'evening': 'Kveld'
	}
	return labels[tag] || tag
}

function setupDiscoverToggle() {
	const listBtn = document.getElementById('discover-list-btn')
	const mapBtn = document.getElementById('discover-map-btn')
	if (!listBtn || !mapBtn) return

	listBtn.addEventListener('click', () => switchDiscoverMode('list'))
	mapBtn.addEventListener('click', () => switchDiscoverMode('map'))

	switchDiscoverMode(state.discoverMode, { force: true })
}

function switchDiscoverMode(mode, { force = false } = {}) {
	if (!force && state.discoverMode === mode) return
	state.discoverMode = mode

	const list = document.getElementById('activity-list')
	const mapPanel = document.getElementById('map-panel')
	const listBtn = document.getElementById('discover-list-btn')
	const mapBtn = document.getElementById('discover-map-btn')

	if (mode === 'map') {
		list?.classList.add('hidden')
		mapPanel?.classList.remove('hidden')
		listBtn?.classList.remove('active')
		mapBtn?.classList.add('active')
		// Use requestAnimationFrame to ensure DOM is updated before map init
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				ensureMap(state)
			})
		})
	} else {
		list?.classList.remove('hidden')
		mapPanel?.classList.add('hidden')
		listBtn?.classList.add('active')
		mapBtn?.classList.remove('active')
	}
}

function buildIllustration(title, accent) {
	const initials = title
		.split(' ')
		.slice(0, 2)
		.map(word => word[0])
		.join('')
	const uniqueId = `${initials}-${Math.random().toString(36).substr(2, 9)}`
	return `
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="50%" stop-color="${accent}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.6" />
        </linearGradient>
        <filter id="shadow-${uniqueId}">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="80" height="80" rx="22" fill="url(#grad-${uniqueId})" filter="url(#shadow-${uniqueId})" />
      <circle cx="24" cy="26" r="10" fill="rgba(255,255,255,0.85)" />
      <path d="M16 60 Q40 38 64 56" stroke="rgba(255,255,255,0.9)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="40" y="70" text-anchor="middle" font-size="18" fill="#1f2a35" font-weight="700" opacity="0.9">${initials}</text>
    </svg>
  `
}

function setupNavigation() {
	const buttons = Array.from(document.querySelectorAll('.nav-btn'))
	state.navButtons = buttons

	buttons.forEach(btn => {
		btn.addEventListener('click', () => {
			setActiveView(btn.dataset.target, btn)
		})
	})

	setActiveView('page-discover')

	const logoButton = document.getElementById('logo-button')
	if (logoButton) {
		logoButton.addEventListener('click', () => setActiveView('page-discover'))
	}
}

function setActiveView(targetId, button) {
	// Hide profile avatar on Create page
	const profileAvatarBtn = document.getElementById('profile-avatar-btn')
	const adminBtn = document.getElementById('admin-btn')
	
	if (targetId === 'page-create') {
		if (profileAvatarBtn) profileAvatarBtn.style.display = 'none'
	} else {
		if (profileAvatarBtn && state.currentUser) profileAvatarBtn.style.display = 'block'
	}
	
	// Show admin button and notifications on all pages except Create
	const notificationsBtn = document.getElementById('notifications-btn')
	if (targetId === 'page-create') {
		if (adminBtn) adminBtn.style.display = 'none'
		if (notificationsBtn) notificationsBtn.style.display = 'none'
	} else {
		if (adminBtn && isAdmin(state.currentUser)) adminBtn.style.display = 'block'
		if (notificationsBtn && state.currentUser) notificationsBtn.style.display = 'flex'
	}
	
	const views = document.querySelectorAll('.view')

	state.navButtons.forEach(b => b.classList.remove('active'))
	if (button) {
		button.classList.add('active')
	} else {
		const navButton = state.navButtons.find(b => b.dataset.target === targetId)
		navButton?.classList.add('active')
	}

	views.forEach(view => {
		view.classList.toggle('active', view.id === targetId)
	})

	if (targetId === 'page-discover') {
		switchDiscoverMode(state.discoverMode, { force: true })
	} else if (targetId === 'page-activities') {
		renderActivities()
	} else if (targetId === 'page-profile') {
		renderProfile()
	} else if (targetId === 'page-create') {
		// Invalidate map size when Create page becomes active
		// This fixes the issue where map shows gray areas
		setTimeout(() => {
			const mapElement = document.getElementById('location-map')
			if (mapElement && window.locationMap) {
				window.locationMap.invalidateSize()
			}
			// Also try multiple times to ensure it works
			setTimeout(() => {
				if (window.locationMap) {
					window.locationMap.invalidateSize()
				}
			}, 200)
			setTimeout(() => {
				if (window.locationMap) {
					window.locationMap.invalidateSize()
				}
			}, 500)
		}, 50)
	}
}

// Helper function to check if an element is part of the map
function isMapElement(element) {
	if (!element) return false
	return element.closest('#location-map') !== null ||
		   element.closest('.leaflet-container') !== null ||
		   element.closest('.leaflet-control') !== null ||
		   element.closest('.leaflet-interactive') !== null ||
		   element.closest('.leaflet-pane') !== null ||
		   element.closest('#location-map-container') !== null ||
		   element.classList.contains('leaflet-container') ||
		   element.classList.contains('leaflet-control') ||
		   element.classList.contains('leaflet-interactive') ||
		   element.id === 'location-map' ||
		   element.id === 'location-map-container'
}

// Function to place activity marker on map (ensures only one marker exists)
function placeActivityMarker(mapInstance, coords) {
	if (!mapInstance) return null
	
	// Remove existing marker if it exists
	if (window.currentActivityMarker) {
		mapInstance.removeLayer(window.currentActivityMarker)
	}
	
	// Create new marker
	const marker = L.marker(coords, { draggable: true }).addTo(mapInstance)
	window.currentActivityMarker = marker
	
	return marker
}

function setupCreateForm() {
	const form = document.getElementById('create-form')
	if (!form) return

	// Setup location inputs - both address and map are always visible
	const locationAddressInput = document.getElementById('location-address')
	const locationMapContainer = document.getElementById('location-map-container')
	let locationMap = null
	let locationMarker = null
	let selectedCoords = null
	
	// Store map reference globally so setActiveView can access it
	window.locationMap = null
	
	// Initialize map when form loads (map is always visible now)
	function initializeMap() {
		if (locationMap) return // Already initialized
		
		requestAnimationFrame(() => {
			import('leaflet').then(L => {
				const mapElement = document.getElementById('location-map')
				if (!mapElement) return
				
				const defaultCoords = state.userLocation || [59.43, 10.68]
				
				// Initialize map
				locationMap = L.map('location-map', {
					dragging: true,
					touchZoom: true,
					doubleClickZoom: true,
					scrollWheelZoom: true,
					boxZoom: true,
					keyboard: true,
					zoomControl: true,
					preferCanvas: false
				}).setView(defaultCoords, 13)
				
				// Store reference globally
				window.locationMap = locationMap
				
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
					maxZoom: 19,
					detectRetina: true
				}).addTo(locationMap)
				
				// Place initial marker
				locationMarker = placeActivityMarker(locationMap, defaultCoords)
				selectedCoords = defaultCoords
				
				// Handle marker drag
				locationMarker.on('dragend', (e) => {
					selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
				})
				
				// Handle map clicks - place marker at click position
				locationMap.on('click', (e) => {
					const { lat, lng } = e.latlng
					const coords = [lat, lng]
					
					// Place marker using our function (ensures only one marker)
					locationMarker = placeActivityMarker(locationMap, coords)
					selectedCoords = coords
					
					// Re-attach drag handler
					locationMarker.on('dragend', (e) => {
						selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
					})
				})
				
				// CRITICAL: Prevent events from bubbling to document level
				L.DomEvent.disableClickPropagation(mapElement)
				L.DomEvent.disableScrollPropagation(mapElement)
				
				// Stop bubbling on container
				if (locationMapContainer) {
					locationMapContainer.addEventListener('click', (e) => {
						if (isMapElement(e.target) || e.target === locationMapContainer) {
							setTimeout(() => {
								e.stopPropagation()
							}, 10)
						}
					}, false)
					
					locationMapContainer.style.pointerEvents = 'auto'
					locationMapContainer.style.zIndex = '1'
				}
				
				// Ensure map element has proper pointer events
				mapElement.style.pointerEvents = 'auto'
				mapElement.style.zIndex = '1'
				
				// Invalidate size multiple times to ensure proper rendering
				// This fixes the issue where map shows gray areas
				const invalidateSize = () => {
					if (locationMap) {
						locationMap.invalidateSize()
					}
				}
				
				// Invalidate immediately and after delays
				setTimeout(invalidateSize, 50)
				setTimeout(invalidateSize, 150)
				setTimeout(invalidateSize, 300)
				setTimeout(invalidateSize, 500)
				
				// Also invalidate when page becomes visible
				document.addEventListener('visibilitychange', () => {
					if (!document.hidden && locationMap) {
						setTimeout(invalidateSize, 100)
					}
				})
				
				// Invalidate when window is resized
				window.addEventListener('resize', () => {
					if (locationMap) {
						setTimeout(invalidateSize, 100)
					}
				})
			})
		})
	}
	
	// Initialize map immediately
	initializeMap()
	
	// Setup tag checkbox styling
	const tagCheckboxes = document.querySelectorAll('.tag-checkbox')
	tagCheckboxes.forEach(label => {
		const checkbox = label.querySelector('input[type="checkbox"]')
		if (checkbox) {
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					label.style.background = 'var(--green)'
					label.style.color = 'white'
					label.style.borderColor = 'var(--green)'
				} else {
					label.style.background = 'transparent'
					label.style.color = 'inherit'
					label.style.borderColor = 'rgba(72, 199, 142, 0.3)'
				}
			})
		}
	})
	
	// Function to geocode address and place pin on map
	async function geocodeAddress(address) {
		if (!address || !address.trim()) return null
		
		try {
			// Use Nominatim (OpenStreetMap geocoding service)
			const response = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
				{
					headers: {
						'User-Agent': 'ActivityFinder App'
					}
				}
			)
			
			const data = await response.json()
			if (data && data.length > 0) {
				const lat = parseFloat(data[0].lat)
				const lon = parseFloat(data[0].lon)
				return [lat, lon]
			}
		} catch (error) {
			console.error('Geocoding error:', error)
		}
		
		return null
	}
	
	// When address is entered, geocode and update map marker
	if (locationAddressInput) {
		let geocodeTimeout = null
		locationAddressInput.addEventListener('input', async (e) => {
			const address = e.target.value.trim()
			
			// Clear previous timeout
			if (geocodeTimeout) {
				clearTimeout(geocodeTimeout)
			}
			
			// Wait for user to stop typing (debounce)
			geocodeTimeout = setTimeout(async () => {
				if (address) {
					const coords = await geocodeAddress(address)
					if (coords && locationMap) {
						// Update marker position
						locationMarker = placeActivityMarker(locationMap, coords)
						locationMarker.on('dragend', (e) => {
							selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
						})
						locationMap.setView(coords, 15)
						selectedCoords = coords
					}
				}
			}, 1000) // Wait 1 second after user stops typing
		})
	}

	form.addEventListener('submit', async (event) => {
		event.preventDefault()

		const formData = new FormData(form)
		const name = formData.get('name')
		const place = formData.get('place')
		const address = formData.get('address') || ''
		const location = place ? `${place}${address ? ', ' + address : ''}` : address
		const date = formData.get('date')
		const category = formData.get('category')
		const description = formData.get('description') || ''
		const price = parseFloat(formData.get('price')) || 0

		// Validate all required fields
		if (!name || !name.trim()) {
			alert('Vennligst fyll inn navn på aktivitet.')
			return
		}
		
		if (!date) {
			alert('Vennligst fyll inn dato og tid.')
			return
		}
		
		if (!category) {
			alert('Vennligst velg en kategori.')
			return
		}
		
		if (!description || !description.trim()) {
			alert('Vennligst fyll inn beskrivelse.')
			return
		}
		
		if (!place || !place.trim()) {
			alert('Vennligst fyll inn sted.')
			return
		}
		
		// Validation: Either address OR pin must be filled, not both required
		const hasAddress = address && address.trim() && address !== 'Plassert på kart'
		const hasPin = selectedCoords && selectedCoords.length === 2
		
		if (!hasAddress && !hasPin) {
			alert('Vennligst fyll inn adresse eller plasser en pin på kartet.')
			return
		}
		
		// If address is filled but no coords, try to geocode
		let coords = null
		if (hasAddress && !hasPin) {
			coords = await geocodeAddress(address)
			if (!coords) {
				alert('Kunne ikke finne adressen. Vennligst plasser en pin på kartet i stedet.')
				return
			}
		} else if (hasPin) {
			coords = selectedCoords
		} else {
			// Fallback to user location
			coords = state.userLocation || [59.43, 10.68]
		}

		const photoId = state.customPhotoUrl ? null : (state.selectedPhotoId || photoLibrary[0]?.id)
		const accentColor = photoId ? getPhotoAccent(photoId) : '#48C78E'

		const hostName = state.currentUser?.user_metadata?.name || state.currentUser?.email?.split('@')[0] || userProfile.name

		// Collect selected tags
		const selectedTags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value)
		
		// Auto-add 'free' tag if price is 0
		if (price === 0 && !selectedTags.includes('free')) {
			selectedTags.push('free')
		}

		const activityData = {
			name,
			location,
			date,
			category,
			host: hostName,
			description,
			joined: 1,
			coords,
			color: accentColor,
			photoId: photoId || 'custom',
			customPhotoUrl: state.customPhotoUrl || null,
			price: price,
			tags: selectedTags
		}

		const editId = form.dataset.editId
		let savedActivity

		if (editId) {
			// Update existing activity
			const existingIndex = state.activities.findIndex(a => a.id === editId)
			if (existingIndex >= 0 && state.activities[existingIndex].host === hostName) {
				savedActivity = { ...state.activities[existingIndex], ...activityData }
				state.activities[existingIndex] = savedActivity
				delete form.dataset.editId
			} else {
				alert('Du kan bare redigere dine egne aktiviteter.')
				return
			}
		} else {
			// Create new activity
			savedActivity = await createActivity(activityData)
			state.activities = [savedActivity, ...state.activities]
			userProfile.hosted += 1
			// Award points for hosting activity
			state.userPoints = (state.userPoints || 0) + 20
			updateUserPoints()
		}

		await renderDiscover()
		renderActivities()
		renderProfile()
		const mapInstance = getMapInstance()
		if (mapInstance) {
			refreshAllMarkers(state.activities, state)
		}

		// Reset form
		form.reset()
		state.selectedPhotoId = photoLibrary[0]?.id || null
		state.customPhotoUrl = null
		renderPhotoLibrary()
		
		// Reset location map
		if (locationMap) {
			locationMap.remove()
			locationMap = null
			locationMarker = null
			selectedCoords = null
		}

		// Navigate to "Mine Aktiviteter" after creating (not editing)
		if (!editId) {
			setActiveView('page-activities')
		} else {
			setActiveView('page-activities')
		}
		trackEvent(editId ? 'activity_updated' : 'activity_created', { category, name })
	})
}

function renderActivities() {
	const container = document.getElementById('my-activities-list')
	if (!container) return

	const now = new Date()
	const userActivities = state.activities.filter(
		activity => activity.host === (state.currentUser?.user_metadata?.name || userProfile.name)
	)

	const upcoming = userActivities.filter(activity => new Date(activity.date) >= now)
	const past = userActivities.filter(activity => new Date(activity.date) < now)

	let activitiesToShow
	if (state.activitiesViewMode === 'all') {
		activitiesToShow = userActivities
	} else if (state.activitiesViewMode === 'past') {
		activitiesToShow = past
	} else {
		activitiesToShow = upcoming
	}

	container.innerHTML = ''

	if (activitiesToShow.length === 0) {
		const empty = document.createElement('div')
		empty.className = 'card'
		if (state.activitiesViewMode === 'all') {
			empty.textContent = 'Ingen aktiviteter ennå.'
		} else if (state.activitiesViewMode === 'past') {
			empty.textContent = 'Ingen tidligere aktiviteter ennå.'
		} else {
			empty.textContent = 'Ingen kommende aktiviteter ennå.'
		}
		container.appendChild(empty)
		return
	}

	activitiesToShow.forEach(activity => {
		const card = document.createElement('article')
		card.className = 'activity-card'

		const thumb = document.createElement('div')
		thumb.className = 'activity-thumb'
		const coverSvg = getPhotoSvg(activity.photoId)
		if (activity.customPhotoUrl) {
			thumb.innerHTML = `<img src="${activity.customPhotoUrl}" alt="${activity.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 22px;" />`
		} else {
			const coverSvg = getPhotoSvg(activity.photoId)
			thumb.innerHTML = coverSvg || buildIllustration(activity.name, activity.color)
		}

		const info = document.createElement('div')
		info.className = 'activity-info'

		const title = document.createElement('h3')
		title.textContent = activity.name

		const details = document.createElement('p')
		details.textContent = `${activity.location} • ${formatDateTime(activity.date)}`

		const meta = document.createElement('div')
		meta.className = 'activity-meta'
		meta.innerHTML = `<span>${activity.category}</span><span>${activity.joined} joined</span><span>Host: ${activity.host}</span>`

		const actions = document.createElement('div')
		actions.className = 'activity-actions'
		const editBtn = document.createElement('button')
		editBtn.className = 'ghost-btn small'
		editBtn.textContent = 'Rediger'
		editBtn.addEventListener('click', () => editActivity(activity))
		actions.appendChild(editBtn)

		info.appendChild(title)
		info.appendChild(details)
		info.appendChild(meta)
		info.appendChild(actions)

		card.appendChild(thumb)
		card.appendChild(info)
		container.appendChild(card)
	})
}

function editActivity(activity) {
	setActiveView('page-create')
	const form = document.getElementById('create-form')
	if (!form) return

	form.querySelector('input[name="name"]').value = activity.name || ''
	
	// Parse location into place and address
	const locationParts = activity.location ? activity.location.split(',').map(s => s.trim()) : []
	if (locationParts.length >= 2) {
		form.querySelector('input[name="place"]').value = locationParts[0] || ''
		form.querySelector('input[name="address"]').value = locationParts.slice(1).join(', ') || ''
	} else if (locationParts.length === 1) {
		form.querySelector('input[name="place"]').value = locationParts[0] || ''
		form.querySelector('input[name="address"]').value = ''
	} else {
		form.querySelector('input[name="place"]').value = ''
		form.querySelector('input[name="address"]').value = ''
	}
	
	form.querySelector('input[name="date"]').value = activity.date || ''
	form.querySelector('select[name="category"]').value = activity.category || ''
	form.querySelector('textarea[name="description"]').value = activity.description || ''
	const priceInput = form.querySelector('input[name="price"]')
	if (priceInput) {
		priceInput.value = activity.price || 0
	}
	state.selectedPhotoId = activity.photoId || photoLibrary[0]?.id
	state.customPhotoUrl = activity.customPhotoUrl || null
	renderPhotoLibrary()
	
		// Set location based on coords
		if (activity.coords && activity.coords.length === 2) {
			// Has coordinates, update map marker
			selectedCoords = activity.coords
			const locationMapContainer = document.getElementById('location-map-container')
			if (locationMapContainer) {
				// Initialize map if needed
				if (!locationMap) {
					import('leaflet').then(L => {
					locationMap = L.map('location-map', {
						dragging: true,
						touchZoom: true,
						doubleClickZoom: true,
						scrollWheelZoom: true,
						boxZoom: true,
						keyboard: true,
						zoomControl: true
					}).setView(activity.coords, 13)
					
					L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
						attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
						maxZoom: 19
					}).addTo(locationMap)
					
					// Place marker using our function
					locationMarker = placeActivityMarker(locationMap, activity.coords)
					selectedCoords = activity.coords
					
					// Handle marker drag
					locationMarker.on('dragend', (e) => {
						selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
					})
					
					// Handle map clicks
					locationMap.on('click', (e) => {
						const { lat, lng } = e.latlng
						const coords = [lat, lng]
						
						// Place marker using our function (ensures only one marker)
						locationMarker = placeActivityMarker(locationMap, coords)
						selectedCoords = coords
						
						// Re-attach drag handler
						locationMarker.on('dragend', (e) => {
							selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
						})
					})
					
					// Store reference globally
					window.locationMap = locationMap
					
					const mapElement = document.getElementById('location-map')
					if (mapElement) {
						// CRITICAL: Prevent events from bubbling to document level
						L.DomEvent.disableClickPropagation(mapElement)
						L.DomEvent.disableScrollPropagation(mapElement)
						
						mapElement.style.pointerEvents = 'auto'
						mapElement.style.zIndex = '1'
					}
					
					const locationMapContainer = document.getElementById('location-map-container')
					if (locationMapContainer) {
						locationMapContainer.addEventListener('click', (e) => {
							if (isMapElement(e.target) || e.target === locationMapContainer) {
								setTimeout(() => {
									e.stopPropagation()
								}, 10)
							}
						}, false)
						
						locationMapContainer.style.pointerEvents = 'auto'
						locationMapContainer.style.zIndex = '1'
					}
					
					// Invalidate size multiple times
					const invalidateSize = () => {
						if (locationMap) {
							locationMap.invalidateSize()
						}
					}
					
					setTimeout(invalidateSize, 50)
					setTimeout(invalidateSize, 150)
					setTimeout(invalidateSize, 300)
					setTimeout(invalidateSize, 500)
				})
			} else {
				locationMap.setView(activity.coords, 13)
				// Update marker using our function
				locationMarker = placeActivityMarker(locationMap, activity.coords)
				locationMarker.on('dragend', (e) => {
					selectedCoords = [e.target.getLatLng().lat, e.target.getLatLng().lng]
				})
				selectedCoords = activity.coords
				requestAnimationFrame(() => {
					if (locationMap) locationMap.invalidateSize()
				})
			}
		}
	}

	form.dataset.editId = activity.id
}

function setupActivitiesToggle() {
	const allBtn = document.getElementById('activities-all-btn')
	const upcomingBtn = document.getElementById('activities-upcoming-btn')
	const pastBtn = document.getElementById('activities-past-btn')
	if (!allBtn || !upcomingBtn || !pastBtn) return

	state.activitiesViewMode = 'upcoming'

	const setActive = (mode, activeBtn) => {
		state.activitiesViewMode = mode
		;[allBtn, upcomingBtn, pastBtn].forEach(btn => btn.classList.remove('active'))
		activeBtn.classList.add('active')
		renderActivities()
	}

	allBtn.addEventListener('click', () => setActive('all', allBtn))
	upcomingBtn.addEventListener('click', () => setActive('upcoming', upcomingBtn))
	pastBtn.addEventListener('click', () => setActive('past', pastBtn))
}

function renderProfile() {
	const user = state.currentUser
	const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || userProfile.name
	const profileBio = user?.user_metadata?.bio || userProfile.bio || 'Hei, jeg er ny her! :)'
	const profileEmail = user?.email || ''

	const nameEl = document.getElementById('profile-name')
	const bioEl = document.getElementById('profile-bio')
	const emailEl = document.getElementById('profile-email')
	const editBioBtn = document.getElementById('edit-bio-btn')
	const changeAvatarBtn = document.getElementById('change-avatar-btn')
	const settingsBtn = document.getElementById('settings-btn')
	const authActions = document.getElementById('auth-actions')
	const settingsSignOutBtn = document.getElementById('settings-signout-btn')
	const deleteAccountBtn = document.getElementById('delete-account-btn')

	if (nameEl) nameEl.textContent = profileName
	if (bioEl) bioEl.textContent = profileBio
	if (emailEl) {
		emailEl.textContent = profileEmail
		const showEmail = user?.user_metadata?.show_email !== false
		emailEl.style.display = (profileEmail && showEmail) ? 'block' : 'none'
	}

	// Show/hide edit buttons based on login status
	if (user) {
		if (editBioBtn) editBioBtn.style.display = 'inline-block'
		if (changeAvatarBtn) changeAvatarBtn.style.display = 'block'
		if (settingsBtn) settingsBtn.style.display = 'block'
		if (authActions) authActions.style.display = 'none'
		if (settingsSignOutBtn) settingsSignOutBtn.style.display = 'block'
		if (deleteAccountBtn) deleteAccountBtn.style.display = 'block'
	} else {
		if (editBioBtn) editBioBtn.style.display = 'none'
		if (changeAvatarBtn) changeAvatarBtn.style.display = 'none'
		if (settingsBtn) settingsBtn.style.display = 'none'
		if (authActions) authActions.style.display = 'block'
		if (settingsSignOutBtn) settingsSignOutBtn.style.display = 'none'
		if (deleteAccountBtn) deleteAccountBtn.style.display = 'none'
	}

	// Update avatar
	const avatarImg = document.getElementById('profile-avatar-img')
	const avatarSvg = document.querySelector('#profile-avatar-display svg')
	if (user?.user_metadata?.avatar_url) {
		if (avatarImg) {
			avatarImg.src = user.user_metadata.avatar_url
			avatarImg.style.display = 'block'
		}
		if (avatarSvg) avatarSvg.style.display = 'none'
	} else if (user?.user_metadata?.picture) {
		if (avatarImg) {
			avatarImg.src = user.user_metadata.picture
			avatarImg.style.display = 'block'
		}
		if (avatarSvg) avatarSvg.style.display = 'none'
	} else {
		if (avatarImg) avatarImg.style.display = 'none'
		if (avatarSvg) avatarSvg.style.display = 'block'
	}
	
	// Update user type badge
	const userTypeBadge = document.getElementById('user-type-badge')
	if (userTypeBadge && user) {
		const userType = getUserType(user)
		if (userType === 'admin') {
			userTypeBadge.textContent = 'A'
			userTypeBadge.style.background = '#E74C3C'
			userTypeBadge.style.display = 'flex'
			userTypeBadge.title = 'Administrator'
		} else if (userType === 'activity_leader') {
			userTypeBadge.textContent = 'L'
			userTypeBadge.style.background = '#3498DB'
			userTypeBadge.style.display = 'flex'
			userTypeBadge.title = 'Aktivitetsleder'
		} else if (userType === 'partner') {
			userTypeBadge.textContent = 'P'
			userTypeBadge.style.background = '#9B59B6'
			userTypeBadge.style.display = 'flex'
			userTypeBadge.title = 'Partner'
		} else {
			userTypeBadge.style.display = 'none'
		}
	}
	
	// Also update header avatar badge
	updateHeaderAvatarBadge(user)

	// Calculate stats from actual activities
	const userActivities = state.activities.filter(
		activity => activity.host === profileName
	)
	const hostedCount = userActivities.length
	const pointsEl = document.getElementById('profile-points')
	const joinedEl = document.getElementById('profile-joined')
	const hostedEl = document.getElementById('profile-hosted')
	if (pointsEl) pointsEl.textContent = state.userPoints || 0
	if (joinedEl) joinedEl.textContent = '0' // TODO: Get from database
	if (hostedEl) hostedEl.textContent = hostedCount

	updateHeaderAvatar()
	renderProfileActivities(profileName)
	checkAndRenderBadges(user)
}

function renderProfileActivities(hostName) {
	const container = document.getElementById('profile-activities-list')
	if (!container) return

	const userActivities = state.activities.filter(activity => activity.host === hostName)
	const now = new Date()
	const upcoming = userActivities.filter(activity => new Date(activity.date) >= now)
	const past = userActivities.filter(activity => new Date(activity.date) < now)

	// Get current tab state
	const upcomingTab = document.getElementById('profile-upcoming-tab')
	const pastTab = document.getElementById('profile-past-tab')
	const isUpcomingActive = !pastTab?.classList.contains('active')

	container.innerHTML = ''

	let activitiesToShow = isUpcomingActive ? upcoming : past
	const title = isUpcomingActive ? 'Kommende Aktiviteter' : 'Tidligere Aktiviteter'

	if (activitiesToShow.length === 0) {
		const empty = document.createElement('div')
		empty.className = 'card'
		empty.textContent = isUpcomingActive ? 'Ingen kommende aktiviteter.' : 'Ingen tidligere aktiviteter.'
		container.appendChild(empty)
	} else {
		activitiesToShow.forEach(activity => {
			const card = createActivityCard(activity)
			container.appendChild(card)
		})
	}

	// Setup tab switching
	if (upcomingTab && pastTab) {
		upcomingTab.addEventListener('click', () => {
			upcomingTab.classList.add('active')
			pastTab.classList.remove('active')
			renderProfileActivities(hostName)
		})

		pastTab.addEventListener('click', () => {
			pastTab.classList.add('active')
			upcomingTab.classList.remove('active')
			renderProfileActivities(hostName)
		})
	}
}

function createActivityCard(activity) {
	const card = document.createElement('article')
	card.className = 'activity-card'

	const thumb = document.createElement('div')
	thumb.className = 'activity-thumb'
	const coverSvg = getPhotoSvg(activity.photoId)
	thumb.innerHTML = coverSvg || buildIllustration(activity.name, activity.color)

	const info = document.createElement('div')
	info.className = 'activity-info'

	const title = document.createElement('h3')
	title.textContent = activity.name

	const details = document.createElement('p')
	details.textContent = `${activity.location} • ${formatDateTime(activity.date)}`

	const meta = document.createElement('div')
	meta.className = 'activity-meta'
	meta.innerHTML = `<span>${activity.category}</span><span>${activity.joined} joined</span>`

	info.appendChild(title)
	info.appendChild(details)
	info.appendChild(meta)

	card.appendChild(thumb)
	card.appendChild(info)
	return card
}

function setupForumComposer() {
	const form = document.getElementById('forum-post-form')
	if (!form) return

	const imageInput = document.getElementById('forum-image-input')
	const imagePreview = document.getElementById('forum-image-preview')
	let selectedImages = []
	
	if (imageInput) {
		imageInput.addEventListener('change', (e) => {
			const files = Array.from(e.target.files)
			files.forEach(file => {
				if (file.type.startsWith('image/')) {
					const reader = new FileReader()
					reader.onload = (event) => {
						selectedImages.push({
							file: file,
							url: event.target.result
						})
						updateImagePreview()
					}
					reader.readAsDataURL(file)
				}
			})
		})
	}
	
	function updateImagePreview() {
		if (!imagePreview) return
		imagePreview.innerHTML = ''
		selectedImages.forEach((img, index) => {
			const wrapper = document.createElement('div')
			wrapper.className = 'image-wrapper'
			wrapper.style.position = 'relative'
			wrapper.style.display = 'inline-block'
			wrapper.style.margin = '0.5rem'
			
			const imgEl = document.createElement('img')
			imgEl.src = img.url
			imgEl.style.maxWidth = '150px'
			imgEl.style.maxHeight = '150px'
			imgEl.style.borderRadius = '8px'
			imgEl.style.objectFit = 'cover'
			
			const removeBtn = document.createElement('button')
			removeBtn.className = 'remove-image'
			removeBtn.textContent = '×'
			removeBtn.onclick = () => {
				selectedImages.splice(index, 1)
				updateImagePreview()
			}
			
			wrapper.appendChild(imgEl)
			wrapper.appendChild(removeBtn)
			imagePreview.appendChild(wrapper)
		})
	}

	form.addEventListener('submit', async event => {
		event.preventDefault()
		const textarea = form.querySelector('textarea[name="post"]')
		const content = textarea.value.trim()
		if (!content && selectedImages.length === 0) return

		const newPost = await createForumPost(content, userProfile, selectedImages.map(img => img.url), state.currentUser?.id)
		state.forumPosts = [newPost, ...state.forumPosts]
		renderForum()
		trackEvent('forum_post_created', { length: content.length, hasImages: selectedImages.length > 0 })
		textarea.value = ''
		selectedImages = []
		updateImagePreview()
		if (imageInput) imageInput.value = ''
		
		// Check for forum post badge
		if (state.currentUser) {
			checkAndRenderBadges(state.currentUser)
		}
	})
}

function renderForum() {
	const feed = document.getElementById('forum-feed')
	if (!feed) return

	feed.innerHTML = ''

	if (state.forumPosts.length === 0) {
		const empty = document.createElement('div')
		empty.className = 'forum-empty card'
		empty.textContent = 'Ingen poster ennå. Start samtalen!'
		feed.appendChild(empty)
		return
	}

	state.forumPosts.forEach(post => {
		const card = document.createElement('article')
		card.className = 'forum-post card'

		const header = document.createElement('div')
		header.className = 'forum-post-header'

		const avatar = document.createElement('div')
		avatar.className = 'forum-avatar'
		
		// Try to get user's profile picture
		const postAuthor = post.author
		const postUserId = post.user_id
		let avatarUrl = null
		
		// Check if post author matches current user
		if (state.currentUser && (state.currentUser.user_metadata?.name === postAuthor || state.currentUser.email?.split('@')[0] === postAuthor)) {
			avatarUrl = state.currentUser.user_metadata?.avatar_url || state.currentUser.user_metadata?.picture
		}
		
		// If no avatar URL, show initials
		if (avatarUrl) {
			const avatarImg = document.createElement('img')
			avatarImg.src = avatarUrl
			avatarImg.alt = postAuthor
			avatarImg.style.width = '100%'
			avatarImg.style.height = '100%'
			avatarImg.style.borderRadius = '50%'
			avatarImg.style.objectFit = 'cover'
			avatar.appendChild(avatarImg)
		} else {
			avatar.textContent = getInitials(post.author)
		}

		const meta = document.createElement('div')
		meta.className = 'forum-meta'
		meta.innerHTML = `<strong>${post.author}</strong><span>${post.context}</span><span>${formatRelativeTime(
			post.createdAt
		)}</span>`

		header.appendChild(avatar)
		header.appendChild(meta)

		const body = document.createElement('p')
		body.className = 'forum-body'
		body.textContent = post.content

		// Add images if present
		if (post.images && post.images.length > 0) {
			const imagesContainer = document.createElement('div')
			imagesContainer.className = 'forum-post-images'
			post.images.forEach(imgUrl => {
				const img = document.createElement('img')
				img.src = imgUrl
				img.className = 'forum-post-image'
				img.alt = 'Forum bilde'
				imagesContainer.appendChild(img)
			})
			card.appendChild(header)
			card.appendChild(body)
			card.appendChild(imagesContainer)
		} else {
			card.appendChild(header)
			card.appendChild(body)
		}

		const actions = document.createElement('div')
		actions.className = 'forum-actions'

		const likeBtn = document.createElement('button')
		likeBtn.type = 'button'
		likeBtn.className = 'forum-like-btn'
		likeBtn.innerHTML = `❤️ <span>${post.likes}</span>`
		if (state.forumLikes.has(post.id)) {
			likeBtn.classList.add('liked')
		}
		likeBtn.addEventListener('click', () => handleForumLike(post.id))

		const commentBadge = document.createElement('span')
		commentBadge.className = 'forum-comment-count'
		commentBadge.textContent = `${post.comments.length} kommentarer`

		actions.appendChild(likeBtn)
		actions.appendChild(commentBadge)

		const commentList = document.createElement('ul')
		commentList.className = 'comment-list'
		post.comments.forEach(comment => {
			const li = document.createElement('li')
			li.innerHTML = `<strong>${comment.author}</strong><span>${comment.text}</span>`
			commentList.appendChild(li)
		})

		const commentForm = document.createElement('form')
		commentForm.className = 'comment-form'
		const commentInput = document.createElement('input')
		commentInput.type = 'text'
		commentInput.placeholder = 'Skriv en kommentar'
		commentInput.required = true
		const commentButton = document.createElement('button')
		commentButton.type = 'submit'
		commentButton.textContent = 'Send'

		commentForm.appendChild(commentInput)
		commentForm.appendChild(commentButton)

		commentForm.addEventListener('submit', async event => {
			event.preventDefault()
			const text = commentInput.value.trim()
			if (!text) return
			await handleForumComment(post.id, text)
			commentInput.value = ''
		})

		card.appendChild(actions)
		card.appendChild(commentList)
		card.appendChild(commentForm)
		feed.appendChild(card)
	})
}

async function handleForumComment(postId, text) {
	const comment = await createForumComment(postId, text, userProfile)
	const post = state.forumPosts.find(item => item.id === postId)
	if (!post) return
	post.comments.push(comment)
	renderForum()
	trackEvent('forum_comment_created', { postId })
	// Award 10 points for participating in activity (simplified - in real app, this would be when joining an activity)
	// For now, we'll award points when commenting as a proxy for participation
	state.userPoints = (state.userPoints || 0) + 10
	updateUserPoints()
}

async function handleForumLike(postId) {
	const post = state.forumPosts.find(item => item.id === postId)
	if (!post) return

	const alreadyLiked = state.forumLikes.has(postId)
	const delta = alreadyLiked ? -1 : 1
	const nextLikes = Math.max(0, (post.likes || 0) + delta)

	if (alreadyLiked) {
		state.forumLikes.delete(postId)
	} else {
		state.forumLikes.add(postId)
	}

	post.likes = nextLikes
	renderForum()

	await updateForumLikes(postId, nextLikes)
	trackEvent('forum_like_toggled', { postId, liked: !alreadyLiked })
}

function getInitials(name = '') {
	return name
		.split(' ')
		.filter(Boolean)
		.map(part => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

function setupAuthButtons() {
	const signInBtn = document.getElementById('google-signin-btn')
	const settingsSignOutBtn = document.getElementById('settings-signout-btn')

	if (signInBtn) {
		signInBtn.addEventListener('click', () => {
			trackEvent('auth_google_signin_clicked')
			signInWithGoogle()
		})
	}

	if (settingsSignOutBtn) {
		settingsSignOutBtn.addEventListener('click', async () => {
			trackEvent('auth_signout_clicked')
			await signOut()
			// Force page reload to clear all state
			window.location.reload()
		})
	}
}

function setupProfileEditing() {
	const editBioBtn = document.getElementById('edit-bio-btn')
	const changeAvatarBtn = document.getElementById('change-avatar-btn')
	const profileEditModal = document.getElementById('profile-edit-modal')
	const closeModalBtn = document.getElementById('close-profile-modal')
	const cancelModalBtn = document.getElementById('cancel-profile-modal-btn')
	const saveModalBtn = document.getElementById('save-profile-modal-btn')
	const modalBioTextarea = document.getElementById('modal-bio-textarea')
	const modalUsernameInput = document.getElementById('modal-username-input')
	const modalShowEmailToggle = document.getElementById('modal-show-email-toggle')
	const modalAvatarInput = document.getElementById('modal-avatar-input')
	const modalAvatarPreview = document.getElementById('modal-avatar-preview-img')
	const modalAvatarSvg = document.getElementById('modal-avatar-preview-svg')

	function openProfileModal() {
		if (!profileEditModal) return
		
		const currentBio = document.getElementById('profile-bio')?.textContent || ''
		if (modalBioTextarea) modalBioTextarea.value = currentBio
		
		// Set username
		const currentName = document.getElementById('profile-name')?.textContent || ''
		if (modalUsernameInput) {
			modalUsernameInput.value = currentName
		}
		
		// Set email visibility toggle
		if (modalShowEmailToggle && state.currentUser) {
			const showEmail = state.currentUser.user_metadata?.show_email !== false
			modalShowEmailToggle.checked = showEmail
		}
		
		// Show current avatar
		const currentAvatar = document.getElementById('profile-avatar-img')
		if (currentAvatar && currentAvatar.style.display !== 'none') {
			if (modalAvatarPreview) {
				modalAvatarPreview.src = currentAvatar.src
				modalAvatarPreview.style.display = 'block'
			}
			if (modalAvatarSvg) modalAvatarSvg.style.display = 'none'
		} else {
			if (modalAvatarPreview) modalAvatarPreview.style.display = 'none'
			const svgElement = document.querySelector('#profile-avatar-display svg')
			if (modalAvatarSvg && svgElement) {
				modalAvatarSvg.innerHTML = svgElement.outerHTML
				modalAvatarSvg.style.display = 'block'
			}
		}
		
		profileEditModal.style.display = 'flex'
	}

	function closeProfileModal() {
		if (profileEditModal) profileEditModal.style.display = 'none'
	}

	if (editBioBtn) {
		editBioBtn.addEventListener('click', openProfileModal)
	}

	if (changeAvatarBtn) {
		changeAvatarBtn.addEventListener('click', openProfileModal)
	}

	if (closeModalBtn) {
		closeModalBtn.addEventListener('click', closeProfileModal)
	}

	if (cancelModalBtn) {
		cancelModalBtn.addEventListener('click', closeProfileModal)
	}

	if (saveModalBtn) {
		saveModalBtn.addEventListener('click', async () => {
			const newBio = modalBioTextarea?.value.trim() || ''
			const newUsername = modalUsernameInput?.value.trim() || ''
			const showEmail = modalShowEmailToggle?.checked ?? true
			
			const bioText = document.getElementById('profile-bio')
			if (bioText) bioText.textContent = newBio || 'Hei, jeg er ny her! :)'
			
			const nameText = document.getElementById('profile-name')
			if (nameText && newUsername) {
				nameText.textContent = newUsername
			}
			
			// Update email visibility
			const emailEl = document.getElementById('profile-email')
			if (emailEl && state.currentUser?.email) {
				emailEl.style.display = showEmail ? 'block' : 'none'
			}
			
			let avatarUrl = null
			
			// Handle avatar if changed
			if (modalAvatarInput?.files[0]) {
				const file = modalAvatarInput.files[0]
				if (file.type.startsWith('image/')) {
					// Try to upload to Supabase Storage first
					if (supabase && state.currentUser) {
						try {
							const fileExt = file.name.split('.').pop()
							const fileName = `${state.currentUser.id}-${Date.now()}.${fileExt}`
							
							const { data: uploadData, error: uploadError } = await supabase.storage
								.from('avatars')
								.upload(fileName, file, {
									cacheControl: '3600',
									upsert: false
								})
							
							if (uploadError) {
								console.error('Upload error:', uploadError)
								// Fallback to base64
								const reader = new FileReader()
								reader.onload = (event) => {
									avatarUrl = event.target.result
									updateAvatarInUI(avatarUrl)
									saveProfileToSupabase(newBio, newUsername, showEmail, avatarUrl)
								}
								reader.readAsDataURL(file)
							} else {
								// Get public URL
								const { data: urlData } = supabase.storage
									.from('avatars')
									.getPublicUrl(fileName)
								avatarUrl = urlData.publicUrl
								updateAvatarInUI(avatarUrl)
								saveProfileToSupabase(newBio, newUsername, showEmail, avatarUrl)
							}
						} catch (err) {
							console.error('Error uploading avatar:', err)
							// Fallback to base64
							const reader = new FileReader()
							reader.onload = (event) => {
								avatarUrl = event.target.result
								updateAvatarInUI(avatarUrl)
								saveProfileToSupabase(newBio, newUsername, showEmail, avatarUrl)
							}
							reader.readAsDataURL(file)
						}
					} else {
						// No Supabase, use base64
						const reader = new FileReader()
						reader.onload = (event) => {
							avatarUrl = event.target.result
							updateAvatarInUI(avatarUrl)
							saveProfileToSupabase(newBio, newUsername, showEmail, avatarUrl)
						}
						reader.readAsDataURL(file)
					}
				}
			} else {
				// Keep existing avatar
				const existingAvatar = document.getElementById('profile-avatar-img')
				if (existingAvatar && existingAvatar.style.display !== 'none') {
					avatarUrl = existingAvatar.src
				} else if (state.currentUser?.user_metadata?.avatar_url) {
					avatarUrl = state.currentUser.user_metadata.avatar_url
				}
				saveProfileToSupabase(newBio, newUsername, showEmail, avatarUrl)
			}
		})
	}
	
	async function saveProfileToSupabase(bio, username, showEmail, avatarUrl) {
		if (!state.currentUser) {
			closeProfileModal()
			renderProfile()
			return
		}
		
		// Update user metadata
		if (supabase) {
			try {
				const updateData = {}
				if (bio !== undefined) updateData.bio = bio
				if (username) updateData.name = username
				if (showEmail !== undefined) updateData.show_email = showEmail
				if (avatarUrl) updateData.avatar_url = avatarUrl
				
				const { error: updateError } = await supabase.auth.updateUser({
					data: {
						...state.currentUser.user_metadata,
						...updateData
					}
				})
				
				if (updateError) {
					console.error('Error updating profile:', updateError)
					alert('Kunne ikke lagre endringer. Prøv igjen.')
					return
				}
				
				// Also save to user_profiles table if it exists
				try {
					const { error: profileError } = await supabase
						.from('user_profiles')
						.upsert({
							user_id: state.currentUser.id,
							bio: bio,
							name: username,
							show_email: showEmail,
							avatar_url: avatarUrl || state.currentUser.user_metadata?.avatar_url,
							updated_at: new Date().toISOString()
						})
					
					if (profileError && profileError.code !== '42P01') {
						console.error('Error saving to user_profiles:', profileError)
						// Not critical, continue anyway
					}
				} catch (err) {
					// Table might not exist, that's okay
					console.log('user_profiles table might not exist')
				}
				
				// Update state
				if (state.currentUser) {
					state.currentUser.user_metadata = {
						...state.currentUser.user_metadata,
						bio: bio,
						name: username || state.currentUser.user_metadata?.name,
						show_email: showEmail,
						avatar_url: avatarUrl || state.currentUser.user_metadata?.avatar_url
					}
				}
				
				alert('Profil oppdatert!')
			} catch (err) {
				console.error('Error saving profile:', err)
				alert('Kunne ikke lagre endringer. Prøv igjen.')
				return
			}
		}
		
		closeProfileModal()
		renderProfile()
	}
	
	function updateAvatarInUI(avatarUrl) {
		if (!avatarUrl) return
		
		const avatarImg = document.getElementById('profile-avatar-img')
		const avatarSvg = document.querySelector('#profile-avatar-display svg')
		const headerAvatar = document.getElementById('header-avatar')
		
		if (avatarImg) {
			avatarImg.src = avatarUrl
			avatarImg.style.display = 'block'
			if (avatarSvg) avatarSvg.style.display = 'none'
		}
		
		if (headerAvatar) {
			headerAvatar.src = avatarUrl
		}
		
		if (state.currentUser) {
			state.currentUser.user_metadata = state.currentUser.user_metadata || {}
			state.currentUser.user_metadata.avatar_url = avatarUrl
		}
	}

	if (modalAvatarInput) {
		modalAvatarInput.addEventListener('change', (e) => {
			const file = e.target.files[0]
			if (!file || !file.type.startsWith('image/')) {
				alert('Vennligst velg et bilde.')
				return
			}

			const reader = new FileReader()
			reader.onload = (event) => {
				if (modalAvatarPreview) {
					modalAvatarPreview.src = event.target.result
					modalAvatarPreview.style.display = 'block'
				}
				if (modalAvatarSvg) modalAvatarSvg.style.display = 'none'
			}
			reader.readAsDataURL(file)
		})
	}

	// Close modal when clicking outside
	if (profileEditModal) {
		profileEditModal.addEventListener('click', (e) => {
			if (e.target === profileEditModal) {
				closeProfileModal()
			}
		})
	}
}

function setupSettings() {
	const settingsBtn = document.getElementById('settings-btn')
	const darkModeToggle = document.getElementById('dark-mode-toggle')
	const deleteAccountBtn = document.getElementById('delete-account-btn')

	if (settingsBtn) {
		settingsBtn.addEventListener('click', () => {
			setActiveView('page-settings')
		})
	}

	if (darkModeToggle) {
		const isDark = localStorage.getItem('darkMode') === 'true'
		darkModeToggle.checked = isDark
		if (isDark) document.body.classList.add('dark-mode')

		darkModeToggle.addEventListener('change', (e) => {
			if (e.target.checked) {
				document.body.classList.add('dark-mode')
				localStorage.setItem('darkMode', 'true')
			} else {
				document.body.classList.remove('dark-mode')
				localStorage.setItem('darkMode', 'false')
			}
		})
	}

	if (deleteAccountBtn) {
		deleteAccountBtn.addEventListener('click', () => {
			if (confirm('Er du sikker på at du vil slette kontoen din? Dette kan ikke angres.')) {
				// TODO: Implement account deletion
				alert('Kontosletting er ikke implementert ennå.')
			}
		})
	}
}

function setupHeaderAvatar() {
	const profileAvatarBtn = document.getElementById('profile-avatar-btn')
	
	if (profileAvatarBtn) {
		profileAvatarBtn.addEventListener('click', () => {
			setActiveView('page-profile')
		})
	}
	
	updateHeaderAvatar()
}

function updateHeaderAvatarBadge(user) {
	const headerBadge = document.getElementById('header-user-type-badge')
	if (headerBadge && user) {
		const userType = getUserType(user)
		if (userType === 'admin') {
			headerBadge.textContent = 'A'
			headerBadge.style.background = '#E74C3C'
			headerBadge.style.display = 'flex'
			headerBadge.title = 'Administrator'
		} else if (userType === 'activity_leader') {
			headerBadge.textContent = 'L'
			headerBadge.style.background = '#3498DB'
			headerBadge.style.display = 'flex'
			headerBadge.title = 'Aktivitetsleder'
		} else if (userType === 'partner') {
			headerBadge.textContent = 'P'
			headerBadge.style.background = '#9B59B6'
			headerBadge.style.display = 'flex'
			headerBadge.title = 'Partner'
		} else {
			headerBadge.style.display = 'none'
		}
	}
}

function updateHeaderAvatar() {
	const headerAvatar = document.getElementById('header-avatar')
	const profileAvatarBtn = document.getElementById('profile-avatar-btn')
	const user = state.currentUser
	
	if (!headerAvatar || !profileAvatarBtn) return
	
	if (user) {
		const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.avatar_url
		if (avatarUrl) {
			headerAvatar.src = avatarUrl
		} else {
			// Use default avatar or Google profile picture
			headerAvatar.src = user.user_metadata?.picture || ''
		}
		profileAvatarBtn.style.display = 'block'
		updateHeaderAvatarBadge(user)
	} else {
		profileAvatarBtn.style.display = 'none'
	}
}

function setupAdminButton() {
	const adminBtn = document.getElementById('admin-btn')
	
	if (adminBtn) {
		adminBtn.addEventListener('click', () => {
			setActiveView('page-admin')
			renderAdminPanel()
		})
	}
}

async function renderAdminPanel() {
	if (!isAdmin(state.currentUser)) {
		alert('Du har ikke tilgang til administrasjon.')
		setActiveView('page-discover')
		return
	}
	
	await renderAdminUsers()
	renderAdminActivities()
}

let adminUsersPage = 1
const ADMIN_USERS_PER_PAGE = 15
let adminUsersCache = []
let adminHasMoreUsers = true

async function renderAdminUsers(loadMore = false) {
	const usersList = document.getElementById('admin-users-list')
	if (!usersList) return
	
	if (!loadMore) {
		adminUsersPage = 1
		adminUsersCache = []
		adminHasMoreUsers = true
		usersList.innerHTML = '<p>Laster brukere...</p>'
	}
	
	try {
		const { data: { users }, error } = await supabase.auth.admin.listUsers({
			page: adminUsersPage,
			perPage: ADMIN_USERS_PER_PAGE
		})
		
		if (error) {
			console.error('Error fetching users:', error)
			if (!loadMore) {
				usersList.innerHTML = '<p>Kunne ikke laste brukere. Prøv igjen senere.</p>'
			}
			return
		}
		
		if (!users || users.length === 0) {
			adminHasMoreUsers = false
			if (!loadMore) {
				usersList.innerHTML = '<p>Ingen brukere funnet.</p>'
			}
			return
		}
		
		adminHasMoreUsers = users.length === ADMIN_USERS_PER_PAGE
		adminUsersCache = loadMore ? [...adminUsersCache, ...users] : users
		
		if (!loadMore) {
			usersList.innerHTML = ''
		} else {
			const existingLoadMoreBtn = usersList.querySelector('.load-more-users-btn')
			if (existingLoadMoreBtn) existingLoadMoreBtn.remove()
		}
		
		users.forEach(user => {
			const userCard = createAdminUserCard(user)
			usersList.appendChild(userCard)
		})
		
		if (adminHasMoreUsers) {
			const loadMoreBtn = document.createElement('button')
			loadMoreBtn.className = 'primary-btn load-more-users-btn'
			loadMoreBtn.style.cssText = 'width: 100%; margin-top: 1rem;'
			loadMoreBtn.textContent = 'Last flere brukere'
			loadMoreBtn.addEventListener('click', async () => {
				loadMoreBtn.textContent = 'Laster...'
				loadMoreBtn.disabled = true
				adminUsersPage++
				await renderAdminUsers(true)
			})
			usersList.appendChild(loadMoreBtn)
		}
		
		setupAdminUserActions()
	} catch (error) {
		console.error('Error rendering admin users:', error)
		if (!loadMore) {
			usersList.innerHTML = '<p>Kunne ikke laste brukere. Prøv igjen senere.</p>'
		}
	}
}

function createAdminUserCard(user) {
	const userCard = document.createElement('div')
	userCard.className = 'admin-user-card card'
	userCard.style.cssText = 'padding: 1rem; margin-bottom: 1rem;'
	
	const userType = getUserType(user)
	const isBanned = user.user_metadata?.banned || false
	const isFlagged = user.user_metadata?.flagged || false
	
	userCard.innerHTML = `
		<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
			<div>
				<h4 style="margin: 0 0 0.25rem 0;">${user.user_metadata?.name || user.email?.split('@')[0] || 'Ukjent bruker'}</h4>
				<p style="margin: 0; color: var(--muted); font-size: 0.85rem;">${user.email}</p>
				<div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
					<span class="badge" style="background: ${getUserTypeColor(userType)}; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">
						${getUserTypeLabel(userType)}
					</span>
					${isBanned ? '<span class="badge" style="background: #E74C3C; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">Bannet</span>' : ''}
					${isFlagged ? '<span class="badge" style="background: #F39C12; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">Flaggert</span>' : ''}
				</div>
			</div>
		</div>
		<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
			<select class="role-select" data-user-id="${user.id}" style="padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(72, 199, 142, 0.2); flex: 1; min-width: 150px;">
				<option value="user" ${userType === 'user' ? 'selected' : ''}>Bruker</option>
				<option value="activity_leader" ${userType === 'activity_leader' ? 'selected' : ''}>Aktivitetsleder</option>
				<option value="partner" ${userType === 'partner' ? 'selected' : ''}>Partner</option>
				<option value="admin" ${userType === 'admin' ? 'selected' : ''}>Admin</option>
			</select>
			<button class="ghost-btn small ban-btn" data-user-id="${user.id}" data-banned="${isBanned}" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
				${isBanned ? '🔓 Opphev ban' : '🚫 Bann'}
			</button>
			<button class="ghost-btn small flag-btn" data-user-id="${user.id}" data-flagged="${isFlagged}" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
				${isFlagged ? '✅ Opphev flagg' : '🚩 Flagg'}
			</button>
		</div>
	`
	
	return userCard
}

function getUserTypeColor(userType) {
	switch (userType) {
		case 'admin': return '#E74C3C'
		case 'activity_leader': return '#3498DB'
		case 'partner': return '#9B59B6'
		default: return '#95A5A6'
	}
}

function getUserTypeLabel(userType) {
	switch (userType) {
		case 'admin': return 'Admin'
		case 'activity_leader': return 'Aktivitetsleder'
		case 'partner': return 'Partner'
		default: return 'Bruker'
	}
}

function setupAdminUserActions() {
	// Role select
	document.querySelectorAll('.role-select').forEach(select => {
		select.addEventListener('change', async (e) => {
			const userId = e.target.dataset.userId
			const newRole = e.target.value
			
			try {
				const { error } = await supabase.auth.admin.updateUserById(userId, {
					user_metadata: {
						user_type: newRole
					}
				})
				
				if (error) throw error
				
				alert('Rolle oppdatert!')
				await renderAdminUsers()
			} catch (error) {
				console.error('Error updating user role:', error)
				alert('Kunne ikke oppdatere rolle. Prøv igjen.')
			}
		})
	})
	
	// Ban/Unban buttons
	document.querySelectorAll('.ban-btn').forEach(btn => {
		btn.addEventListener('click', async (e) => {
			const userId = e.target.dataset.userId
			const isBanned = e.target.dataset.banned === 'true'
			
			try {
				const { error } = await supabase.auth.admin.updateUserById(userId, {
					user_metadata: {
						banned: !isBanned
					}
				})
				
				if (error) throw error
				
				alert(isBanned ? 'Ban opphevet!' : 'Bruker bannet!')
				await renderAdminUsers()
			} catch (error) {
				console.error('Error updating ban status:', error)
				alert('Kunne ikke oppdatere ban-status. Prøv igjen.')
			}
		})
	})
	
	// Flag/Unflag buttons
	document.querySelectorAll('.flag-btn').forEach(btn => {
		btn.addEventListener('click', async (e) => {
			const userId = e.target.dataset.userId
			const isFlagged = e.target.dataset.flagged === 'true'
			
			try {
				const { error } = await supabase.auth.admin.updateUserById(userId, {
					user_metadata: {
						flagged: !isFlagged
					}
				})
				
				if (error) throw error
				
				alert(isFlagged ? 'Flagg opphevet!' : 'Bruker flagget!')
				await renderAdminUsers()
			} catch (error) {
				console.error('Error updating flag status:', error)
				alert('Kunne ikke oppdatere flagg-status. Prøv igjen.')
			}
		})
	})
}

function renderAdminActivities() {
	const activitiesList = document.getElementById('admin-activities-list')
	if (!activitiesList) return
	
	activitiesList.innerHTML = ''
	
	if (state.activities.length === 0) {
		activitiesList.innerHTML = '<p>Ingen aktiviteter funnet.</p>'
		return
	}
	
	state.activities.forEach(activity => {
		const activityCard = document.createElement('div')
		activityCard.className = 'admin-activity-card card'
		activityCard.style.cssText = 'padding: 1rem; margin-bottom: 1rem;'
		
		activityCard.innerHTML = `
			<h4 style="margin: 0 0 0.5rem 0;">${activity.name}</h4>
			<p style="margin: 0 0 0.5rem 0; color: var(--muted); font-size: 0.9rem;">
				${activity.location} • ${formatDateTime(activity.date)} • ${activity.host}
			</p>
			<button class="ghost-btn small delete-activity-btn" data-activity-id="${activity.id}" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
				🗑️ Slett aktivitet
			</button>
		`
		
		activitiesList.appendChild(activityCard)
	})
	
	// Setup delete buttons
	document.querySelectorAll('.delete-activity-btn').forEach(btn => {
		btn.addEventListener('click', async (e) => {
			const activityId = e.target.dataset.activityId
			
			if (!confirm('Er du sikker på at du vil slette denne aktiviteten?')) {
				return
			}
			
			try {
				const { error } = await supabase
					.from('activities')
					.delete()
					.eq('id', activityId)
				
				if (error) throw error
				
				// Remove from state
				state.activities = state.activities.filter(a => a.id !== activityId)
				
				alert('Aktivitet slettet!')
				renderAdminActivities()
				await renderDiscover()
			} catch (error) {
				console.error('Error deleting activity:', error)
				alert('Kunne ikke slette aktivitet. Prøv igjen.')
			}
		})
	})
}


function setupActivityLeaderApplication() {
	const startCourseBtn = document.getElementById('start-course-btn')
	const courseContent = document.getElementById('course-content')
	const submitCourseBtn = document.getElementById('submit-course-btn')
	
	if (startCourseBtn) {
		startCourseBtn.addEventListener('click', () => {
			if (courseContent) {
				courseContent.style.display = 'block'
				startCourseBtn.style.display = 'none'
			}

		})
	}
	
	if (submitCourseBtn) {
		submitCourseBtn.addEventListener('click', async () => {
			const answer = document.getElementById('course-answer-1')?.value
			
			if (!answer || answer.trim().length < 20) {
				alert('Vennligst skriv et mer utfyllende svar (minst 20 tegn).')
				return
			}
			
			// Save application to Supabase or state
			if (supabase && state.currentUser) {
				try {
					const { data, error } = await supabase
						.from('activity_leader_applications')
						.insert({
							user_id: state.currentUser.id,
							email: state.currentUser.email,
							course_answer: answer,
							status: 'pending',
							created_at: new Date().toISOString()
						})
					
					if (error) {
						console.error('Error saving application:', error)
						// If table doesn't exist, just show success message
						if (error.code === '42P01') {
							alert('Søknad sendt! (Demo - database tabell ikke opprettet ennå)')
						} else {
							alert('Kunne ikke sende søknad. Prøv igjen.')
						}
					} else {
						alert('Søknad sendt! Vi vil vurdere søknaden din og kontakte deg snart.')
					}
				} catch (err) {
					console.error('Error:', err)
					alert('Søknad sendt! (Demo)')
				}
			} else {
				alert('Søknad sendt! (Demo - ikke lagret til database)')
			}
		})
	}
}

function updateUIForUser() {
	const user = state.currentUser
	const createBtn = document.getElementById('nav-create')
	const adminBtn = document.getElementById('admin-btn')
	
	// Always show create button, but content differs based on permissions
	if (createBtn) {
		createBtn.style.display = 'grid'  // Always visible
	}
	
	if (adminBtn) {
		adminBtn.style.display = isAdmin(user) ? 'block' : 'none'
	}
	
	// Show/hide application form vs create form
	const applicationForm = document.getElementById('activity-leader-application')
	const createForm = document.getElementById('create-form')
	const createSubtitle = document.getElementById('create-subtitle')
	
	if (canCreateActivities(user)) {
		// User can create activities
		if (applicationForm) applicationForm.style.display = 'none'
		if (createForm) createForm.style.display = 'block'
		if (createSubtitle) createSubtitle.textContent = 'Bli vertskap for neste opplevelse.'
	} else {
		// Regular user - show application
		if (applicationForm) applicationForm.style.display = 'block'
		if (createForm) createForm.style.display = 'none'
		if (createSubtitle) createSubtitle.textContent = 'Bli aktivitetsleder for å arrangere aktiviteter.'
	}
}

function setupNotifications() {
	const notificationsBtn = document.getElementById('notifications-btn')
	const notificationDropdown = document.getElementById('notification-dropdown')
	const notificationsContainer = document.getElementById('notifications-container')
	
	if (!notificationsBtn || !notificationDropdown) return
	
	// Toggle dropdown on button click
	notificationsBtn.addEventListener('click', (e) => {
		e.stopPropagation()
		const isVisible = notificationDropdown.style.display === 'block'
		
		if (isVisible) {
			notificationDropdown.style.display = 'none'
		} else {
			// Get notifications (for now, empty list - can be extended later)
			const notifications = []
			
			if (notificationsContainer) {
				notificationsContainer.innerHTML = ''
				
				if (notifications.length === 0) {
					const emptyState = document.createElement('p')
					emptyState.className = 'empty-state'
					emptyState.textContent = 'Du har ingen nye varsler.'
					notificationsContainer.appendChild(emptyState)
				} else {
					notifications.forEach(notification => {
						const notificationItem = document.createElement('div')
						notificationItem.className = 'notification-item'
						notificationItem.textContent = notification.message
						notificationsContainer.appendChild(notificationItem)
					})
				}
			}
			
			notificationDropdown.style.display = 'block'
		}
	})
	
	// Close dropdown when clicking outside
	// IMPORTANT: Exclude map elements to prevent navigation bugs
	document.addEventListener('click', (e) => {
		// Don't process clicks on map elements
		if (isMapElement(e.target)) {
			return
		}
		
		if (notificationDropdown && 
			!notificationDropdown.contains(e.target) && 
			!notificationsBtn.contains(e.target)) {
			notificationDropdown.style.display = 'none'
		}
	})
}

function resetInitialization() {
	isInitialized = false
}

// Export functions for authService
window.updateUIForUser = updateUIForUser
window.renderProfile = renderProfile
window.updateHeaderAvatar = updateHeaderAvatar
window.showLoginModal = showLoginModal
window.hideLoginModal = hideLoginModal
window.bootstrap = bootstrap
window.resetInitialization = resetInitialization

// Badge functions
async function checkAndRenderBadges(user) {
	if (!user) return
	
	const previousBadges = state.userBadges || []
	const { earnedBadges, newBadges } = checkBadges(user, previousBadges)
	
	state.userBadges = earnedBadges
	
	// Save to Supabase
	if (supabase && user.id) {
		await saveBadgesToSupabase(user.id, earnedBadges)
	}
	
	// Show popup for new badges and award points
	if (newBadges.length > 0) {
		newBadges.forEach(badge => {
			showBadgePopup(badge)
			// Award 20 points per badge
			state.userPoints = (state.userPoints || 0) + 20
		})
		updateUserPoints()
	}
	
	// Render badges in profile
	renderBadges(earnedBadges)
}

function renderBadges(badges) {
	const badgesList = document.getElementById('badges-list')
	if (!badgesList) return
	
	badgesList.innerHTML = ''
	
	// Show all badges (earned and locked)
	Object.values(BADGES).forEach(badge => {
		const badgeItem = document.createElement('div')
		badgeItem.className = 'badge-item'
		const isEarned = badges.some(b => b.id === badge.id)
		
		if (!isEarned) {
			badgeItem.classList.add('locked')
		}
		
		badgeItem.textContent = badge.icon
		badgeItem.title = badge.name
		
		badgeItem.addEventListener('click', () => {
			showBadgeDetail(badge, isEarned)
		})
		
		badgesList.appendChild(badgeItem)
	})
}

function showBadgePopup(badge) {
	// Check if this badge popup has already been shown
	const shownBadges = JSON.parse(localStorage.getItem('shownBadgePopups') || '[]')
	if (shownBadges.includes(badge.id)) {
		return // Already shown, don't show again
	}
	
	const popup = document.getElementById('badge-popup-modal')
	const icon = popup?.querySelector('.badge-popup-icon')
	const name = popup?.querySelector('.badge-popup-name')
	const closeBtn = document.getElementById('close-badge-popup')
	
	if (!popup) return
	
	if (icon) icon.textContent = badge.icon
	if (name) name.textContent = badge.name
	
	popup.style.display = 'flex'
	
	// Mark as shown
	shownBadges.push(badge.id)
	localStorage.setItem('shownBadgePopups', JSON.stringify(shownBadges))
	
	if (closeBtn) {
		closeBtn.onclick = () => {
			popup.style.display = 'none'
		}
	}
	
	// Auto close after 5 seconds
	setTimeout(() => {
		popup.style.display = 'none'
	}, 5000)
}

async function updateUserPoints() {
	if (!state.currentUser) return
	
	const pointsEl = document.getElementById('profile-points')
	if (pointsEl) pointsEl.textContent = state.userPoints || 0
	
	// Save points to Supabase
	if (supabase && state.currentUser.id) {
		try {
			// Save to user_metadata
			await supabase.auth.updateUser({
				data: {
					...state.currentUser.user_metadata,
					points: state.userPoints
				}
			})
			
			// Also save to user_profiles table if it exists
			try {
				await supabase
					.from('user_profiles')
					.upsert({
						user_id: state.currentUser.id,
						points: state.userPoints,
						updated_at: new Date().toISOString()
					})
			} catch (err) {
				// Table might not exist, that's okay
				console.log('user_profiles table might not exist for points')
			}
		} catch (err) {
			console.error('Error saving points:', err)
		}
	}
}

async function loadUserPointsFromSupabase(userId) {
	if (!supabase) return null
	
	try {
		const { data, error } = await supabase
			.from('user_profiles')
			.select('points')
			.eq('user_id', userId)
			.single()
		
		if (error && error.code !== 'PGRST116') {
			console.error('Error loading points:', error)
			return null
		}
		
		return data?.points || null
	} catch (err) {
		return null
	}
}

function showBadgeDetail(badge, isEarned) {
	const modal = document.getElementById('badge-detail-modal')
	const icon = modal?.querySelector('.badge-detail-icon')
	const name = modal?.querySelector('.badge-detail-name')
	const description = modal?.querySelector('.badge-detail-description')
	const closeBtn = document.getElementById('close-badge-detail')
	
	if (!modal) return
	
	if (icon) icon.textContent = badge.icon
	if (name) name.textContent = badge.name
	if (description) {
		description.textContent = isEarned 
			? badge.description 
			: `Oppnå dette merket ved å: ${badge.description}`
	}
	
	modal.style.display = 'flex'
	
	if (closeBtn) {
		closeBtn.onclick = () => {
			modal.style.display = 'none'
		}
	}
	
	// Close when clicking outside
	modal.onclick = (e) => {
		if (e.target === modal) {
			modal.style.display = 'none'
		}
	}
}


