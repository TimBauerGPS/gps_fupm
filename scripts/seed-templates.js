/**
 * Seeds the 5 default letter templates for a company.
 * Run from the project root: node scripts/seed-templates.js
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { seedDefaultTemplates } from '../supabase/seed/default-templates.js'

// Parse .env.local without requiring dotenv
const envContent = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const COMPANY_ID = 'e0ada35f-e20f-41d1-b067-ab06fb27ebcd'

const count = await seedDefaultTemplates(supabase, COMPANY_ID)
console.log(`✓ Seeded ${count} templates for company ${COMPANY_ID}`)
