import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatCurrency, formatPhone } from '../lib/formatters.js'
import ChannelSelector from './ChannelSelector.jsx'
import SmsCompose from './SmsCompose.jsx'
import EmailCompose from './EmailCompose.jsx'
import MailConfirm from './MailConfirm.jsx'
import ChannelStatus from './ChannelStatus.jsx'
import StatusToast from './StatusToast.jsx'

export default function SendPanel({ job, renderedHtml, template, settings, member, onComplete, onCancel }) {
  const [channels, setChannels] = useState([])
  const [smsBody, setSmsBody] = useState(() => defaultSms(job, member, settings))
  const [emailSubject, setEmailSubject] = useState(
    `${job.name}: Communication regarding your account with ${settings?.company_name || 'our company'}`
  )
  const [emailBodyText, setEmailBodyText] = useState(() => defaultEmailBody(job, member, settings))
  const [mailRecipient, setMailRecipient] = useState(() => {
    const parts = (job.customer || '').trim().split(/\s+/)
    return {
      companyName: '',
      firstName:   parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '',
      lastName:    parts.length > 1 ? parts[parts.length - 1] : '',
    }
  })
  const [attachment, setAttachment] = useState(null)
  const [attachError, setAttachError] = useState('')
  const [attachUploading, setAttachUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [toasts, setToasts] = useState([])
  const [mailingOverride, setMailingOverride] = useState(null)

  const balance = (job.total_invoice_amount || 0) - (job.total_payment_amount || 0)
  const emailDomainMissing = channels.includes('email') && !settings?.resend_from_domain
  const derivedMailing = {
    line1: job.mailing_address_1 || job.address_1,
    city:  job.mailing_city      || job.city,
    state: job.mailing_state     || job.state,
    zip:   job.mailing_zip_code  || job.zip_code,
  }
  const mailing = mailingOverride || derivedMailing

  const MAX_ATTACH_MB = 5
  const MAX_ATTACH_BYTES = MAX_ATTACH_MB * 1024 * 1024
  const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

  async function handleAttach(e) {
    const file = e.target.files[0]
    if (!file) return
    setAttachError('')

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAttachError('Only PDF and DOCX files are allowed.')
      return
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is ${MAX_ATTACH_MB}MB.`)
      return
    }

    setAttachUploading(true)
    try {
      const storagePath = `${job.company_id}/attachments/${Date.now()}-${file.name}`

      const { data, error } = await supabase.storage
        .from('generated-letters')
        .upload(storagePath, file, { contentType: file.type })
      if (error) throw new Error(error.message)

      const { data: signedData, error: signedError } = await supabase.storage
        .from('generated-letters')
        .createSignedUrl(data.path, 60 * 60 * 24 * 7)
      if (signedError) throw new Error(signedError.message)

      setAttachment({
        file,
        name: file.name,
        type: file.type,
        url: signedData.signedUrl,
        isPdf: file.type === 'application/pdf',
      })
    } catch (err) {
      setAttachError(`Upload failed: ${err.message}`)
    }
    setAttachUploading(false)
    e.target.value = ''
  }

  function removeAttachment() {
    setAttachment(null)
    setAttachError('')
  }

  function addToast(msg, type) {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000)
  }

  async function handleSend() {
    if (channels.length === 0) return
    setSending(true)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    // Generate PDF once
    let pdfUrl = null
    try {
      const pdfRes = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ renderedHtml, jobName: job.name, companyId: job.company_id }),
      })
      const pdfData = await pdfRes.json()
      if (!pdfRes.ok) throw new Error(pdfData.error || 'PDF generation failed')
      pdfUrl = pdfData.pdfUrl
    } catch (err) {
      addToast(`PDF generation failed: ${err.message}`, 'error')
      setSending(false)
      return
    }

    // Fire channels in parallel
    const channelResults = await Promise.all(
      channels.map(async ch => {
        try {
          let res
          if (ch === 'sms') {
            res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ smsBody, pdfUrl, toPhone: job.customer_phone_number, attachmentUrl: attachment?.url || null, jobName: job.name, companyId: job.company_id }),
            })
          } else if (ch === 'mail') {
            res = await fetch('/api/send-mail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ pdfUrl, mailingAddress: mailing, mailRecipient, attachmentUrl: attachment?.isPdf ? attachment.url : null, jobName: job.name, companyId: job.company_id }),
            })
          } else if (ch === 'email') {
            res = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ emailSubject, emailBodyText, pdfUrl, attachmentUrl: attachment?.url || null, attachmentName: attachment?.name || null, toEmail: job.customer_email, replyTo: member?.rep_email || null, jobName: job.name, companyId: job.company_id }),
            })
          }
          const data = await res.json()
          return { channel: ch, ok: res.ok, ...data }
        } catch (err) {
          return { channel: ch, ok: false, error: err.message }
        }
      })
    )

    setResults(channelResults)

    // Save history
    const historyPayload = {
      companyId:         job.company_id,
      jobName:           job.name,
      templateId:        template?.id,
      templateName:      template?.name,
      sentByName:        member?.display_name,
      channels,
      amountDue:         balance,
      smsStatus:         channelResults.find(r => r.channel === 'sms')?.ok  ? 'sent' : channelResults.find(r => r.channel === 'sms') ? 'failed' : null,
      mailStatus:        channelResults.find(r => r.channel === 'mail')?.ok ? 'sent' : channelResults.find(r => r.channel === 'mail') ? 'failed' : null,
      emailStatus:       channelResults.find(r => r.channel === 'email')?.ok ? 'sent' : channelResults.find(r => r.channel === 'email') ? 'failed' : null,
      smsError:          channelResults.find(r => r.channel === 'sms')?.error,
      mailError:         channelResults.find(r => r.channel === 'mail')?.error,
      emailError:        channelResults.find(r => r.channel === 'email')?.error,
      postGridLetterId:  channelResults.find(r => r.channel === 'mail')?.postGridLetterId,
      twilioMessageSid:  channelResults.find(r => r.channel === 'sms')?.sid,
      renderedBody:      renderedHtml,
      emailSubject,
      emailBodyText,
      smsBody,
      recipientName:     job.customer,
      recipientEmail:    job.customer_email,
      recipientPhone:    job.customer_phone_number,
      mailingAddress:    mailing,
    }

    await fetch('/api/save-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(historyPayload),
    })

    channelResults.forEach(r => {
      if (r.ok) {
        const label = r.channel === 'sms' ? `SMS to ${formatPhone(job.customer_phone_number)}`
          : r.channel === 'mail' ? 'Letter queued via PostGrid'
          : `Email to ${job.customer_email}`
        addToast(`✓ ${label}`, 'success')
      } else {
        addToast(`✗ ${r.channel.toUpperCase()} failed: ${r.error}`, 'error')
      }
    })

    addToast('Saved to history', 'success')
    setSending(false)
    onComplete(channelResults)
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Step 2 — Compose & Send</h2>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
      </div>

      <ChannelSelector channels={channels} onChange={setChannels} job={job} />

      {channels.length > 0 && (
        <div className="card" style={{ marginTop: 12, background: '#f8fafc', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Attachment <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span></h3>
          {!attachment ? (
            <div>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleAttach}
                disabled={attachUploading}
                style={{ width: 'auto', fontSize: 13 }}
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                PDF or Word document, max {MAX_ATTACH_MB}MB. Included with email and mail.
              </p>
              {attachUploading && <div style={{ marginTop: 6, fontSize: 12 }}><span className="spinner" style={{ width: 12, height: 12 }} /> Uploading...</div>}
              {attachError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-danger)' }}>{attachError}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13 }}>📎 {attachment.name}</span>
              {!attachment.isPdf && channels.includes('mail') && (
                <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
                  Mail requires PDF — DOCX will be included in email only
                </span>
              )}
              <button
                type="button"
                style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-danger)' }}
                onClick={removeAttachment}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {channels.includes('mail') && (
        <MailConfirm
          mailing={mailing}
          recipient={mailRecipient}
          onRecipientChange={setMailRecipient}
          companyId={job.company_id}
          onAddressCorrected={setMailingOverride}
        />
      )}

      {channels.includes('email') && (
        <>
          {emailDomainMissing && (
            <div style={{
              background: 'var(--color-warning-bg, #fff7ed)',
              border: '1px solid var(--color-warning, #f59e0b)',
              borderRadius: 6,
              padding: '10px 14px',
              marginTop: 12,
              fontSize: 13,
              color: 'var(--color-warning-text, #92400e)',
            }}>
              <strong>Verified sending domain required.</strong>{' '}
              Go to <a href="/settings?tab=api-keys" style={{ color: 'inherit', textDecoration: 'underline' }}>
                Settings → API Keys
              </a>{' '}
              and enter your Resend-verified domain before sending email.
            </div>
          )}
          <EmailCompose
            subject={emailSubject}
            body={emailBodyText}
            onSubjectChange={setEmailSubject}
            onBodyChange={setEmailBodyText}
          />
        </>
      )}

      {channels.includes('sms') && (
        <SmsCompose body={smsBody} onChange={setSmsBody} />
      )}

      {channels.length > 0 && !results && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            style={{ fontSize: 15, padding: '10px 36px' }}
            onClick={handleSend}
            disabled={sending || emailDomainMissing}
          >
            {sending ? <><span className="spinner" style={{ borderTopColor: '#fff', marginRight: 8 }} />Sending…</> : 'Send'}
          </button>
        </div>
      )}

      {results && (
        <div style={{ marginTop: 16 }}>
          {results.map(r => <ChannelStatus key={r.channel} result={r} job={job} />)}
        </div>
      )}

      <div className="toast-container">
        {toasts.map(t => <StatusToast key={t.id} message={t.msg} type={t.type} />)}
      </div>
    </div>
  )
}

function defaultSms(job, member, settings) {
  const name = job.customer?.split(' ')[0] || 'there'
  const rep = member?.display_name || ''
  const company = settings?.company_name || 'our company'
  const balance = ((job.total_invoice_amount || 0) - (job.total_payment_amount || 0))
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)
  return `Hi ${name}, this is ${rep} from ${company}. You have an outstanding balance of ${formatted}. Please see the attached letter for details.`
}

function defaultEmailBody(job, member, settings) {
  const name = job.customer || 'Valued Customer'
  const balance = ((job.total_invoice_amount || 0) - (job.total_payment_amount || 0))
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)
  const company = settings?.company_name || 'our company'

  const footerLines = [
    member?.display_name || '',
    member?.rep_phone    || '',
    member?.rep_email    || '',
    company,
  ].filter(Boolean)
  const footer = footerLines.join('\n')

  return `Hi ${name},\n\nPlease see the attached letter regarding your outstanding balance of ${formatted} with ${company}.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\n${footer}`
}
