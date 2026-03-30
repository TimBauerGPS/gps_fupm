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
  if (!token) return { statusCode: 401, body: 'Unauthorized' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

  const body = JSON.parse(event.body)

  const { error } = await supabase.from('communication_history').insert({
    company_id:         body.companyId,
    job_name:           body.jobName,
    template_id:        body.templateId,
    template_name:      body.templateName,
    sent_by:            user.id,
    sent_by_name:       body.sentByName,
    channels:           body.channels,
    amount_due:         body.amountDue,
    sms_status:         body.smsStatus,
    mail_status:        body.mailStatus,
    email_status:       body.emailStatus,
    sms_error:          body.smsError,
    mail_error:         body.mailError,
    email_error:        body.emailError,
    postgrid_letter_id: body.postGridLetterId,
    twilio_message_sid: body.twilioMessageSid,
    rendered_body:      body.renderedBody,
    email_subject:      body.emailSubject,
    email_body_text:    body.emailBodyText,
    sms_body:           body.smsBody,
    recipient_name:     body.recipientName,
    recipient_email:    body.recipientEmail,
    recipient_phone:    body.recipientPhone,
    mailing_address:    body.mailingAddress,
  })

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
