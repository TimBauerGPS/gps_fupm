import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

function formatPhone(digits) {
  if (!digits || digits.length !== 10) return digits
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

const TWIML_OK = { statusCode: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response/>' }

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('twilio-inbound-sms: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    return TWIML_OK
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const params = parseTwilioBody(event.body || '')
  const { From, To, Body, MessageSid } = params

  if (!From || !Body) return TWIML_OK

  const fromPhone = normalizePhone(From)
  const toPhone   = normalizePhone(To)
  if (!fromPhone) return TWIML_OK

  try {
    // Find which company owns this Twilio number
    let companyId = null
    let settings  = null
    if (toPhone) {
      const { data: settingsRows } = await supabase
        .from('company_settings')
        .select('company_id, twilio_phone_number, resend_api_key, resend_from_domain, albi_bcc_email, company_name')
      for (const row of settingsRows || []) {
        if (normalizePhone(row.twilio_phone_number) === toPhone) {
          companyId = row.company_id
          settings  = row
          break
        }
      }
    }

    // Find the most recent outbound SMS to this number — gives us job, customer name, and rep
    let jobName      = null
    let customerName = null
    let repName      = null
    if (companyId) {
      const { data: recent } = await supabase
        .from('communication_history')
        .select('job_name, recipient_name, sent_by_name')
        .eq('company_id', companyId)
        .eq('recipient_phone', fromPhone)
        .contains('channels', ['sms'])
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      jobName      = recent?.job_name      || null
      customerName = recent?.recipient_name || null
      repName      = recent?.sent_by_name   || null
    }

    // Deduplicate by twilio_sid
    if (MessageSid) {
      const { data: existing } = await supabase
        .from('sms_inbound').select('id').eq('twilio_sid', MessageSid).maybeSingle()
      if (existing) return TWIML_OK
    }

    await supabase.from('sms_inbound').insert({
      company_id: companyId,
      from_phone: fromPhone,
      to_phone:   toPhone,
      body:       Body,
      twilio_sid: MessageSid || null,
      job_name:   jobName,
    })

    // Send email notification to the rep who last texted this customer
    if (companyId && repName && settings) {
      const { data: member } = await supabase
        .from('company_members')
        .select('rep_email')
        .eq('company_id', companyId)
        .eq('display_name', repName)
        .maybeSingle()

      const repEmail    = member?.rep_email || null
      const albiEmail   = settings.albi_bcc_email || null
      const toAddresses = [repEmail, albiEmail].filter(Boolean)

      if (toAddresses.length > 0) {
        const apiKey    = settings.resend_api_key || process.env.RESEND_API_KEY
        const fromDomain = settings.resend_from_domain || process.env.RESEND_FROM_DOMAIN || 'fupm.netlify.app'
        const fromName  = settings.company_name || 'FUPM'
        const jobLabel  = jobName || 'Unknown Job'
        const custLabel = customerName || formatPhone(fromPhone)
        const inboxUrl  = `https://fupm.netlify.app/inbox`
        const jobUrl    = jobName ? `https://fupm.netlify.app/jobs/${encodeURIComponent(jobName)}` : null

        const subject = `New SMS reply — ${jobLabel}: ${custLabel}`

        const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">New inbound SMS reply</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr>
      <td style="padding:8px 16px 8px 0;font-weight:700;color:#374151;white-space:nowrap;vertical-align:top">From</td>
      <td style="padding:8px 0;color:#111827">${custLabel}${fromPhone ? ` (+1${fromPhone})` : ''}</td>
    </tr>
    <tr>
      <td style="padding:8px 16px 8px 0;font-weight:700;color:#374151;white-space:nowrap;vertical-align:top">Job</td>
      <td style="padding:8px 0">
        ${jobUrl ? `<a href="${jobUrl}" style="color:#2563eb;text-decoration:none;font-weight:600">${jobLabel}</a>` : jobLabel}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 16px 8px 0;font-weight:700;color:#374151;white-space:nowrap;vertical-align:top">Message</td>
      <td style="padding:8px 0;color:#111827">${Body}</td>
    </tr>
  </table>
  <div style="margin-top:24px">
    <a href="${inboxUrl}" style="color:#2563eb;font-size:14px;text-decoration:none">View in FUPM Inbox →</a>
  </div>
</div>`

        const resend = new Resend(apiKey)
        await resend.emails.send({
          from:    `${fromName} <noreply@${fromDomain}>`,
          to:      toAddresses,
          subject,
          html,
        }).catch(err => console.error('notification email failed:', err.message))
      }
    }
  } catch (err) {
    console.error('twilio-inbound-sms error:', err.message)
  }

  return TWIML_OK
}
