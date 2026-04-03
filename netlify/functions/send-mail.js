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

  const { pdfUrl, mailingAddress, mailRecipient, attachmentUrl, jobName, companyId } = JSON.parse(event.body)

  const missing = []
  if (!pdfUrl) missing.push('pdfUrl')
  if (!mailingAddress) missing.push('mailingAddress')
  if (!mailingAddress?.line1) missing.push('mailingAddress.line1 (street address)')
  if (!companyId) missing.push('companyId')
  if (missing.length > 0) {
    return { statusCode: 400, body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }) }
  }

  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('postgrid_api_key, company_name, address_line1, city, state, zip')
      .eq('company_id', companyId)
      .single()

    const apiKey = settings?.postgrid_api_key || process.env.POSTGRID_API_KEY

    const payload = {
      from: {
        companyName:    settings?.company_name  || 'Allied Restoration Services Inc.',
        addressLine1:   settings?.address_line1 || '',
        city:           settings?.city          || '',
        provinceOrState: settings?.state        || '',
        postalOrZip:    settings?.zip           || '',
        country:        'US',
        countryCode:    'US',
      },
      to: buildToContact(mailRecipient, mailingAddress),
      pdf: pdfUrl,
      addressPlacement: 'insert_blank_page',
      skipVerification: true,
    }

    if (attachmentUrl) {
      // PostGrid rejects letters that define both `pdf` and `attachedPDF`.
      // We always send the generated letter PDF here, so extra attachments
      // must be ignored for mail until we support merging PDFs before upload.
      console.warn('Ignoring mail attachment because PostGrid does not accept attachedPDF alongside pdf', {
        jobName,
        companyId,
      })
    }

    const res = await fetch('https://api.postgrid.com/print-mail/v1/letters', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.error?.message || data?.message || data?.error || JSON.stringify(data)
      console.error('PostGrid error:', JSON.stringify(data, null, 2))
      return { statusCode: res.status, body: JSON.stringify({ ok: false, error: `PostGrid: ${errMsg}` }) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, postGridLetterId: data.id }),
    }
  } catch (err) {
    console.error('send-mail error:', err)
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}

function buildToContact(recipient, mailingAddress) {
  const { companyName = '', firstName = '', lastName = '' } = recipient || {}
  const hasCompany = companyName.trim().length > 0
  const hasPerson  = (firstName + lastName).trim().length > 0

  const contact = {
    addressLine1:    mailingAddress.line1,
    city:            mailingAddress.city,
    provinceOrState: mailingAddress.state,
    postalOrZip:     String(mailingAddress.zip || ''),
    country:         'US',
    countryCode:     'US',
  }

  if (hasCompany) {
    contact.companyName = companyName.trim()
    if (hasPerson) {
      // PostGrid renders company + person as "Company Name\nc/o First Last"
      contact.firstName = `c/o ${firstName.trim()}`
      contact.lastName  = lastName.trim()
    }
  } else {
    contact.firstName = firstName.trim()
    contact.lastName  = lastName.trim()
  }

  return contact
}
