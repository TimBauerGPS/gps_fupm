# External Letter History API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the company-scoped external API for FUPM letter type mapping, project letter history lookup, specific sent-letter status, and login-protected FUPM job links.

**Architecture:** Add stable FUPM letter slugs to templates and communication history, then expose read-only Netlify Functions authenticated by hashed external API keys. Keep the API key management surface behind a server-enforced allowlist for `tbauer+allied@alliedrestoration.com`, and keep every external read scoped to the company assigned to the key.

**Tech Stack:** Vite + React 18, Netlify Functions with ES modules, Supabase service-role backend client, Postgres migrations, Node built-in `crypto`, Node built-in test runner.

---

## File Structure

- `supabase/migrations/012_external_letter_history_api.sql`: Adds external API keys, template slugs, history slug snapshots, indexes, RLS, and backfills.
- `src/lib/templateSlug.js`: Browser/server-safe slug helper for FUPM letter type slugs.
- `tests/templateSlug.test.mjs`: Unit coverage for slug normalization.
- `netlify/functions/_externalApiKeyCore.js`: API key generation, hashing, prefixing, bearer extraction, JSON helper.
- `netlify/functions/_externalApiAuth.js`: External API-key auth and company-scope derivation.
- `netlify/functions/_externalProject.js`: Project existence checks, FUPM job URL builder, safe history response mappers.
- `netlify/functions/external-letter-types.js`: External catalog endpoint.
- `netlify/functions/external-project-link.js`: External FUPM job deep-link endpoint.
- `netlify/functions/external-project-letters.js`: External project history listing endpoint.
- `netlify/functions/external-project-letter-status.js`: External specific letter status endpoint.
- `netlify/functions/external-api-keys.js`: Internal allowlisted API key list/create function.
- `netlify/functions/external-api-key-revoke.js`: Internal allowlisted API key revoke function.
- `tests/externalApiKeyCore.test.mjs`: Unit coverage for API key helper behavior.
- `tests/externalProjectHelpers.test.mjs`: Unit coverage for safe response mapping and URL generation.
- `netlify.toml`: Adds redirects for clean external API paths before the generic `/api/*` redirect.
- `netlify/functions/save-history.js`: Persists `letter_api_slug`.
- `src/components/SendPanel.jsx`: Sends selected template slug to `save-history`.
- `src/components/settings/TemplateSettings.jsx`: Displays and saves stable template API slugs.
- `src/components/settings/ExternalApiKeySettings.jsx`: Settings UI for allowlisted key creation/revocation.
- `src/pages/Settings.jsx`: Shows the External API tab only to the allowlisted user.
- `docs/integrations/external-letter-history-api-reference.md`: Update status from planned to implemented after verification.

## Task 1: Data Model And Slug Plumbing

**Files:**
- Create: `supabase/migrations/012_external_letter_history_api.sql`
- Create: `src/lib/templateSlug.js`
- Create: `tests/templateSlug.test.mjs`
- Modify: `package.json`
- Modify: `src/components/settings/TemplateSettings.jsx`
- Modify: `src/components/SendPanel.jsx`
- Modify: `netlify/functions/save-history.js`

- [ ] **Step 1: Write failing slug tests**

Create `tests/templateSlug.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { slugifyLetterType, isValidLetterSlug } from '../src/lib/templateSlug.js'

test('slugifyLetterType creates machine-safe lowercase slugs', () => {
  assert.equal(slugifyLetterType('Request for Payment'), 'request-for-payment')
  assert.equal(slugifyLetterType('  Notice: Intent to File Lien!  '), 'notice-intent-to-file-lien')
  assert.equal(slugifyLetterType('Final___Notice'), 'final-notice')
})

test('slugifyLetterType falls back for empty names', () => {
  assert.equal(slugifyLetterType(''), 'template')
  assert.equal(slugifyLetterType(null), 'template')
})

test('isValidLetterSlug accepts only normalized slugs', () => {
  assert.equal(isValidLetterSlug('request-for-payment'), true)
  assert.equal(isValidLetterSlug('Request for Payment'), false)
  assert.equal(isValidLetterSlug('-request'), false)
  assert.equal(isValidLetterSlug('request-'), false)
})
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test tests/templateSlug.test.mjs
```

Expected: FAIL because `src/lib/templateSlug.js` does not exist.

- [ ] **Step 3: Implement the slug helper and test script**

Create `src/lib/templateSlug.js`:

```js
export function slugifyLetterType(value) {
  const slug = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || 'template'
}

export function isValidLetterSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''))
}
```

Modify `package.json` scripts:

```json
"test": "node --test tests"
```

- [ ] **Step 4: Run the slug test to verify GREEN**

Run:

```bash
npm test -- tests/templateSlug.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add database migration**

Create `supabase/migrations/012_external_letter_history_api.sql` with:

```sql
-- External letter history API support

alter table letter_templates
  add column if not exists api_slug text;

alter table communication_history
  add column if not exists letter_api_slug text;

create table if not exists external_api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  last_used_ip inet
);

alter table external_api_keys enable row level security;

drop policy if exists "service role manages external_api_keys" on external_api_keys;
create policy "service role manages external_api_keys"
  on external_api_keys for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function fupm_slugify_letter_type(input text)
returns text as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'template'
  );
$$ language sql immutable;

with template_slugs as (
  select
    id,
    fupm_slugify_letter_type(name) as base_slug,
    row_number() over (
      partition by company_id, fupm_slugify_letter_type(name)
      order by created_at, id
    ) as duplicate_number
  from letter_templates
  where api_slug is null
)
update letter_templates lt
set api_slug = case
  when ts.duplicate_number = 1 then ts.base_slug
  else ts.base_slug || '-' || ts.duplicate_number::text
end
from template_slugs ts
where lt.id = ts.id;

create unique index if not exists letter_templates_company_api_slug_unique
  on letter_templates(company_id, api_slug)
  where api_slug is not null;

create index if not exists external_api_keys_company_id_idx
  on external_api_keys(company_id);

create index if not exists external_api_keys_active_hash_idx
  on external_api_keys(key_hash)
  where revoked_at is null;

create index if not exists communication_history_external_lookup_idx
  on communication_history(company_id, job_name, letter_api_slug, sent_at desc);

update communication_history ch
set letter_api_slug = lt.api_slug
from letter_templates lt
where ch.template_id = lt.id
  and ch.letter_api_slug is null;

update communication_history
set letter_api_slug = fupm_slugify_letter_type(template_name)
where letter_api_slug is null;
```

- [ ] **Step 6: Update template settings to manage slugs**

Modify `src/components/settings/TemplateSettings.jsx`:

- Import `slugifyLetterType` and `isValidLetterSlug`.
- Add an `API Slug` input next to template name.
- For new templates, auto-fill slug from name until the user edits the slug.
- Save `api_slug` on insert/update.
- Show the slug badge in the template list.
- Reject invalid slugs client-side with a clear error.

- [ ] **Step 7: Snapshot slugs into history**

Modify `src/components/SendPanel.jsx` history payload:

```js
letterApiSlug: template?.api_slug,
```

Modify `netlify/functions/save-history.js` insert payload:

```js
letter_api_slug: body.letterApiSlug || null,
```

- [ ] **Step 8: Run verification**

Run:

```bash
npm test -- tests/templateSlug.test.mjs
npm run lint
```

Expected: both commands exit 0.

## Task 2: External Read API

**Files:**
- Create: `netlify/functions/_externalApiKeyCore.js`
- Create: `netlify/functions/_externalApiAuth.js`
- Create: `netlify/functions/_externalProject.js`
- Create: `netlify/functions/external-letter-types.js`
- Create: `netlify/functions/external-project-link.js`
- Create: `netlify/functions/external-project-letters.js`
- Create: `netlify/functions/external-project-letter-status.js`
- Create: `tests/externalApiKeyCore.test.mjs`
- Create: `tests/externalProjectHelpers.test.mjs`
- Modify: `netlify.toml`

- [ ] **Step 1: Write failing helper tests**

Create `tests/externalApiKeyCore.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractBearerToken,
  generateExternalApiKey,
  getExternalApiKeyPrefix,
  hashExternalApiKey,
} from '../netlify/functions/_externalApiKeyCore.js'

test('generateExternalApiKey returns a FUPM live key', () => {
  const key = generateExternalApiKey()
  assert.match(key, /^fupm_live_[A-Za-z0-9_-]{43}$/)
})

test('hashExternalApiKey is stable and does not expose plaintext', () => {
  const key = 'fupm_live_example'
  const hash = hashExternalApiKey(key)
  assert.equal(hash, hashExternalApiKey(key))
  assert.notEqual(hash, key)
  assert.match(hash, /^[a-f0-9]{64}$/)
})

test('getExternalApiKeyPrefix returns a display-safe prefix', () => {
  assert.equal(getExternalApiKeyPrefix('fupm_live_abcdefghijklmnopqrstuvwxyz'), 'fupm_live_abcdef...')
})

test('extractBearerToken handles header casing', () => {
  assert.equal(extractBearerToken({ authorization: 'Bearer abc' }), 'abc')
  assert.equal(extractBearerToken({ Authorization: 'Bearer xyz' }), 'xyz')
  assert.equal(extractBearerToken({ authorization: 'Basic abc' }), null)
})
```

Create `tests/externalProjectHelpers.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFupmJobUrl, hasSuccessfulChannel, mapHistoryRow } from '../netlify/functions/_externalProject.js'

test('buildFupmJobUrl encodes project names', () => {
  assert.equal(
    buildFupmJobUrl('ARS 123/45', 'https://example.test/'),
    'https://example.test/jobs/ARS%20123%2F45'
  )
})

test('hasSuccessfulChannel only counts sent channel statuses', () => {
  assert.equal(hasSuccessfulChannel({ mail_status: 'sent' }), true)
  assert.equal(hasSuccessfulChannel({ mail_status: 'failed', email_status: null, sms_status: null }), false)
})

test('mapHistoryRow returns only safe integration fields', () => {
  const mapped = mapHistoryRow({
    letter_api_slug: 'request-for-payment',
    template_name: 'Request for Payment',
    sent_at: '2026-04-28T19:42:10.000Z',
    channels: ['email'],
    mail_status: null,
    email_status: 'sent',
    sms_status: null,
    email_body_text: 'secret',
    recipient_email: 'customer@example.test',
  })

  assert.deepEqual(mapped, {
    letterSlug: 'request-for-payment',
    templateName: 'Request for Payment',
    sentAt: '2026-04-28T19:42:10.000Z',
    channels: ['email'],
    statuses: { mail: null, email: 'sent', sms: null },
  })
  assert.equal('email_body_text' in mapped, false)
  assert.equal('recipient_email' in mapped, false)
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- tests/externalApiKeyCore.test.mjs tests/externalProjectHelpers.test.mjs
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Implement helper modules**

Implement `netlify/functions/_externalApiKeyCore.js` with Node `crypto` key generation/hash/prefix helpers plus JSON response helper.

Implement `netlify/functions/_externalApiAuth.js` to authenticate `Authorization: Bearer <key>`, lookup active `external_api_keys.key_hash`, update last-used metadata, and return `{ apiKey, companyId }` or a JSON error response.

Implement `netlify/functions/_externalProject.js` with:

- `buildFupmJobUrl(projectName, baseUrl = process.env.FUPM_APP_BASE_URL || process.env.URL || 'https://fupm.netlify.app')`
- `hasSuccessfulChannel(row)`
- `mapHistoryRow(row)`
- `mapStatusResponse({ projectName, fupmJobUrl, letterSlug, row })`
- `projectExistsForCompany(supabase, companyId, projectName)`
- `validateProjectName(value)`
- `validateLetterSlug(value)`

- [ ] **Step 4: Run helper tests to verify GREEN**

Run:

```bash
npm test -- tests/externalApiKeyCore.test.mjs tests/externalProjectHelpers.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Implement external endpoint functions**

Implement GET-only functions:

- `external-letter-types.js`: returns active templates for `companyId`.
- `external-project-link.js`: validates `projectName`, verifies company-scoped project existence, returns `fupmJobUrl`.
- `external-project-letters.js`: validates `projectName`, verifies existence, returns safe mapped history rows.
- `external-project-letter-status.js`: validates `projectName` and `letterSlug`, verifies existence, returns most recent successful matching row or `sent: false`.

For status lookup, query only successful sends:

```js
.or('mail_status.eq.sent,email_status.eq.sent,sms_status.eq.sent')
```

- [ ] **Step 6: Add clean API redirects**

Add these redirects before the existing generic `/api/*` redirect in `netlify.toml`:

```toml
[[redirects]]
  from = "/api/external/letter-types"
  to = "/.netlify/functions/external-letter-types"
  status = 200

[[redirects]]
  from = "/api/external/projects/:projectName/link"
  to = "/.netlify/functions/external-project-link?projectName=:projectName"
  status = 200

[[redirects]]
  from = "/api/external/projects/:projectName/letters"
  to = "/.netlify/functions/external-project-letters?projectName=:projectName"
  status = 200

[[redirects]]
  from = "/api/external/projects/:projectName/letters/:letterSlug"
  to = "/.netlify/functions/external-project-letter-status?projectName=:projectName&letterSlug=:letterSlug"
  status = 200
```

- [ ] **Step 7: Run verification**

Run:

```bash
npm test -- tests/externalApiKeyCore.test.mjs tests/externalProjectHelpers.test.mjs
npm run lint
```

Expected: both commands exit 0.

## Task 3: API Key Management Functions And UI

**Files:**
- Create: `netlify/functions/external-api-keys.js`
- Create: `netlify/functions/external-api-key-revoke.js`
- Create: `src/components/settings/ExternalApiKeySettings.jsx`
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Implement server allowlist helper inside each admin function**

Both functions must validate a Supabase user session from the normal browser bearer token and require:

```js
user.email?.toLowerCase() === 'tbauer+allied@alliedrestoration.com'
```

Frontend visibility is not sufficient.

- [ ] **Step 2: Implement `external-api-keys.js`**

GET returns key metadata joined with company names:

```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "External App - Allied",
      "companyId": "uuid",
      "companyName": "Allied Restoration",
      "keyPrefix": "fupm_live_abcdef...",
      "createdAt": "2026-04-30T12:00:00.000Z",
      "revokedAt": null,
      "lastUsedAt": null,
      "lastUsedIp": null
    }
  ],
  "companies": [
    { "id": "uuid", "name": "Allied Restoration" }
  ]
}
```

POST accepts `{ name, companyId }`, generates a plaintext key once, stores only hash and prefix, and returns:

```json
{
  "ok": true,
  "apiKey": "fupm_live_...",
  "key": {
    "id": "uuid",
    "name": "External App - Allied",
    "companyId": "uuid",
    "keyPrefix": "fupm_live_abcdef..."
  }
}
```

- [ ] **Step 3: Implement `external-api-key-revoke.js`**

POST accepts `{ keyId }` and sets `revoked_at = now()` for that key.

- [ ] **Step 4: Implement settings UI**

Create `src/components/settings/ExternalApiKeySettings.jsx`:

- Fetch session token and call `/api/external-api-keys`.
- Show existing keys with company, prefix, created date, last used, revoked status.
- Provide create form with name and company select.
- Show plaintext key exactly once after create in a copyable `<code>` block.
- Revoke active keys with confirmation.

Modify `src/pages/Settings.jsx`:

- Fetch the logged-in user's email along with company id.
- Add an `External API` settings tab only when email is `tbauer+allied@alliedrestoration.com`.
- Route `/settings/external-api` to `ExternalApiKeySettings`.

- [ ] **Step 5: Run verification**

Run:

```bash
npm run lint
```

Expected: exits 0.

## Task 4: Documentation Finalization And End-To-End Verification

**Files:**
- Modify: `docs/integrations/external-letter-history-api-reference.md`

- [ ] **Step 1: Update API reference status**

Change:

```text
Status: planned API contract
```

to:

```text
Status: implemented
```

- [ ] **Step 2: Run full local verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Optional local smoke test**

Start the app:

```bash
netlify dev
```

Use the Settings UI to verify the External API tab is hidden for non-allowlisted users and visible for `tbauer+allied@alliedrestoration.com` when logged in.

---

## Review Checklist

- External API keys are stored hashed and scoped to exactly one company.
- External callers never provide `companyId`.
- Every external read derives `companyId` from the key row.
- Revoked keys return `401`.
- Project links are FUPM deep links, not public access links.
- Specific letter status returns `sent: true` only for rows with at least one successful channel.
- External responses exclude rendered bodies, message bodies, customer contact details, addresses, and financial data.
- Only `tbauer+allied@alliedrestoration.com` can create or revoke keys, enforced server-side.
