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
