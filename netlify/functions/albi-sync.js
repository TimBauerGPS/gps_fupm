import { createClient } from '@supabase/supabase-js'
import { parseAlbiRows } from '../../src/lib/albiImport.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async () => {
  console.log('albi-sync: starting nightly Google Sheets sync')

  try {
    // Get all companies with a sheet URL
    const { data: companies, error } = await supabase
      .from('company_settings')
      .select('company_id, albi_sheet_url, companies(name)')
      .not('albi_sheet_url', 'is', null)

    if (error) throw error

    const raw = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
    const serviceAccount = JSON.parse(raw)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    const results = []

    for (const { company_id, albi_sheet_url, companies: company } of companies) {
      if (company?.name !== 'Allied Restoration Services') continue
      try {
        const sheetId = extractSheetId(albi_sheet_url)
        if (!sheetId) {
          results.push({ company_id, error: 'Invalid sheet URL' })
          continue
        }

        const rows = await fetchSheetRows(sheetId, accessToken)
        const jobs = parseAlbiRows(rows)

        if (jobs.length === 0) {
          results.push({ company_id, imported: 0 })
          continue
        }

        const upsertRows = jobs.map(j => ({ ...j, company_id, balance_override_amount: null }))
        const { error: upsertError, count } = await supabase
          .from('albi_jobs')
          .upsert(upsertRows, { onConflict: 'company_id,name', count: 'exact' })

        if (upsertError) throw upsertError

        await supabase
          .from('company_settings')
          .update({ albi_last_synced_at: new Date().toISOString() })
          .eq('company_id', company_id)

        results.push({ company_id, imported: jobs.length })
      } catch (err) {
        console.error(`albi-sync: company ${company_id} failed:`, err)
        results.push({ company_id, error: err.message })
      }
    }

    console.log('albi-sync complete:', results)
    return { statusCode: 200, body: JSON.stringify(results) }
  } catch (err) {
    console.error('albi-sync fatal error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

async function fetchSheetRows(sheetId, accessToken) {
  // Use includeGridData to capture hyperlinks per cell.
  // cell.hyperlink covers =HYPERLINK() formulas.
  // Cmd+K "insert link" hyperlinks are stored as textFormatRuns — NOT in cell.hyperlink.
  // We must request textFormatRuns and check format.link.uri for those.
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `?includeGridData=true&ranges=data` +
    `&fields=sheets(data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri)))))))`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets API error: ${res.status} ${text}`)
  }
  const json = await res.json()
  const rowData = json.sheets?.[0]?.data?.[0]?.rowData || []

  return rowData.map(row =>
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
}

async function getGoogleAccessToken(serviceAccount) {
  // Build JWT for Google service account
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const { SignJWT, importPKCS8 } = await import('jose')
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256')
  const jwt = await new SignJWT(claim)
    .setProtectedHeader(header)
    .sign(privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get Google access token')
  return data.access_token
}
