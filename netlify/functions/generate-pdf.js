import { createClient } from '@supabase/supabase-js'
import htmlPdf from 'html-pdf-node'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { renderedHtml, jobName, companyId } = JSON.parse(event.body)

  if (!renderedHtml || !jobName || !companyId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  try {
    const options = {
      format: 'Letter',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    }
    const pdfBuffer = await htmlPdf.generatePdf({ content: renderedHtml }, options)

    const filename = `${jobName}-${Date.now()}.pdf`
    const path = `${companyId}/${filename}`

    const { data, error } = await supabase.storage
      .from('generated-letters')
      .upload(path, pdfBuffer, { contentType: 'application/pdf' })

    if (error) throw error

    // Use a signed URL (7 days) so PostGrid can always download it
    // regardless of whether the bucket is set to public
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
