import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const tooltipStyle = {
  background: '#fefce8',
  border: '1px solid #fde047',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 12,
  marginTop: 6,
  marginBottom: 6,
  lineHeight: 1.6,
}

const helpBtnStyle = {
  fontSize: 11,
  fontWeight: 700,
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
  marginLeft: 8,
  lineHeight: '18px',
  textAlign: 'center',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const WEBHOOK_URL = 'https://fupm.netlify.app/.netlify/functions/twilio-inbound-sms'

export default function ApiKeySettings({ companyId, onDirtyChange }) {
  const FORM_KEYS = ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number', 'postgrid_api_key', 'resend_api_key', 'resend_from_domain', 'albi_bcc_email', 'pdfshift_api_key']
  const [form, setForm] = useState({
    twilio_account_sid: '', twilio_auth_token: '', twilio_phone_number: '',
    postgrid_api_key: '', resend_api_key: '', resend_from_domain: '', albi_bcc_email: '', pdfshift_api_key: '',
  })
  const [savedForm, setSavedForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showTwilioHelp, setShowTwilioHelp] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  function copyWebhook() {
    navigator.clipboard.writeText(WEBHOOK_URL)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }
  const [showPostGridHelp, setShowPostGridHelp] = useState(false)
  const [showResendHelp, setShowResendHelp] = useState(false)

  function normalize(data) {
    const out = {}
    for (const [k, v] of Object.entries(data)) out[k] = v == null ? '' : v
    return out
  }

  useEffect(() => {
    supabase.from('company_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, postgrid_api_key, resend_api_key, resend_from_domain, albi_bcc_email, pdfshift_api_key')
      .eq('company_id', companyId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const normalized = normalize(data)
          const picked = Object.fromEntries(FORM_KEYS.map(k => [k, normalized[k] ?? '']))
          setForm(picked)
          setSavedForm(picked)
        }
      })
  }, [companyId])

  useEffect(() => {
    if (!savedForm) return
    const dirty = FORM_KEYS.some(k => (form[k] ?? '') !== (savedForm[k] ?? ''))
    onDirtyChange?.(dirty)
  }, [form, savedForm])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('company_settings').upsert({ ...form, company_id: companyId }, { onConflict: 'company_id' })
    setSaving(false)
    setSaved(true)
    setSavedForm({ ...form })
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2500)
  }

  function update(field, val) { setForm(f => ({ ...f, [field]: val })) }

  return (
    <form onSubmit={handleSave}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
          Twilio (SMS)
          <button type="button" style={helpBtnStyle} onClick={() => setShowTwilioHelp(v => !v)}>?</button>
        </h3>
        {showTwilioHelp && (
          <div style={tooltipStyle}>
            Sign up at <a href="https://twilio.com" target="_blank" rel="noopener noreferrer">twilio.com</a>. Your Account SID and Auth Token are on the Console homepage. You'll also need to purchase an SMS-capable phone number.
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Leave blank to use the environment-level credentials.
        </p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Account SID</label>
          <input value={form.twilio_account_sid || ''} onChange={e => update('twilio_account_sid', e.target.value)} placeholder="ACxxxxxxx (override env)" />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Auth Token</label>
          <input type="password" value={form.twilio_auth_token || ''} onChange={e => update('twilio_auth_token', e.target.value)} placeholder="••••••••" />
        </div>
        <div className="form-group">
          <label>Phone Number</label>
          <input value={form.twilio_phone_number || ''} onChange={e => update('twilio_phone_number', e.target.value)} placeholder="+18885551212" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>SMS Inbox — Inbound Webhook</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          To receive customer replies in the Inbox, point your Twilio number's incoming message webhook to this URL.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <code style={{
            flex: 1,
            background: '#fff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            wordBreak: 'break-all',
            color: 'var(--color-text)',
          }}>
            {WEBHOOK_URL}
          </code>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
            onClick={copyWebhook}
          >
            {webhookCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <ol style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.9, paddingLeft: '1.25em', margin: 0 }}>
          <li>Log in to <strong>console.twilio.com</strong></li>
          <li>Go to <strong>Phone Numbers → Manage → Active Numbers</strong></li>
          <li>Click your SMS phone number</li>
          <li>Under <strong>Messaging Configuration</strong>, find <em>"A message comes in"</em></li>
          <li>Set the webhook URL to the address above, method <strong>HTTP POST</strong></li>
          <li>Click <strong>Save configuration</strong></li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
          PostGrid (Mail)
          <button type="button" style={helpBtnStyle} onClick={() => setShowPostGridHelp(v => !v)}>?</button>
        </h3>
        {showPostGridHelp && (
          <div style={tooltipStyle}>
            Sign up at <a href="https://postgrid.com" target="_blank" rel="noopener noreferrer">postgrid.com</a>. Go to Settings → API Keys to create a key. Use a test key (<code>test_sk_…</code>) while testing, then switch to a live key (<code>live_sk_…</code>) for real mail.
          </div>
        )}
        <div style={{ marginBottom: 14 }} />
        <div className="form-group">
          <label>API Key</label>
          <input type="password" value={form.postgrid_api_key || ''} onChange={e => update('postgrid_api_key', e.target.value)} placeholder="••••••••" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
          PDFShift (Letter PDFs)
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Each company must provide its own PDFShift API key to generate letter PDFs.
        </p>
        <div className="form-group">
          <label>API Key</label>
          <input type="password" value={form.pdfshift_api_key || ''} onChange={e => update('pdfshift_api_key', e.target.value)} placeholder="sk_..." />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
          Resend (Email)
          <button type="button" style={helpBtnStyle} onClick={() => setShowResendHelp(v => !v)}>?</button>
        </h3>
        {showResendHelp && (
          <div style={tooltipStyle}>
            Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer">resend.com</a>. Go to API Keys to create a key. You must verify your sending domain under Domains before emails will send.
          </div>
        )}
        <div style={{ marginBottom: 14 }} />
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>API Key</label>
          <input type="password" value={form.resend_api_key || ''} onChange={e => update('resend_api_key', e.target.value)} placeholder="••••••••" />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Verified Sending Domain</label>
          <input value={form.resend_from_domain || ''} onChange={e => update('resend_from_domain', e.target.value)} placeholder="e.g. alliedrestoration.com" />
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Must match a domain verified in your Resend account. Emails will be sent from <em>noreply@yourdomain.com</em>.
          </p>
        </div>
        <div className="form-group">
          <label>BCC to Albi Email Address <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span></label>
          <input type="email" value={form.albi_bcc_email || ''} onChange={e => update('albi_bcc_email', e.target.value)} placeholder="jobs@youralbi.com" />
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Every outbound email will be BCC'd here so Albi receives a copy. The sending rep will also be BCC'd automatically when their rep email is filled in.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save API Keys'}
        </button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓ Saved</span>}
      </div>
    </form>
  )
}
