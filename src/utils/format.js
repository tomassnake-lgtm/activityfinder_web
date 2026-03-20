export function formatDateTime(value) {
	const date = new Date(value)
	return date.toLocaleString('no-NO', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

export function formatRelativeTime(value) {
	if (!value) return 'Nettopp'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Nettopp'
	return date.toLocaleString('no-NO', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

export function formatRadius(value) {
	return `${value} km`
}

