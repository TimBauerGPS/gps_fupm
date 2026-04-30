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
