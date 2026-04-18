import { createClient } from '@supabase/supabase-js'
import { getAuthEmailConfig, sendAuthEmail } from './_authEmail.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const { email } = JSON.parse(event.body || '{}')
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) }
  }

  try {
    const { redirectTo } = getAuthEmailConfig()
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo },
    })

    if (error) {
      if (error.code === 'user_not_found' || error.code === 'identity_not_found') {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) }
      }

      return { statusCode: 400, body: JSON.stringify({ error: error.message }) }
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      throw new Error('Magic link could not be generated')
    }

    await sendAuthEmail({
      toEmail: normalizedEmail,
      actionLink,
      mode: 'magiclink',
    })

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('send-magic-link error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
