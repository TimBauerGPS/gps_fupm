/**
 * Scheduled function: deletes PDFs from Supabase Storage older than 30 days.
 * Runs nightly at 02:00 UTC (6 PM PT).
 * History rows are preserved — only the stored file is deleted.
 * Old postgrid_letter_id / twilio_message_sid links become stale but history is intact.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'generated-letters'
const RETENTION_DAYS = 30

export const handler = async () => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

    // List all files in the bucket (paginate if needed)
    const allFiles = []
    let offset = 0
    const PAGE = 100

    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit: PAGE, offset, sortBy: { column: 'created_at', order: 'asc' } })

      if (error) throw new Error(`List error: ${error.message}`)
      if (!data || data.length === 0) break

      // Recurse into company_id subdirectories
      for (const item of data) {
        if (item.id === null) {
          // It's a folder — list its contents
          const { data: files, error: folderErr } = await supabase.storage
            .from(BUCKET)
            .list(item.name, { limit: 1000 })
          if (folderErr) continue
          for (const file of files || []) {
            const createdAt = new Date(file.created_at || file.updated_at)
            if (createdAt < cutoff) {
              allFiles.push(`${item.name}/${file.name}`)
            }
          }
        }
      }

      if (data.length < PAGE) break
      offset += PAGE
    }

    if (allFiles.length === 0) {
      console.log('cleanup-pdfs: nothing to delete')
      return { statusCode: 200, body: JSON.stringify({ deleted: 0 }) }
    }

    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(allFiles)

    if (deleteError) throw new Error(`Delete error: ${deleteError.message}`)

    console.log(`cleanup-pdfs: deleted ${allFiles.length} files older than ${RETENTION_DAYS} days`)
    return { statusCode: 200, body: JSON.stringify({ deleted: allFiles.length }) }

  } catch (err) {
    console.error('cleanup-pdfs error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
