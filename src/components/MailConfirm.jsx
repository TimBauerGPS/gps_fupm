import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const inputStyle = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 5,
  fontSize: 13,
  boxSizing: 'border-box',
  background: '#fff',
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: 3,
  display: 'block',
}

export default function MailConfirm({ mailing, recipient, onRecipientChange, companyId, onAddressCorrected }) {
  const { companyName, firstName, lastName } = recipient
  const [verifyState, setVerifyState] = useState(null)

  // Auto-verify when the mail panel first opens
  useEffect(() => { handleVerify() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasCompany = companyName.trim().length > 0
  const hasPerson  = (firstName + lastName).trim().length > 0

  const envelopeLines = []
  if (hasCompany) {
    envelopeLines.push(companyName.trim())
    if (hasPerson) envelopeLines.push(`c/o ${[firstName, lastName].filter(Boolean).join(' ').trim()}`)
  } else if (hasPerson) {
    envelopeLines.push([firstName, lastName].filter(Boolean).join(' ').trim())
  } else {
    envelopeLines.push('(no recipient name)')
  }
  envelopeLines.push(mailing.line1 || '')
  envelopeLines.push(`${mailing.city || ''}, ${mailing.state || ''} ${mailing.zip || ''}`.trim().replace(/^,\s*/, ''))

  function set(field) {
    return e => onRecipientChange({ ...recipient, [field]: e.target.value })
  }

  async function handleVerify() {
    setVerifyState('loading')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    try {
      const res = await fetch('/.netlify/functions/verify-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: mailing, companyId }),
      })
      const data = await res.json()
      const addr = data?.data
      if (!addr) {
        setVerifyState({ status: 'failed' })
        return
      }
      const corrected = {
        line1: addr.line1,
        city: addr.city,
        state: addr.provinceOrState,
        zip: addr.postalOrZip,
      }
      const isSame =
        (corrected.line1 || '').toUpperCase() === (mailing.line1 || '').toUpperCase() &&
        (corrected.city || '').toUpperCase() === (mailing.city || '').toUpperCase() &&
        (corrected.state || '').toUpperCase() === (mailing.state || '').toUpperCase() &&
        (corrected.zip || '') === (mailing.zip || '')
      if (isSame) {
        setVerifyState({ status: 'verified' })
      } else {
        setVerifyState({ status: 'corrected', corrected })
      }
    } catch {
      setVerifyState({ status: 'failed' })
    }
  }

  return (
    <div className="card" style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Physical Mail — Recipient</h3>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Company Name <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
        <input
          style={inputStyle}
          value={companyName}
          onChange={set('companyName')}
          placeholder="Leave blank if mailing to a person"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>First Name</label>
          <input style={inputStyle} value={firstName} onChange={set('firstName')} placeholder="First" />
        </div>
        <div>
          <label style={labelStyle}>Last Name</label>
          <input style={inputStyle} value={lastName} onChange={set('lastName')} placeholder="Last" />
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Envelope will be addressed to:</p>
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 5,
        padding: '10px 14px',
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1.7,
        marginBottom: 12,
      }}>
        {envelopeLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>

      <button
        type="button"
        className="btn-secondary"
        style={{ fontSize: 12 }}
        onClick={handleVerify}
        disabled={verifyState === 'loading'}
      >
        {verifyState === 'loading' ? <><span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />Verifying…</> : 'Verify Address'}
      </button>

      {verifyState && verifyState !== 'loading' && (
        <div style={{ marginTop: 10 }}>
          {verifyState.status === 'verified' && (
            <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px' }}>✓ Address verified</span>
          )}
          {verifyState.status === 'failed' && (
            <span className="badge badge-error" style={{ fontSize: 12, padding: '4px 10px' }}>
              ✗ Address could not be verified — mail will still be sent but may be returned
            </span>
          )}
          {verifyState.status === 'corrected' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 5, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
              <span style={{ fontWeight: 600 }}>⚠ Address corrected —</span>{' '}
              {[verifyState.corrected.line1, verifyState.corrected.city, verifyState.corrected.state, verifyState.corrected.zip].filter(Boolean).join(', ')}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    onAddressCorrected(verifyState.corrected)
                    setVerifyState({ status: 'verified' })
                  }}
                >
                  Use corrected address
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
