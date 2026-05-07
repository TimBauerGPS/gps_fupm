import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendAuthParams,
  buildAuthSignInUrl,
  getSafeNextPath,
  getScannerSafeActionLink,
} from '../src/lib/authRedirect.js'

test('buildAuthSignInUrl always includes an encoded next query value', () => {
  assert.equal(
    buildAuthSignInUrl('https://fupm.example.com', '/jobs/ABC 123?tab=mail'),
    'https://fupm.example.com/auth/sign-in?next=%2Fjobs%2FABC+123%3Ftab%3Dmail',
  )
})

test('getSafeNextPath rejects absolute and protocol-relative URLs', () => {
  assert.equal(getSafeNextPath('/dashboard'), '/dashboard')
  assert.equal(getSafeNextPath('/jobs/123?tab=mail#preview'), '/jobs/123?tab=mail#preview')
  assert.equal(getSafeNextPath('https://evil.example.com/phish'), '/dashboard')
  assert.equal(getSafeNextPath('//evil.example.com/phish'), '/dashboard')
  assert.equal(getSafeNextPath('dashboard'), '/dashboard')
})

test('appendAuthParams preserves existing query params when moving legacy auth routes', () => {
  assert.equal(
    appendAuthParams('/auth/sign-in?next=%2Fdashboard', new URLSearchParams('token_hash=abc&type=magiclink')),
    '/auth/sign-in?next=%2Fdashboard&token_hash=abc&type=magiclink',
  )
})

test('getScannerSafeActionLink uses generated token hashes instead of Supabase action links', () => {
  assert.equal(
    getScannerSafeActionLink({
      redirectTo: 'https://fupm.example.com/auth/sign-in?next=%2Fdashboard',
      type: 'invite',
      properties: {
        action_link: 'https://project.supabase.co/auth/v1/verify?token=abc&type=invite',
        hashed_token: 'hash-value',
      },
    }),
    'https://fupm.example.com/auth/sign-in?next=%2Fdashboard&token_hash=hash-value&type=invite',
  )
})
