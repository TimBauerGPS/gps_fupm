import { jsonResponse } from './_externalApiKeyCore.js'

const VALID_LETTER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function buildFupmJobUrl(
  projectName,
  baseUrl = process.env.FUPM_APP_BASE_URL || process.env.URL || 'https://fupm.netlify.app'
) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '')
  return `${normalizedBaseUrl}/jobs/${encodeURIComponent(projectName)}`
}

export function hasSuccessfulChannel(row = {}) {
  return row.mail_status === 'sent' || row.email_status === 'sent' || row.sms_status === 'sent'
}

export function mapHistoryRow(row = {}) {
  return {
    letterSlug: row.letter_api_slug,
    templateName: row.template_name,
    sentAt: row.sent_at,
    channels: row.channels || [],
    statuses: {
      mail: row.mail_status || null,
      email: row.email_status || null,
      sms: row.sms_status || null,
    },
  }
}

export function mapStatusResponse({ projectName, fupmJobUrl, letterSlug, row }) {
  const mapped = row && hasSuccessfulChannel(row) ? mapHistoryRow(row) : null

  return {
    projectName,
    fupmJobUrl,
    letterSlug,
    sent: Boolean(mapped),
    sentAt: mapped?.sentAt || null,
    templateName: mapped?.templateName || null,
    channels: mapped?.channels || [],
    statuses: mapped?.statuses || { mail: null, email: null, sms: null },
  }
}

export async function projectExistsForCompany(supabase, companyId, projectName) {
  const { data: job, error: jobError } = await supabase
    .from('albi_jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', projectName)
    .maybeSingle()

  if (jobError) throw jobError
  if (job) return true

  const { data: historyRow, error: historyError } = await supabase
    .from('communication_history')
    .select('id')
    .eq('company_id', companyId)
    .eq('job_name', projectName)
    .limit(1)
    .maybeSingle()

  if (historyError) throw historyError
  return Boolean(historyRow)
}

export function validateProjectName(value) {
  const projectName = String(value || '').trim()
  if (!projectName) {
    return { response: jsonResponse(422, { error: 'projectName is required' }) }
  }
  return { projectName }
}

export function validateLetterSlug(value) {
  const letterSlug = String(value || '').trim()
  if (!VALID_LETTER_SLUG.test(letterSlug)) {
    return { response: jsonResponse(422, { error: 'letterSlug is invalid' }) }
  }
  return { letterSlug }
}
