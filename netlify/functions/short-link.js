import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  const slug = event.queryStringParameters?.slug

  if (!slug) {
    return { statusCode: 400, body: 'Missing slug' }
  }

  try {
    const { data, error } = await supabase
      .from('short_links')
      .select('destination_url')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!data?.destination_url) {
      return { statusCode: 404, body: 'Link not found' }
    }

    return {
      statusCode: 302,
      headers: {
        Location: data.destination_url,
        'Cache-Control': 'no-store',
      },
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message,
    }
  }
}
