import { createClient } from '@supabase/supabase-js'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

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

  let browser = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setContent(renderedHtml, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
      printBackground: true,
    })

    await browser.close()
    browser = null

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
    if (browser) await browser.close().catch(() => {})
    console.error('generate-pdf error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
