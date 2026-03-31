import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function normalizePhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.substring(1)
  return digits.length === 10 ? digits : null
}

function parseTwilioBody(body) {
  const params = {}
  for (const pair of body.split('&')) {
    const [k, v] = pair.split('=')
    params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '))
  }
  return params
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const params = parseTwilioBody(event.body || '')
  const { From, To, Body, MessageSid } = params

  if (!From || !Body) {
    return { statusCode: 400, body: '<?xml version="1.0" encoding="UTF-8"?><Response/>' }
  }

  const fromPhone = normalizePhone(From)
  const toPhone   = normalizePhone(To)

  if (!fromPhone) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    }
  }

  try {
    // Find which company owns this Twilio number
    let companyId = null
    if (toPhone) {
      const { data: settingsRows } = await supabase
        .from('company_settings')
        .select('company_id, twilio_phone_number')

      for (const row of settingsRows || []) {
        if (normalizePhone(row.twilio_phone_number) === toPhone) {
          companyId = row.company_id
          break
        }
      }
    }

    // Try to match a job from the most recent outbound SMS to this number
    let jobName = null
    if (companyId) {
      const { data: recent } = await supabase
        .from('communication_history')
        .select('job_name')
        .eq('company_id', companyId)
        .eq('recipient_phone', fromPhone)
        .contains('channels', ['sms'])
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      jobName = recent?.job_name || null
    }

    // Deduplicate by twilio_sid
    if (MessageSid) {
      const { data: existing } = await supabase
        .from('sms_inbound')
        .select('id')
        .eq('twilio_sid', MessageSid)
        .maybeSingle()
      if (existing) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/xml' },
          body: '<?xml version="1.0" encoding="UTF-8"?><Response/>',
        }
      }
    }

    await supabase.from('sms_inbound').insert({
      company_id:  companyId,
      from_phone:  fromPhone,
      to_phone:    toPhone,
      body:        Body,
      twilio_sid:  MessageSid || null,
      job_name:    jobName,
    })
  } catch (err) {
    console.error('twilio-inbound-sms error:', err.message)
    // Still return 200 so Twilio doesn't retry endlessly
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: '<?xml version="1.0" encoding="UTF-8"?><Response/>',
  }
}
