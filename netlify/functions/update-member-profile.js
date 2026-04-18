import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

    const { userId, companyId, displayName, repPhone, repEmail } = JSON.parse(event.body || '{}')

    const [{ data: superAdmin }, { data: requesterMember }] = await Promise.all([
      supabase.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('company_members').select('company_id, role').eq('user_id', user.id).maybeSingle(),
    ])

    const targetUserId = userId || user.id
    const targetCompanyId = companyId || requesterMember?.company_id
    const isSelf = targetUserId === user.id
    const isAdminManager = !!superAdmin || (
      requesterMember?.role === 'admin' &&
      requesterMember.company_id === targetCompanyId
    )

    if (!targetCompanyId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Company is required' }) }
    }

    if (!isSelf && !isAdminManager) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    if (isSelf && !superAdmin && requesterMember?.company_id !== targetCompanyId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    const { data: targetMember } = await supabase
      .from('company_members')
      .select('user_id, company_id')
      .eq('user_id', targetUserId)
      .eq('company_id', targetCompanyId)
      .maybeSingle()

    if (!targetMember) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Team member not found' }) }
    }

    const updates = {
      display_name: displayName?.trim() || null,
      rep_phone: repPhone?.trim() || null,
      rep_email: repEmail?.trim() || null,
    }

    const { data: updatedMember, error: updateError } = await supabase
      .from('company_members')
      .update(updates)
      .eq('user_id', targetUserId)
      .eq('company_id', targetCompanyId)
      .select('*')
      .single()

    if (updateError) {
      return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) }
    }

    return { statusCode: 200, body: JSON.stringify({ member: updatedMember }) }
  } catch (err) {
    console.error('update-member-profile error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
