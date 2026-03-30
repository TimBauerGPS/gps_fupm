import { createClient } from '@supabase/supabase-js'
import { parseAlbiRows } from '../../src/lib/albiImport.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { companyId } = JSON.parse(event.body || '{}')
    if (!companyId) return { statusCode: 400, body: JSON.stringify({ error: 'companyId required' }) }

    // Get sheet URL for this company
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('albi_sheet_url')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsError) throw settingsError
    if (!settings?.albi_sheet_url) {
      return { statusCode: 200, body: JSON.stringify({ error: 'No Google Sheet URL configured for this company.' }) }
    }

    const sheetId = extractSheetId(settings.albi_sheet_url)
    if (!sheetId) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Invalid Google Sheet URL.' }) }
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Google service account not configured on the server.' }) }
    }

    const raw = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
    const serviceAccount = JSON.parse(raw)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    const rows = await fetchSheetRows(sheetId, accessToken)
    const jobs = parseAlbiRows(rows)

    if (jobs.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Sheet is accessible but no valid job rows were found. Check that the sheet has a "Name" column header.' }) }
    }

    const upsertRows = jobs.map(j => ({ ...j, company_id: companyId }))
    const { error: upsertError } = await supabase
      .from('albi_jobs')
      .upsert(upsertRows, { onConflict: 'company_id,name' })

    if (upsertError) throw upsertError

    await supabase
      .from('company_settings')
      .update({ albi_last_synced_at: new Date().toISOString() })
      .eq('company_id', companyId)

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, count: jobs.length }),
    }
  } catch (err) {
    console.error('sync-now error:', err)
    return { statusCode: 200, body: JSON.stringify({ error: err.message }) }
  }
}

function extractSheetId(url) {
  const match = url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

async function fetchSheetRows(sheetId, accessToken) {
  // Use includeGridData to capture hyperlinks per cell.
  // cell.hyperlink covers =HYPERLINK() formulas.
  // Cmd+K "insert link" hyperlinks are stored as textFormatRuns — NOT in cell.hyperlink.
  // We must request textFormatRuns and check format.link.uri for those.
  // Try named range 'data' first, fall back to the full sheet.
  for (const range of ['data', 'A:ZZ']) {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
      `?includeGridData=true&ranges=${encodeURIComponent(range)}` +
      `&fields=sheets(data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri)))))))`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) continue
    const json = await res.json()
    const rowData = json.sheets?.[0]?.data?.[0]?.rowData
    if (!rowData?.length) continue
    const result = rowData.map(row =>
      (row.values || []).map(cell => {
        // 1. =HYPERLINK() formula or cell-level hyperlink
        if (cell.hyperlink) return cell.hyperlink
        // 2. Cmd+K "insert link" — stored in textFormatRuns
        if (cell.textFormatRuns?.length) {
          for (const run of cell.textFormatRuns) {
            if (run.format?.link?.uri) return run.format.link.uri
          }
        }
        return cell.formattedValue || ''
      })
    )

    // Debug: log what value the "Link to Project" column resolved to for the first few rows
    if (result.length > 1) {
      const headers = result[0]
      const linkIdx = headers.findIndex(h => h?.toString().trim() === 'Link to Project')
      console.log('sync-now DEBUG: "Link to Project" column index:', linkIdx)
      if (linkIdx !== -1) {
        result.slice(1, 4).forEach((row, i) => {
          console.log(`sync-now DEBUG: row ${i + 1} raw cell object:`, JSON.stringify(rowData[i + 1]?.values?.[linkIdx]))
          console.log(`sync-now DEBUG: row ${i + 1} resolved value:`, row[linkIdx])
        })
      }
    }

    return result
  }
  throw new Error('Could not read any data from the sheet. Make sure it has data and is shared correctly.')
}

async function getGoogleAccessToken(serviceAccount) {
  const { SignJWT, importPKCS8 } = await import('jose')
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get Google access token. Check service account credentials.')
  return data.access_token
}
