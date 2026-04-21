import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_FIELDS = new Set([
  'pending_insurance_approval',
  'pending_invoice_date',
  'balance_override_amount',
])

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return json(401, { error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Unauthorized' })

  try {
    const { jobId, updates } = JSON.parse(event.body || '{}')
    if (!jobId || !updates || typeof updates !== 'object') {
      return json(400, { error: 'jobId and updates are required' })
    }

    const sanitized = {}
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_FIELDS.has(key)) continue
      sanitized[key] = normalizeValue(key, value)
    }

    if (Object.keys(sanitized).length === 0) {
      return json(400, { error: 'No supported fields to update' })
    }

    if (sanitized.pending_insurance_approval && !sanitized.pending_invoice_date && 'pending_invoice_date' in sanitized) {
      return json(400, { error: 'Invoice date is required when pending insurance approval is checked' })
    }

    const { data: job, error: jobError } = await supabase
      .from('albi_jobs')
      .select('id, company_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) throw jobError
    if (!job) return json(404, { error: 'Job not found' })

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', job.company_id)
      .maybeSingle()

    if (memberError) throw memberError
    if (!member) return json(403, { error: 'Not authorized for this job' })

    const { data, error } = await supabase
      .from('albi_jobs')
      .update(sanitized)
      .eq('id', jobId)
      .select('*')
      .single()

    if (error) throw error
    return json(200, { ok: true, job: data })
  } catch (err) {
    return json(500, { error: err.message })
  }
}

function normalizeValue(key, value) {
  if (key === 'pending_insurance_approval') return Boolean(value)
  if (key === 'pending_invoice_date') return value || null
  if (key === 'balance_override_amount') {
    if (value === '' || value === null || value === undefined) return null
    const n = Number(value)
    if (!Number.isFinite(n)) throw new Error('Balance must be a valid number')
    return n
  }
  return value
}

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) }
}
