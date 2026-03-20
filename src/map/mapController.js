import { DEFAULT_COORDS } from '../constants/sampleData.js'
import { formatDateTime, formatRadius } from '../utils/format.js'
import { state } from '../state/appState.js'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix for default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
	iconUrl,
	iconRetinaUrl,
	shadowUrl
})

let mapInstance
let markerLayer
let userMarker
let radiusCircle
let activityMarkerIcon
let activityLeaderMarkerIcon
let userMarkerIcon

export function getMapInstance() {
	return mapInstance
}

export function ensureMap(state) {
	// Ensure DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => ensureMap(state))
		return
	}

	const mapElement = document.getElementById('activity-map')
	if (!mapElement) {
		console.warn('Map element not found')
		return
	}

	// Check if element is visible
	const mapPanel = mapElement.closest('.map-panel')
	if (mapPanel && mapPanel.classList.contains('hidden')) {
		console.warn('Map panel is hidden')
		return
	}

	// Ensure element has dimensions
	if (mapElement.offsetHeight === 0 || mapElement.offsetWidth === 0) {
		console.warn('Map element has no dimensions')
		requestAnimationFrame(() => ensureMap(state))
		return
	}

	if (mapInstance) {
		requestAnimationFrame(() => {
			if (mapInstance) {
				mapInstance.invalidateSize()
				refreshMarkers(state)
				if (state.userLocation) {
					updateRadiusCircle(state)
				}
			}
		})
		return
	}

	initMap(state)
	requestAnimationFrame(() => {
		if (mapInstance) {
			mapInstance.invalidateSize()
		}
	})
}

export function refreshMarkers(state) {
	if (!markerLayer) return
	markerLayer.clearLayers()

	state.activities
		.filter(activity => isWithinRadius(activity.coords, state))
		.forEach(activity => {
			L.marker(activity.coords, { icon: getActivityIcon(activity, state) })
				.addTo(markerLayer)
				.bindPopup(buildPopup(activity))
		})
}

export function refreshAllMarkers(activities, state) {
	if (!markerLayer) return
	markerLayer.clearLayers()

	// Show filtered activities with green pins for activity leaders
	const activitiesToShow = activities || state.activities
	activitiesToShow.forEach(activity => {
		L.marker(activity.coords, { icon: getActivityIcon(activity, state) })
			.addTo(markerLayer)
			.bindPopup(buildPopup(activity))
	})
}

export function setUserLocation(state, coords, { recenter = true } = {}) {
	state.userLocation = coords

	if (!mapInstance) return

	placeUserMarker(coords)
	updateRadiusCircle(state)
	refreshMarkers(state)

	if (recenter) {
		mapInstance.setView(coords, Math.max(mapInstance.getZoom(), 12))
	}
}

export function setupRadiusControl(state) {
	const radiusInput = document.getElementById('radius-input')
	const radiusValue = document.getElementById('radius-value')

	if (!radiusInput || !radiusValue) return

	const updateDisplay = value => {
		radiusValue.textContent = formatRadius(value)
	}

	radiusInput.value = state.searchRadiusKm
	updateDisplay(state.searchRadiusKm)

	radiusInput.addEventListener('input', event => {
		const value = Number(event.target.value)
		state.searchRadiusKm = value
		updateDisplay(value)
		updateRadiusCircle(state)
		refreshMarkers(state)
	})
}

export function setupLocateMeButton(onClick) {
	const button = document.getElementById('locate-me-btn')
	if (!button) return
	button.addEventListener('click', onClick)
}

export function tryLocateUser(state, { fallbackToDefault = true } = {}) {
	if (!navigator.geolocation) {
		if (fallbackToDefault && !state.userLocation) {
			setUserLocation(state, DEFAULT_COORDS)
		}
		return
	}

	navigator.geolocation.getCurrentPosition(
		position => {
			const { latitude, longitude } = position.coords
			setUserLocation(state, [latitude, longitude])
		},
		() => {
			if (fallbackToDefault && !state.userLocation) {
				setUserLocation(state, DEFAULT_COORDS)
			}
		},
		{
			enableHighAccuracy: true,
			maximumAge: 60000,
			timeout: 10000
		}
	)
}

function initMap(state) {
	const mapElement = document.getElementById('activity-map')
	if (!mapElement) {
		console.warn('Map element not found in DOM')
		return
	}

	// Double-check element has dimensions
	if (mapElement.offsetHeight === 0 || mapElement.offsetWidth === 0) {
		console.warn('Map element has no dimensions, retrying...')
		requestAnimationFrame(() => initMap(state))
		return
	}

	if (mapInstance) {
		mapInstance.remove()
		mapInstance = null
		markerLayer = null
		userMarker = null
		radiusCircle = null
		activityMarkerIcon = null
		userMarkerIcon = null
	}

	const initialCoords = state.userLocation || DEFAULT_COORDS
	
	try {
		mapInstance = L.map('activity-map', { 
			zoomControl: true,
			zoomControlOptions: {
				position: 'topright'
			},
			preferCanvas: false
		}).setView(initialCoords, 12)

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
			detectRetina: true
		}).addTo(mapInstance)

		markerLayer = L.layerGroup().addTo(mapInstance)
		
		if (state.userLocation) {
			placeUserMarker(state.userLocation)
			updateRadiusCircle(state)
		}
		
		refreshMarkers(state)
	} catch (error) {
		console.error('Failed to initialize map:', error)
	}
}

function placeUserMarker(coords) {
	if (!mapInstance || !coords) return

	if (!userMarker) {
		userMarker = L.marker(coords, { 
			icon: getUserIcon(), 
			zIndexOffset: 500,
			draggable: true
		})
			.addTo(mapInstance)
			.bindPopup('Du er her')
		
		// Update location and radius when marker is dragged
		userMarker.on('dragend', function(event) {
			const newCoords = event.target.getLatLng()
			state.userLocation = [newCoords.lat, newCoords.lng]
			updateRadiusCircle(state)
			refreshMarkers(state)
		})
	} else {
		userMarker.setLatLng(coords)
		updateRadiusCircle(state)
	}
}

function updateRadiusCircle(state) {
	if (!mapInstance || !state.userLocation) return

	const radiusMeters = state.searchRadiusKm * 1000

	if (!radiusCircle) {
		radiusCircle = L.circle(state.userLocation, {
			radius: radiusMeters,
			color: '#48C78E',
			fillColor: '#48C78E',
			fillOpacity: 0.12,
			weight: 2
		}).addTo(mapInstance)
	} else {
		radiusCircle.setLatLng(state.userLocation)
		radiusCircle.setRadius(radiusMeters)
	}
}

function getActivityIcon(activity, state) {
	// Check if activity is created by an activity leader
	const hostName = activity.host
	const isActivityLeader = state.activities.some(a => {
		if (a.host === hostName) {
			// Check if host is an activity leader by checking user metadata
			const user = state.currentUser
			if (user && (user.user_metadata?.name === hostName || user.email?.split('@')[0] === hostName)) {
				const userType = user.user_metadata?.user_type || 'user'
				return userType === 'activity_leader' || userType === 'partner' || userType === 'admin'
			}
			// For other users, check if they have created activities (heuristic)
			const userActivities = state.activities.filter(a => a.host === hostName)
			return userActivities.length > 0
		}
		return false
	})
	
	if (isActivityLeader) {
		// Create green marker for activity leaders
		if (!activityLeaderMarkerIcon) {
			// Create a green marker icon
			const greenIconUrl = 'data:image/svg+xml;base64,' + btoa(`
				<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
					<path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5S25 21.25 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#48C78E"/>
					<circle cx="12.5" cy="12.5" r="6" fill="#ffffff"/>
				</svg>
			`)
			activityLeaderMarkerIcon = L.icon({
				iconUrl: greenIconUrl,
				iconSize: [25, 41],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34],
				className: 'activity-leader-marker'
			})
		}
		return activityLeaderMarkerIcon
	}
	
	// Default blue marker for regular activities
	if (!activityMarkerIcon) {
		activityMarkerIcon = L.icon({
			iconUrl,
			iconRetinaUrl,
			shadowUrl,
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowSize: [41, 41],
			shadowAnchor: [12, 41],
			className: 'activity-marker'
		})
	}
	return activityMarkerIcon
}

function getUserIcon() {
	if (!userMarkerIcon) {
		// Create green marker by using default icon with custom styling
		userMarkerIcon = L.icon({
			iconUrl,
			iconRetinaUrl,
			shadowUrl,
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowSize: [41, 41],
			shadowAnchor: [12, 41],
			className: 'user-marker'
		})
	}
	return userMarkerIcon
}

function isWithinRadius(coords, state) {
	if (!state.userLocation) return true
	const distance = getDistanceKm(coords, state.userLocation)
	return distance <= state.searchRadiusKm
}

function getDistanceKm(a, b) {
	const [lat1, lon1] = a
	const [lat2, lon2] = b
	const toRad = value => (value * Math.PI) / 180
	const R = 6371
	const dLat = toRad(lat2 - lat1)
	const dLon = toRad(lon2 - lon1)
	const lat1Rad = toRad(lat1)
	const lat2Rad = toRad(lat2)
	const haversine =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad)
	const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
	return R * c
}

function buildPopup(activity) {
	return `
    <strong>${activity.name}</strong><br/>
    ${activity.location}<br/>
    ${formatDateTime(activity.date)}<br/>
    <em>${activity.host}</em>
  `
}

