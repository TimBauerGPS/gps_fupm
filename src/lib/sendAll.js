/**
 * Orchestrates a multi-channel send.
 * Generates the PDF once and reuses the URL across all channels.
 */
export async function sendAll({
  channels,
  renderedHtml,
  smsBody,
  emailSubject,
  emailBodyText,
  job,
  companyId,
}) {
  let pdfUrl = null

  // Step 1: generate PDF once if any channel needs it
  if (channels.length > 0) {
    const res = await callFunction('generate-pdf', { renderedHtml, jobName: job.name, companyId })
    if (!res.ok) throw new Error(`PDF generation failed: ${res.error}`)
    pdfUrl = res.pdfUrl
  }

  // Step 2: fire all selected channels in parallel
  const tasks = []

  if (channels.includes('sms')) {
    tasks.push(
      callFunction('send-sms', { smsBody, pdfUrl, toPhone: job.customer_phone_number, jobName: job.name, companyId })
        .then(r => ({ channel: 'sms', ...r }))
        .catch(e => ({ channel: 'sms', ok: false, error: e.message }))
    )
  }

  if (channels.includes('mail')) {
    tasks.push(
      callFunction('send-mail', {
        pdfUrl,
        jobName: job.name,
        companyId,
        mailingAddress: {
          line1: job.mailing_address_1 || job.address_1,
          city:  job.mailing_city      || job.city,
          state: job.mailing_state     || job.state,
          zip:   job.mailing_zip_code  || job.zip_code,
        },
      })
        .then(r => ({ channel: 'mail', ...r }))
        .catch(e => ({ channel: 'mail', ok: false, error: e.message }))
    )
  }

  if (channels.includes('email')) {
    tasks.push(
      callFunction('send-email', {
        renderedHtml,
        emailSubject,
        emailBodyText,
        pdfUrl,
        toEmail: job.customer_email,
        jobName: job.name,
        companyId,
      })
        .then(r => ({ channel: 'email', ...r }))
        .catch(e => ({ channel: 'email', ok: false, error: e.message }))
    )
  }

  const results = await Promise.all(tasks)
  return { pdfUrl, results }
}

async function callFunction(name, body) {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error || res.statusText, ...data }
  return { ok: true, ...data }
}
