# FUPM External Letter History API Reference

Status: implemented

This reference is for an external app that needs to map its letter options to FUPM letter templates, check whether collection letters have been sent for a project, and open the project in FUPM.

## Base URL

Production:

```text
https://fupm.netlify.app
```

All endpoint paths in this document are relative to that base URL.

## Authentication

Every request must include a FUPM external API key:

```http
Authorization: Bearer <FUPM_API_KEY>
```

Keep this key server-side. Do not expose it in browser JavaScript, mobile apps, logs, screenshots, or customer-visible tools.

Each API key is scoped to one FUPM company. The external app should never send a company id. FUPM derives company access from the API key and filters all results to that company.

## Core Concepts

Project name:

- Use the exact `Name` value from the Google Sheet or CSV imported into FUPM.
- This maps to the FUPM job route `/jobs/:jobName`.
- URL-encode it when placing it in a path.

Letter slug:

- Use the `slug` returned by `GET /api/external/letter-types`.
- Do not infer the slug from a label or filename.
- Labels are for display; slugs are for API calls and stored mappings.

Recommended mapping:

```json
{
  "externalOptionId": "demand_letter",
  "externalLabel": "Demand Letter",
  "fupmSlug": "request-for-payment"
}
```

## Recommended Integration Flow

1. Store the FUPM API key in the external app's server-side environment.
2. Call `GET /api/external/letter-types`.
3. Build a settings screen where the external app maps each of its letter options to a returned FUPM `slug`.
4. When checking a project, use the exact imported project `Name`.
5. Call the specific letter lookup endpoint with the mapped FUPM slug.
6. Use `fupmJobUrl` when a user needs to open the project in FUPM. The link still requires normal FUPM login and company access.

## Endpoints

### List Letter Types

Returns active FUPM letter templates available to the API key's company.

```http
GET /api/external/letter-types
Authorization: Bearer <FUPM_API_KEY>
```

Response:

```json
{
  "letterTypes": [
    {
      "slug": "request-for-payment",
      "label": "Request for Payment"
    },
    {
      "slug": "final-notice",
      "label": "Final Notice"
    }
  ]
}
```

### Get FUPM Project Link

Returns a deep link to the FUPM job page for a project.

```http
GET /api/external/project-link?projectName={projectName}
Authorization: Bearer <FUPM_API_KEY>
```

Example:

```http
GET /api/external/project-link?projectName=ARS-12345
```

Response:

```json
{
  "projectName": "ARS-12345",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/ARS-12345"
}
```

This URL is not a public share link. Opening it requires an active FUPM session with access to the company.

### List Letters Sent To A Project

Returns collection-letter send history for one project.

```http
GET /api/external/project-letters?projectName={projectName}
Authorization: Bearer <FUPM_API_KEY>
```

Example:

```http
GET /api/external/project-letters?projectName=ARS-12345
```

Response:

```json
{
  "projectName": "ARS-12345",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/ARS-12345",
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

If the project exists but no letters have been sent:

```json
{
  "projectName": "ARS-12345",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/ARS-12345",
  "letters": []
}
```

### Check Whether A Specific Letter Was Sent

Checks whether the most recent send for a mapped FUPM letter slug exists on a project.

```http
GET /api/external/project-letter-status?projectName={projectName}&letterSlug={letterSlug}
Authorization: Bearer <FUPM_API_KEY>
```

Example:

```http
GET /api/external/project-letter-status?projectName=ARS-12345&letterSlug=request-for-payment
```

Response when sent:

```json
{
  "projectName": "ARS-12345",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/ARS-12345",
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

Response when the project exists but that letter has not been sent:

```json
{
  "projectName": "ARS-12345",
  "fupmJobUrl": "https://fupm.netlify.app/jobs/ARS-12345",
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

If multiple sends match the same project and letter slug, FUPM returns the most recent one.

## URL Encoding

Always URL-encode `projectName` and `letterSlug` query values.

Example:

```js
const projectName = 'ARS 123/45'
const pathProjectName = encodeURIComponent(projectName)
// ARS%20123%2F45
```

## Error Responses

Errors return JSON:

```json
{
  "error": "Unauthorized"
}
```

Common status codes:

- `401 Unauthorized`: missing, invalid, or revoked API key.
- `404 Not Found`: requested project is not known in the API key's company, or the route does not exist.
- `405 Method Not Allowed`: unsupported HTTP method.
- `422 Unprocessable Entity`: missing or invalid project name or letter slug.
- `500 Internal Server Error`: unexpected FUPM server error.

Unknown projects return `404`. This avoids leaking whether a project exists in a different company.

## Privacy And Security Notes

The API intentionally returns limited data:

- Project name.
- FUPM job URL.
- Letter slug.
- Template name.
- Sent timestamp.
- Channels.
- Channel statuses.

It does not return letter body HTML, email body text, SMS body, mailing addresses, customer email addresses, customer phone numbers, payment amounts, or unrelated job financial data.

## Minimal Client Example

```js
const FUPM_BASE_URL = 'https://fupm.netlify.app'
const FUPM_API_KEY = process.env.FUPM_API_KEY

async function fupmGet(path) {
  const res = await fetch(`${FUPM_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${FUPM_API_KEY}`,
      Accept: 'application/json',
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `FUPM request failed with ${res.status}`)
  }
  return data
}

export async function getFupmLetterTypes() {
  return fupmGet('/api/external/letter-types')
}

export async function getFupmProjectLink(projectName) {
  return fupmGet(`/api/external/project-link?projectName=${encodeURIComponent(projectName)}`)
}

export async function listFupmProjectLetters(projectName) {
  return fupmGet(`/api/external/project-letters?projectName=${encodeURIComponent(projectName)}`)
}

export async function wasFupmLetterSent(projectName, fupmSlug) {
  return fupmGet(
    `/api/external/project-letter-status?projectName=${encodeURIComponent(projectName)}&letterSlug=${encodeURIComponent(fupmSlug)}`
  )
}
```

## Implementation Checklist For The External App

- Store the FUPM API key server-side only.
- Fetch FUPM letter types and store mappings from external options to FUPM slugs.
- Refresh the letter type catalog when an admin edits mappings.
- Use exact imported project `Name` values when calling FUPM.
- Treat `sentAt` as an ISO timestamp.
- Treat `fupmJobUrl` as a login-protected deep link, not a public record URL.
- Handle `401` by prompting for API key rotation or configuration review.
- Handle `404` as "project not available to this key."
