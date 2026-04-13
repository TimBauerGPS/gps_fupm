import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import { PDFDocument } from 'pdf-lib'

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

  const { renderedHtml, jobName, companyId, attachmentUrl, attachmentType } = JSON.parse(event.body)

  if (!renderedHtml || !jobName || !companyId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  const { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('pdfshift_api_key')
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsError) {
    return { statusCode: 500, body: JSON.stringify({ error: settingsError.message }) }
  }

  const apiKey = settings?.pdfshift_api_key
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'PDFShift API key not configured for this company' }) }
  }

  try {
    const letterPdfBuffer = await convertHtmlToPdf(renderedHtml, apiKey)
    let finalPdfBuffer = letterPdfBuffer

    if (attachmentUrl) {
      const attachmentRes = await fetch(attachmentUrl)
      if (!attachmentRes.ok) throw new Error(`Attachment fetch failed: ${attachmentRes.status}`)
      const attachmentBuffer = Buffer.from(await attachmentRes.arrayBuffer())

      if (attachmentType === 'application/pdf') {
        finalPdfBuffer = await mergePdfBuffers([letterPdfBuffer, attachmentBuffer])
      } else if (attachmentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const { value: attachmentHtml } = await mammoth.convertToHtml({ buffer: attachmentBuffer })
        const attachmentPdfBuffer = await convertHtmlToPdf(attachmentHtml, apiKey)
        finalPdfBuffer = await mergePdfBuffers([letterPdfBuffer, attachmentPdfBuffer])
      } else {
        throw new Error('Unsupported attachment type')
      }
    }

    const filename = `${jobName}-${Date.now()}.pdf`
    const storagePath = `${companyId}/${filename}`

    const { data, error } = await supabase.storage
      .from('generated-letters')
      .upload(storagePath, finalPdfBuffer, { contentType: 'application/pdf' })

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

async function convertHtmlToPdf(renderedHtml, apiKey) {
  const fullHtml = renderedHtml.trimStart().startsWith('<!DOCTYPE') || renderedHtml.trimStart().startsWith('<html')
    ? renderedHtml
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;}img{max-width:100%;}table{border-collapse:collapse;}p{margin:0 0 1em;}</style></head><body>${renderedHtml}</body></html>`

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

  return Buffer.from(await pdfRes.arrayBuffer())
}

async function mergePdfBuffers(buffers) {
  const merged = await PDFDocument.create()

  for (const buffer of buffers) {
    const src = await PDFDocument.load(buffer)
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }

  return Buffer.from(await merged.save())
}
