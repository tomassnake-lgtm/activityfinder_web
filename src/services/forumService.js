import { supabase } from '../lib/supabaseClient.js'

const FORUM_SELECT = `
  id,
  author,
  context,
  content,
  likes,
  created_at,
  user_id,
  forum_comments (
    id,
    post_id,
    author,
    text,
    created_at
  )
`

let forumChannel

export async function fetchForumPosts() {
	if (!supabase) return []

	try {
		const { data, error } = await supabase
			.from('forum_posts')
			.select(FORUM_SELECT)
			.order('created_at', { ascending: false })

		if (error) throw error
		if (!data) return []
		return data.map(normalizePost)
	} catch (error) {
		console.error('Failed to fetch forum posts.', error)
		return []
	}
}

export async function createForumPost(content, userProfile, imageUrls = [], userId = null) {
	const payload = {
		author: userProfile.name,
		context: userProfile.bio,
		content,
		likes: 0,
		images: imageUrls,
		user_id: userId
	}

	if (!supabase) {
		console.warn('Supabase is not configured, creating forum post locally.')
		return {
			...payload,
			id: `local-${Date.now()}`,
			createdAt: new Date().toISOString(),
			comments: [],
			images: imageUrls
		}
	}

	try {
		const { data, error } = await supabase
			.from('forum_posts')
			.insert(payload)
			.select(FORUM_SELECT)
			.single()

		if (error) throw error
		return normalizePost(data)
	} catch (error) {
		console.error('Failed to publish forum post, creating local fallback entry.', error)
		return {
			...payload,
			id: `local-${Date.now()}`,
			createdAt: new Date().toISOString(),
			comments: [],
			images: imageUrls
		}
	}
}

export async function createForumComment(postId, text, userProfile) {
	const payload = {
		post_id: postId,
		author: userProfile.name,
		text
	}

	if (!supabase) {
		console.warn('Supabase is not configured, storing comment locally.')
		return {
			id: `local-${Date.now()}`,
			postId,
			author: userProfile.name,
			text,
			createdAt: new Date().toISOString()
		}
	}

	try {
		const { data, error } = await supabase
			.from('forum_comments')
			.insert(payload)
			.select('id, post_id, author, text, created_at')
			.single()

		if (error) throw error
		return normalizeComment(data)
	} catch (error) {
		console.error('Failed to add comment to Supabase, storing locally.', error)
		return {
			id: `local-${Date.now()}`,
			postId,
			author: userProfile.name,
			text,
			createdAt: new Date().toISOString()
		}
	}
}

export async function updateForumLikes(postId, likes) {
	if (!supabase) return

	try {
		await supabase.from('forum_posts').update({ likes }).eq('id', postId)
	} catch (error) {
		console.error('Failed to sync likes with Supabase.', error)
	}
}

export function subscribeToForumChanges(callback) {
	if (!supabase || typeof supabase.channel !== 'function') return () => {}

	if (forumChannel) {
		forumChannel.unsubscribe()
	}

	forumChannel = supabase
		.channel('public:forum_posts')
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'forum_posts' },
			payload => callback?.(payload)
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'forum_comments' },
			payload => callback?.(payload)
		)
		.subscribe(status => {
			if (status === 'CLOSED') {
				forumChannel = null
			}
		})

	return () => forumChannel?.unsubscribe()
}

function normalizePost(row) {
	return {
		id: row.id,
		author: row.author || 'Anonym',
		context: row.context || '',
		content: row.content || '',
		likes: row.likes || 0,
		createdAt: row.created_at || row.createdAt,
		user_id: row.user_id || null,
		comments: (row.forum_comments || row.comments || []).map(normalizeComment)
	}
}

function normalizeComment(row) {
	return {
		id: row.id,
		postId: row.post_id || row.postId,
		author: row.author || 'Anonym',
		text: row.text || '',
		createdAt: row.created_at || row.createdAt
	}
}

