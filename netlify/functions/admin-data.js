import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  // Verify super admin
  const { data: sa } = await supabase.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!sa) return { statusCode: 403, body: JSON.stringify({ error: 'Not a super admin' }) }

  const { action, ...payload } = JSON.parse(event.body || '{}')

  try {
    if (action === 'load') {
      const [companies, members, groups] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('company_members').select('*, companies(name)').order('display_name'),
        supabase.from('company_groups').select('*').order('name'),
      ])
      return {
        statusCode: 200,
        body: JSON.stringify({
          companies: companies.data || [],
          members:   members.data   || [],
          groups:    groups.data     || [],
        }),
      }
    }

    if (action === 'createGroup') {
      const { error } = await supabase.from('company_groups').insert({ name: payload.name })
      if (error) throw error
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    if (action === 'assignGroup') {
      const { error } = await supabase.from('companies').update({ group_id: payload.groupId || null }).eq('id', payload.companyId)
      if (error) throw error
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
