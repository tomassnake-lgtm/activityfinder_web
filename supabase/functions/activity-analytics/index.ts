// Example Supabase Edge Function (Deno) to return simple aggregates
// Deploy with: supabase functions deploy activity-analytics
// Call from client with: fetch('/functions/v1/activity-analytics')

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'

serve(async req => {
	const url = new URL(req.url)
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}

	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
		const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
		const supabase = createClient(supabaseUrl, supabaseKey)

		const [{ data: activityCount }, { data: forumCount }] = await Promise.all([
			supabase.from('activities').select('id', { count: 'exact', head: true }),
			supabase.from('forum_posts').select('id', { count: 'exact', head: true })
		])

		const body = {
			activities: activityCount?.length ?? 0,
			forumPosts: forumCount?.length ?? 0
		}

		return new Response(JSON.stringify(body), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		})
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		})
	}
})

const corsHeaders: HeadersInit = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}


