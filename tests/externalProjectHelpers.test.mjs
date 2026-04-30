import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFupmJobUrl,
  hasSuccessfulChannel,
  mapHistoryRow,
  mapStatusResponse,
  projectExistsForCompany,
  validateLetterSlug,
  validateProjectName,
} from '../netlify/functions/_externalProject.js'

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

test('mapStatusResponse returns flat sent status fields', () => {
  assert.deepEqual(mapStatusResponse({
    projectName: 'ARS 123',
    fupmJobUrl: 'https://example.test/jobs/ARS%20123',
    letterSlug: 'request-for-payment',
    row: {
      letter_api_slug: 'request-for-payment',
      template_name: 'Request for Payment',
      sent_at: '2026-04-28T19:42:10.000Z',
      channels: ['email'],
      mail_status: null,
      email_status: 'sent',
      sms_status: null,
    },
  }), {
    projectName: 'ARS 123',
    fupmJobUrl: 'https://example.test/jobs/ARS%20123',
    letterSlug: 'request-for-payment',
    sent: true,
    sentAt: '2026-04-28T19:42:10.000Z',
    templateName: 'Request for Payment',
    channels: ['email'],
    statuses: { mail: null, email: 'sent', sms: null },
  })
})

test('mapStatusResponse returns empty flat fields when not sent', () => {
  assert.deepEqual(mapStatusResponse({
    projectName: 'ARS 123',
    fupmJobUrl: 'https://example.test/jobs/ARS%20123',
    letterSlug: 'request-for-payment',
    row: null,
  }), {
    projectName: 'ARS 123',
    fupmJobUrl: 'https://example.test/jobs/ARS%20123',
    letterSlug: 'request-for-payment',
    sent: false,
    sentAt: null,
    templateName: null,
    channels: [],
    statuses: { mail: null, email: null, sms: null },
  })
})

test('validateProjectName and validateLetterSlug use 422 for invalid input', () => {
  assert.equal(validateProjectName('').response.statusCode, 422)
  assert.equal(validateLetterSlug('Request for Payment').response.statusCode, 422)
})

test('projectExistsForCompany falls back to communication history', async () => {
  const calls = []
  const supabase = {
    from(table) {
      const query = {
        select() {
          calls.push({ table, filters: [] })
          return query
        },
        eq(column, value) {
          calls.at(-1).filters.push([column, value])
          return query
        },
        limit(count) {
          calls.at(-1).limit = count
          return query
        },
        async maybeSingle() {
          return table === 'communication_history'
            ? { data: { id: 'history-row' }, error: null }
            : { data: null, error: null }
        },
      }
      return query
    },
  }

  assert.equal(await projectExistsForCompany(supabase, 'company-1', 'ARS 123'), true)
  assert.deepEqual(calls.map((call) => call.table), ['albi_jobs', 'communication_history'])
  assert.equal(calls[1].limit, 1)
})
