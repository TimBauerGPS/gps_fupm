import { createClient } from '@supabase/supabase-js'
import { authenticateExternalApiKey } from './_externalApiAuth.js'
import { jsonResponse } from './_externalApiKeyCore.js'
import { buildFupmJobUrl, projectExistsForCompany, validateProjectName } from './_externalProject.js'

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

  try {
    const exists = await projectExistsForCompany(supabase, auth.companyId, projectValidation.projectName)
    if (!exists) return jsonResponse(404, { error: 'Project not found' })

    return jsonResponse(200, {
      projectName: projectValidation.projectName,
      fupmJobUrl: buildFupmJobUrl(projectValidation.projectName),
    })
  } catch (error) {
    return jsonResponse(500, { error: error.message })
  }
}
