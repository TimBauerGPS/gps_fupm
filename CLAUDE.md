# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

FUPM (Follow Up Payment Machine) — a multi-tenant web app for restoration company AR teams to send follow-up payment communications (physical mail, email, SMS) to clients using job data synced from Albi CRM.

## Development Commands

```bash
netlify dev          # Start dev server (Netlify Dev on :8888, Vite on :5173)
npm run build        # Production build (outputs to dist/)
npm run lint         # ESLint (zero warnings enforced)
node scripts/seed-templates.js  # Seed default letter templates (reads .env.local)
```

Vite runs on port 5173 and proxies `/api/*` and `/.netlify/functions/*` to Netlify Dev on port 8888. Always run `netlify dev` (not `npm run dev` alone) so serverless functions work.

## Architecture

**Stack:** Vite + React 18 → Netlify Functions (Node.js) → Supabase (Postgres + Auth + Storage)

**External services:** Twilio (SMS), Resend (email), PostGrid (USPS mail), Google Sheets API (Albi data sync)

### Key Data Flow

1. Jobs are imported from Albi via Google Sheets sync (`albi-sync.js` scheduled daily) or manual CSV upload
2. User selects a job → picks a letter template → system merges `{{MergeTag}}` placeholders with job/company data
3. User selects channels (SMS/Email/Mail), composes per-channel content, clicks Send
4. `src/lib/sendAll.js` generates PDF **once**, passes `pdfUrl` to all channels — do not regenerate per channel
5. Each function calls its external service, results are saved to `communication_history`

### Merge Tag System (`src/lib/mergeTemplate.js`)

Templates use `{{DoublebraceTag}}` syntax. `buildMergeData()` constructs the data object from job, company settings, member, and custom fields. `{{ask_FieldName}}` tags prompt the user for input before generating — this is a distinct pre-generate UX step, not a runtime replace.

**Merge tag reference:**

| Tag | Source |
|---|---|
| `{{JobNumber}}` | `albi_jobs.name` |
| `{{CustomerName}}` | `albi_jobs.customer` |
| `{{PAddress}}` / `{{PCity}}` / `{{PState}}` / `{{PZIP}}` | Property address fields |
| `{{MAddress}}` / `{{MCity}}` / `{{MState}}` / `{{MZip}}` | Mailing address fields (with fallback — see Data Rules) |
| `{{PCounty}}` | County field — leave blank if not in data |
| `{{Balance}}` | `total_invoice_amount - total_payment_amount`, formatted as USD |
| `{{dateSent}}` | Current date at send time — `MM/DD/YYYY` |
| `{{dueDate}}` | User-supplied; only in Request for Payment template (`requires_due_date: true`) |
| `{{Rep}}` / `{{RepPhone}}` / `{{RepEmail}}` | `company_members` fields for logged-in user |
| `{{CompanyName}}` / `{{CompanyAddress}}` | From `company_settings` |
| `{{LicenseLine}}` | `"{license_org} Lic {license_number}"` — omit entire line if `license_org` is null |

### Multi-Tenant Isolation

All data is scoped by `company_id`. RLS policies on every table enforce company isolation. Netlify Functions use the Supabase service role key for admin operations and validate user JWTs for auth. Company-level API keys (Twilio, PostGrid, Resend) in `company_settings` override environment defaults.

### Albi Import Pipeline (`src/lib/albiImport.js`)

`HEADER_MAP` maps Albi column names to `albi_jobs` columns. Two entry points: `parseAlbiCSV()` for file upload, `parseAlbiRows()` for Google Sheets API data. The `link_to_project` field handles three formats: `=HYPERLINK()` formulas, `<a href="">` HTML, and plain URLs.

Google Sheets sync uses `includeGridData=true` (not `/values/`) to capture Cmd+K hyperlinks via the `hyperlink` cell property.

### Netlify Functions (`netlify/functions/`)

Each function authenticates via Bearer token → `supabase.auth.getUser(token)`. Functions have their own `package.json` with server-only deps (`html-pdf-node`, `twilio`, `resend`, `jose`).

- `generate-pdf.js` — HTML→PDF via html-pdf-node, uploads to Supabase Storage, returns 7-day signed URL
- `send-sms.js` / `send-email.js` / `send-mail.js` — channel-specific send via external APIs
- `save-history.js` — records communication to `communication_history`
- `albi-sync.js` — scheduled Google Sheets sync (8 AM UTC)
- `sync-now.js` — manual sync trigger (has its own `fetchSheetRows`, keep in sync with `albi-sync.js`)
- `verify-address.js` — PostGrid address verification

### Frontend Routing (`src/App.jsx`)

```
/dashboard          → Job search + recent activity
/jobs/:jobName      → Job detail: template select → preview → send
/history            → Communication history with search
/report             → Date-range reporting with CSV export
/settings/*         → Admin-only: Branding, API Keys, Templates, Users, Import
```

`ProtectedRoute` requires auth session + `user_app_access` for `fupm`. `AdminRoute` requires admin role in `company_members`.

**Role logic:** Use `company_members.role` for in-app permissions. Do NOT use `user_app_access.role` for in-app behavior — that table is access-gating only. Do NOT add role checks to `ProtectedRoute` — keep it session + access only; role logic belongs in `AdminRoute` and inside pages.

### Settings Dirty State

Settings tabs (Branding, API Keys, Import) track form changes via `onDirtyChange` prop. `Settings.jsx` uses `useBlocker` from React Router to intercept navigation with unsaved changes.

## Environment Variables

**Frontend** (VITE_ prefix, safe for browser):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SERVICE_ACCOUNT_EMAIL`

**Backend** (Netlify Functions only):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` (base64), `TWILIO_*`, `POSTGRID_API_KEY`, `RESEND_API_KEY`

## Database

Supabase project slug: `fupm`. Migrations in `supabase/migrations/`. Core tables: `companies`, `company_members`, `company_settings`, `albi_jobs`, `letter_templates`, `communication_history`, `super_admins`, `user_app_access`.

`communication_history` includes content snapshot columns: `rendered_body`, `email_subject`, `email_body_text`, `sms_body` — these were added via `ALTER TABLE` after initial schema creation.

Supabase Storage buckets: `generated-letters` (PDFs), `company-assets` (logos).

## Data Rules

These are the most common sources of bugs — always apply them:

**Mailing address fallback** — many jobs only have a property address:
```javascript
const mailing = {
  line1:  job.mailing_address_1 || job.address_1,
  city:   job.mailing_city      || job.city,
  state:  job.mailing_state     || job.state,
  zip:    job.mailing_zip_code  || job.zip_code,
};
```

**Phone normalization** — store as 10-digit string, reformat to E.164 only when calling Twilio:
```javascript
// At import time:
let phone = raw.toString().replace(/\D/g, '');
if (phone.length === 11 && phone.startsWith('1')) phone = phone.substring(1);
// store as 10 digits

// For Twilio send:
const e164 = '+1' + phone;
```

**Name column detection** — NEVER assume `Name` is column 0; always find by header:
```javascript
const headers = rows[0].map(h => h?.toString().trim());
const nameIdx = headers.findIndex(h => h === 'Name');
if (nameIdx === -1) throw new Error("Required column 'Name' not found");
```

**Balance calculation:**
```javascript
const balance = (job.total_invoice_amount || 0) - (job.total_payment_amount || 0);
```

## Conventions

- Netlify Functions use ES module syntax (`export const handler`)
- Frontend API calls go through `src/lib/sendAll.js::callFunction()` which adds the auth Bearer header
- PostGrid `to` contact uses `c/o FirstName` prefix when both company and person names are provided
- Logo uploads are client-side resized to max 600px width before upload
- SMS URLs are shortened via TinyURL free API (`tinyurl.com/api-create.php`)
- Do not use `supabase.auth.signUp()` client-side — all user creation is server-side via `admin-invite-user.js`
- Do not hardcode company name, address, phone, or license numbers — all come from `company_settings`