# External Letter History API Design

Date: 2026-04-30

## Goal

Build a small read-only external API that lets an approved external app:

- Fetch the FUPM letter type catalog.
- List collection letters sent to a specific project.
- Check whether a specific letter type has been sent to a specific project, and when.
- Fetch a direct FUPM link for a project.

The API must preserve FUPM's multi-tenant isolation. An external API key grants access to one company only.

## Definitions

- Project name: the imported `Name` value from Google Sheets or CSV. In FUPM this is `albi_jobs.name` and `communication_history.job_name`.
- Letter type: a FUPM letter template exposed through a stable API slug.
- API key owner: the FUPM user `tbauer+allied@alliedrestoration.com`, who is the only user allowed to create or revoke external API keys.

## Recommended Approach

FUPM is the source of truth for available letter types. The external app calls FUPM's letter type catalog, then stores its own mapping between its internal letter options and FUPM slugs.

Example external mapping:

```json
{
  "externalOptionId": "demand_letter",
  "externalLabel": "Demand Letter",
  "fupmSlug": "request-for-payment"
}
```

This avoids fragile matching on display labels, filenames, capitalization, punctuation, or future template renames.

## API Key Model

Add an external API key table with records scoped to one company:

- `id`
- `company_id`
- `name`
- `key_hash`
- `key_prefix`
- `created_by`
- `created_at`
- `revoked_at`
- `last_used_at`
- `last_used_ip`

The plaintext API key is shown only once at creation. FUPM stores only a hash plus a short prefix for display and lookup support. Revoked keys must be rejected.

Each API key is assigned to exactly one `company_id`. External requests never send a company id, and the API never accepts one from external callers.

## Key Management Permissions

Only `tbauer+allied@alliedrestoration.com` can create or revoke external API keys.

The management UI should live in Settings, but the control should be hidden from all other users, including regular company admins, unless permission rules are expanded later.

Management actions:

- List key metadata: name, company, prefix, created date, created by, last used, revoked status.
- Create key: choose company and display name, then show plaintext secret once.
- Revoke key: set `revoked_at`.

The management API must enforce the email allowlist on the server. The frontend visibility check is convenience only.

## Authentication Flow

External API requests use:

```http
Authorization: Bearer <api-key>
```

Server flow:

1. Extract the bearer token.
2. Hash the provided API key.
3. Find an external key row with matching hash and `revoked_at is null`.
4. Read `company_id` from that row.
5. Update `last_used_at` and `last_used_ip`.
6. Run all data queries with `company_id = apiKey.company_id`.

No endpoint may allow the external app to override the company scope.

## Letter Type Catalog

Endpoint:

```http
GET /api/external/letter-types
```

Response:

```json
{
  "letterTypes": [
    {
      "slug": "request-for-payment",
      "label": "Request for Payment"
    }
  ]
}
```

Only active templates for the API key's company are returned.

## Project Letter History

Endpoint:

```http
GET /api/external/project-letters?projectName=:projectName
```

Response:

```json
{
  "projectName": "JOB-123",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/JOB-123",
  "letters": [
    {
      "letterSlug": "request-for-payment",
      "templateName": "Request for Payment",
      "sentAt": "2026-04-28T19:42:10.000Z",
      "channels": ["mail", "email"],
      "statuses": {
        "mail": "sent",
        "email": "sent",
        "sms": null
      }
    }
  ]
}
```

The endpoint should first verify the project exists for the API key's company in `albi_jobs` or has company-scoped `communication_history`. The history query must filter by both `communication_history.company_id` and `communication_history.job_name`.

## Specific Letter Lookup

Endpoint:

```http
GET /api/external/project-letter-status?projectName=:projectName&letterSlug=:letterSlug
```

Response when sent:

```json
{
  "projectName": "JOB-123",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/JOB-123",
  "letterSlug": "request-for-payment",
  "sent": true,
  "sentAt": "2026-04-28T19:42:10.000Z",
  "templateName": "Request for Payment",
  "channels": ["mail", "email"],
  "statuses": {
    "mail": "sent",
    "email": "sent",
    "sms": null
  }
}
```

Response when not sent:

```json
{
  "projectName": "JOB-123",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/JOB-123",
  "letterSlug": "request-for-payment",
  "sent": false,
  "sentAt": null,
  "templateName": null,
  "channels": [],
  "statuses": {
    "mail": null,
    "email": null,
    "sms": null
  }
}
```

If multiple matching rows exist, return the most recent sent row.

If the project exists for the scoped company but the specific letter has not been sent, return `sent: false`. If the project is not known in the scoped company, return `404 Not Found`.

## FUPM Project Link

Endpoint:

```http
GET /api/external/project-link?projectName=:projectName
```

Response:

```json
{
  "projectName": "JOB-123",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/JOB-123"
}
```

This is a deep link into the existing FUPM job page. It is not a public share link and must not bypass FUPM authentication or authorization. A user who opens the link still needs an active FUPM session and access to the company through normal `ProtectedRoute` behavior.

The implementation should build the URL from a configured app base URL and `encodeURIComponent(projectName)`, matching the current frontend route `/jobs/:jobName`. External API endpoints should receive `projectName` as a query parameter so project names containing `/` do not break route matching.

The link endpoint should verify that the project exists for the API key's company in `albi_jobs` or has company-scoped `communication_history` before returning a URL. That avoids generating plausible-looking links for projects outside the scoped company.

## Template Slugs

Add a stable slug column to `letter_templates`, such as `api_slug`.

Rules:

- Required for active templates exposed to the external API.
- Unique per company.
- Machine-friendly lowercase slug, such as `request-for-payment`.
- Generated from the template name initially, then treated as stable.
- Editable only with care, because changing a slug can break external mappings.

Add the same slug snapshot to `communication_history`, such as `letter_api_slug`, when saving a sent communication. This preserves lookup behavior if a template is later renamed or removed.

Backfill existing history where possible:

- Use the current linked template's slug when `template_id` still points to a template.
- Leave `letter_api_slug` null when no linked template row is available, because rows such as Inbox replies are communication history but not external letter sends.

## Returned Data Limits

The external API should return only fields needed for the integration:

- Project name.
- FUPM job URL.
- Letter slug.
- Template name.
- Sent timestamp.
- Channels.
- Channel statuses.

Do not return rendered letter bodies, email body text, SMS body, mailing addresses, customer phone numbers, customer emails, API key metadata, or unrelated job financial data.

## Error Handling

- `401 Unauthorized`: missing, malformed, unknown, or revoked API key.
- `404 Not Found`: route does not exist, or requested project is not known in the API key's company.
- `405 Method Not Allowed`: unsupported method.
- `422 Unprocessable Entity`: missing or invalid project name or slug.
- `500 Internal Server Error`: unexpected server failure.

Imported projects that have no communication history should return a successful empty result for the listing endpoint and `sent: false` for specific lookups.

## Implementation Components

- Database migration for external API keys and template/history slug fields.
- Shared Netlify helper for authenticating external API keys and deriving company scope.
- External Netlify functions for:
  - `external-letter-types`
  - `external-project-letters`
  - `external-project-letter-status`
  - `external-project-link`
- Admin-only Netlify functions for API key creation, listing, and revocation.
- Settings UI section visible only to `tbauer+allied@alliedrestoration.com`.
- Send history save path update so future rows snapshot the selected template slug.
- External API reference document for the app consuming this API.

## Testing Plan

Add automated coverage for:

- Missing, invalid, and revoked external API keys are rejected.
- Valid key derives company scope from the key record.
- A key for one company cannot read another company's letter types or history.
- Letter type catalog returns only active templates for the scoped company.
- Project history listing returns only limited safe fields.
- Specific letter lookup returns the most recent matching send.
- Project link endpoint returns a FUPM deep link only for projects in the scoped company.
- Imported project with no sends returns an empty listing and `sent: false` for a specific letter.
- Unknown project returns `404` without revealing cross-company data.
- Only `tbauer+allied@alliedrestoration.com` can create or revoke keys.

## Open Decisions

None. The approved design uses FUPM as the letter type source of truth, external-app-owned mappings, stable FUPM slugs, and company-scoped API keys.
