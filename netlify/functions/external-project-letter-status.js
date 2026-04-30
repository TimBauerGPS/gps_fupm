import { createClient } from '@supabase/supabase-js'
import { authenticateExternalApiKey } from './_externalApiAuth.js'
import { jsonResponse } from './_externalApiKeyCore.js'
import {
  buildFupmJobUrl,
  mapStatusResponse,
  projectExistsForCompany,
  validateLetterSlug,
  validateProjectName,
} from './_externalProject.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' })
  }

  const auth = await authenticateExternalApiKey(event, supabase)
  if (auth.response) return auth.response

  const projectValidation = validateProjectName(event.queryStringParameters?.projectName)
  if (projectValidation.response) return projectValidation.response

  const slugValidation = validateLetterSlug(event.queryStringParameters?.letterSlug)
  if (slugValidation.response) return slugValidation.response

  try {
    const exists = await projectExistsForCompany(supabase, auth.companyId, projectValidation.projectName)
    if (!exists) return jsonResponse(404, { error: 'Project not found' })

    const { data: row, error } = await supabase
      .from('communication_history')
      .select('letter_api_slug, template_name, sent_at, channels, mail_status, email_status, sms_status')
      .eq('company_id', auth.companyId)
      .eq('job_name', projectValidation.projectName)
      .eq('letter_api_slug', slugValidation.letterSlug)
      .or('mail_status.eq.sent,email_status.eq.sent,sms_status.eq.sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return jsonResponse(500, { error: error.message })

    return jsonResponse(200, mapStatusResponse({
      projectName: projectValidation.projectName,
      fupmJobUrl: buildFupmJobUrl(projectValidation.projectName),
      letterSlug: slugValidation.letterSlug,
      row,
    }))
  } catch (error) {
    return jsonResponse(500, { error: error.message })
  }
}
