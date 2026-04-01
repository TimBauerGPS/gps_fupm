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

  const { renderedHtml, jobName, companyId } = JSON.parse(event.body)

  if (!renderedHtml || !jobName || !companyId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  const apiKey = process.env.PDFSHIFT_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'PDF service not configured (PDFSHIFT_API_KEY missing)' }) }
  }

  try {
    // Wrap in full HTML document if it's a fragment
    const fullHtml = renderedHtml.trimStart().startsWith('<!DOCTYPE') || renderedHtml.trimStart().startsWith('<html')
      ? renderedHtml
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;}</style></head><body>${renderedHtml}</body></html>`

    // Generate PDF via PDFShift API
    const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: fullHtml,
        format: 'Letter',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
      }),
    })

    if (!pdfRes.ok) {
      const errText = await pdfRes.text()
      throw new Error(`PDFShift error ${pdfRes.status}: ${errText}`)
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    const filename = `${jobName}-${Date.now()}.pdf`
    const storagePath = `${companyId}/${filename}`

    const { data, error } = await supabase.storage
      .from('generated-letters')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })

    if (error) throw error

    const { data: signedData, error: signedError } = await supabase.storage
      .from('generated-letters')
      .createSignedUrl(data.path, 60 * 60 * 24 * 7)

    if (signedError) throw signedError

    return {
      statusCode: 200,
      body: JSON.stringify({ pdfUrl: signedData.signedUrl }),
    }
  } catch (err) {
    console.error('generate-pdf error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
