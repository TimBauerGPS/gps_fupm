import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Run via Supabase SQL API
const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
  method: 'GET',
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
})

// Use the postgres endpoint directly
const sqlRes = await fetch(`${env.SUPABASE_URL}/pg/query`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: 'ALTER TABLE letter_templates ADD COLUMN IF NOT EXISTS requires_attachment boolean NOT NULL DEFAULT false' }),
})

if (!sqlRes.ok) {
  // Fallback: try updating a row to see if column already exists
  const { data, error } = await supabase
    .from('letter_templates')
    .select('requires_attachment')
    .limit(1)

  if (error?.message?.includes('column') && error.message.includes('does not exist')) {
    console.error('Column does not exist and could not be created automatically.')
    console.error('Please run this SQL in your Supabase dashboard SQL editor:')
    console.error('ALTER TABLE letter_templates ADD COLUMN IF NOT EXISTS requires_attachment boolean NOT NULL DEFAULT false;')
    process.exit(1)
  } else if (!error) {
    console.log('✓ Column requires_attachment already exists.')
  } else {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
} else {
  console.log('✓ Migration applied: requires_attachment column added.')
}
