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

  const body = JSON.parse(event.body || '{}')
  if (!body.companyId || !body.jobName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'companyId and jobName are required' }) }
  }

  const { data: member, error: memberError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('company_id', body.companyId)
    .maybeSingle()

  if (memberError) {
    return { statusCode: 500, body: JSON.stringify({ error: memberError.message }) }
  }
  if (!member) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  const { data: job, error: jobError } = await supabase
    .from('albi_jobs')
    .select('name')
    .eq('company_id', member.company_id)
    .eq('name', body.jobName)
    .maybeSingle()

  if (jobError) {
    return { statusCode: 500, body: JSON.stringify({ error: jobError.message }) }
  }
  if (!job) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) }
  }

  let template = null
  if (body.templateId) {
    const { data, error } = await supabase
      .from('letter_templates')
      .select('id, name, api_slug')
      .eq('company_id', member.company_id)
      .eq('id', body.templateId)
      .maybeSingle()

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
    }
    if (!data) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Template not found for this company' }) }
    }
    template = data
  }

  const { error } = await supabase.from('communication_history').insert({
    company_id:         member.company_id,
    job_name:           body.jobName,
    template_id:        template?.id || null,
    template_name:      template?.name || body.templateName || 'Communication',
    letter_api_slug:    template?.api_slug || null,
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
