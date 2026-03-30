import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const token = event.headers.authorization?.replace('Bearer ', '')
  if (!token) return { statusCode: 401, body: 'Unauthorized' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

  const { emailSubject, emailBodyText, pdfUrl, attachmentUrl, attachmentName, toEmail, replyTo, jobName, companyId } = JSON.parse(event.body)

  if (!emailSubject || !toEmail || !companyId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('resend_api_key, company_name, resend_from_domain, albi_bcc_email')
      .eq('company_id', companyId)
      .single()

    const apiKey = settings?.resend_api_key || process.env.RESEND_API_KEY
    const resend = new Resend(apiKey)

    // Fetch PDF as buffer for attachment
    const attachments = []
    if (pdfUrl) {
      const pdfRes = await fetch(pdfUrl)
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
      attachments.push({
        filename: `${jobName}-letter.pdf`,
        content: pdfBuffer,
      })
    }

    if (attachmentUrl) {
      try {
        const attachRes = await fetch(attachmentUrl)
        const attachBuffer = Buffer.from(await attachRes.arrayBuffer())
        attachments.push({
          filename: attachmentName || 'attachment',
          content: attachBuffer,
        })
      } catch (err) {
        console.error('Failed to fetch attachment:', err)
      }
    }

    const fromDomain = settings?.resend_from_domain || process.env.RESEND_FROM_DOMAIN || 'alliedrestoration.com'
    const fromName = settings?.company_name || 'Allied Restoration'
    const bcc = settings?.albi_bcc_email ? [settings.albi_bcc_email] : []

    const { data, error } = await resend.emails.send({
      from: `${fromName} <noreply@${fromDomain}>`,
      to: [toEmail],
      ...(replyTo ? { reply_to: replyTo } : {}),
      bcc,
      subject: emailSubject,
      text: emailBodyText || '',
      attachments,
    })

    if (error) throw new Error(error.message)

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, emailId: data?.id }),
    }
  } catch (err) {
    console.error('send-email error:', err)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}
