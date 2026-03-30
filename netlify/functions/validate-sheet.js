import { SignJWT, importPKCS8 } from 'jose'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) }
  }

  let sheetUrl
  try {
    const body = JSON.parse(event.body || '{}')
    sheetUrl = body.sheetUrl
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid request body.' }) }
  }

  if (!sheetUrl) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'No sheet URL provided.' }) }
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!saJson) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: 'Google service account not configured.' }),
    }
  }

  let serviceAccount
  try {
    const decoded = Buffer.from(saJson, 'base64').toString('utf8')
    serviceAccount = JSON.parse(decoded)
  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: 'Google service account credentials are malformed.' }),
    }
  }

  const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!sheetIdMatch) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: 'Could not extract spreadsheet ID from URL. Make sure it is a valid Google Sheets URL.' }),
    }
  }
  const sheetId = sheetIdMatch[1]

  try {
    const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256')
    const now = Math.floor(Date.now() / 1000)
    const jwt = await new SignJWT({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    const tokenData = await tokenRes.json()
    const access_token = tokenData.access_token

    if (!access_token) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: 'Could not obtain Google access token. Check service account credentials.' }),
      }
    }

    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )

    if (!sheetRes.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: 'Could not access sheet. Make sure it is shared with the service account.' }),
      }
    }

    const spreadsheet = await sheetRes.json()
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, title: spreadsheet.properties?.title }),
    }
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: 'Could not access sheet. Make sure it is shared with the service account.' }),
    }
  }
}
