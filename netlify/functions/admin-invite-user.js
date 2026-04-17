import { createClient } from '@supabase/supabase-js'
import { seedDefaultTemplates } from '../../supabase/seed/default-templates.js'

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

    const [{ data: superAdmin }, { data: member }] = await Promise.all([
      supabase.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('company_members').select('company_id, role').eq('user_id', user.id).maybeSingle(),
    ])

    if (!superAdmin && member?.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    const { email, role = 'member', companyId, newCompanyName, displayName, repPhone, repEmail } = JSON.parse(event.body)

    let targetCompanyId = superAdmin ? companyId : member.company_id
    let targetCompanyName = null

    if (superAdmin && newCompanyName?.trim()) {
      const trimmedName = newCompanyName.trim()
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: trimmedName })
        .select('id')
        .single()

      if (companyError) {
        return { statusCode: 500, body: JSON.stringify({ error: companyError.message }) }
      }

      targetCompanyId = company.id
      targetCompanyName = trimmedName

      const { error: settingsError } = await supabase
        .from('company_settings')
        .insert({ company_id: targetCompanyId, company_name: trimmedName })

      if (settingsError) {
        return { statusCode: 500, body: JSON.stringify({ error: settingsError.message }) }
      }
    }

    if (!email || !targetCompanyId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email and companyId are required' }) }
    }

    if (!targetCompanyName) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', targetCompanyId)
        .maybeSingle()
      targetCompanyName = company?.name || null
    }

    // Don't pass signup_app metadata — the DB trigger on auth.users
    // causes "database error saving new user". We handle user_app_access
    // and company_members manually below with the service role client.
    // Netlify's URL env var points to the *.netlify.app hostname, so prefer
    // an explicit app URL for auth emails and fall back to the custom domain.
    const siteUrl =
      process.env.INVITE_REDIRECT_URL ||
      process.env.APP_URL ||
      (process.env.CONTEXT === 'production' ? 'https://restopay.xyz' : (process.env.URL || 'http://localhost:8888'))
    const appName = process.env.APP_NAME || 'RestoPay'

    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: {
        app_name: appName,
        app_url: siteUrl,
        company_name: targetCompanyName,
        invited_role: role,
      },
    })

    if (inviteError) {
      return { statusCode: 400, body: JSON.stringify({ error: inviteError.message }) }
    }

    // Grant app access (replaces what the DB trigger would have done)
    const { error: accessError } = await supabase
      .from('user_app_access')
      .upsert({ user_id: invited.user.id, app_name: 'fupm' }, { onConflict: 'user_id,app_name' })

    if (accessError) {
      console.error('user_app_access upsert error:', accessError)
      // Non-fatal — user was created, access can be granted manually
    }

    // Add to company_members
    const { error: memberError } = await supabase
      .from('company_members')
      .upsert({
        user_id:      invited.user.id,
        company_id:   targetCompanyId,
        role,
        display_name: displayName || null,
        rep_phone:    repPhone    || null,
        rep_email:    repEmail    || null,
      }, { onConflict: 'user_id,company_id' })

    if (memberError) {
      return { statusCode: 500, body: JSON.stringify({ error: memberError.message }) }
    }

    // Seed default templates if this company has none yet
    const { count } = await supabase
      .from('letter_templates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', targetCompanyId)
    if (count === 0) {
      try { await seedDefaultTemplates(supabase, targetCompanyId) }
      catch (e) { console.error('Template seed error:', e.message) }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, userId: invited.user.id }) }
  } catch (err) {
    console.error('admin-invite-user error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
