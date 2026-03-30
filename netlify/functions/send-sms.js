import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { toE164 } from '../../src/lib/formatters.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  // Auth: validate session token from Authorization header
  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: 'Unauthorized' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

  const { smsBody, pdfUrl, toPhone, attachmentUrl, jobName, companyId } = JSON.parse(event.body)

  if (!smsBody || !toPhone || !companyId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  try {
    // Load company settings for credentials
    const { data: settings } = await supabase
      .from('company_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
      .eq('company_id', companyId)
      .single()

    const sid   = settings?.twilio_account_sid  || process.env.TWILIO_ACCOUNT_SID
    const token = settings?.twilio_auth_token   || process.env.TWILIO_AUTH_TOKEN
    const from  = settings?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER

    const client = twilio(sid, token)

    // Shorten PDF URL via TinyURL (free, no auth required)
    let shortUrl = pdfUrl
    if (pdfUrl) {
      try {
        const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(pdfUrl)}`)
        if (tinyRes.ok) shortUrl = (await tinyRes.text()).trim()
      } catch {
        // Non-fatal — fall back to full URL
      }
    }

    let finalBody = shortUrl ? `${smsBody}\n${shortUrl}` : smsBody

    if (attachmentUrl) {
      let shortAttachUrl = attachmentUrl
      try {
        const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(attachmentUrl)}`)
        if (tinyRes.ok) shortAttachUrl = await tinyRes.text()
      } catch {}
      finalBody += `\n\nAttachment: ${shortAttachUrl}`
    }

    const message = await client.messages.create({
      body: finalBody,
      from,
      to: toE164(toPhone),
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sid: message.sid }),
    }
  } catch (err) {
    console.error('send-sms error:', err)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}
