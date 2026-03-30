import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatDate, formatCurrency } from '../lib/formatters.js'

export default function HistoryDetail({ row, onClose }) {
  const [albiLink, setAlbiLink] = useState(null)
  useEffect(() => {
    if (!row?.job_name) return
    supabase.from('albi_jobs').select('link_to_project').eq('name', row.job_name).maybeSingle()
      .then(({ data }) => {
        const link = data?.link_to_project
        setAlbiLink(link?.startsWith('http') ? link : null)
      })
  }, [row?.job_name])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 680, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{row.job_name} — {row.template_name}</h2>
            {albiLink && (
              <a href={albiLink} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                View in Albi →
              </a>
            )}
          </div>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <Info label="Sent" value={formatDate(row.sent_at)} />
          <Info label="By" value={row.sent_by_name} />
          <Info label="Amount Due" value={row.amount_due != null ? formatCurrency(row.amount_due) : '—'} />
        </div>

        <div className="form-row" style={{ marginBottom: 20 }}>
          {(row.channels || []).map(ch => (
            <div key={ch} style={{ fontSize: 13 }}>
              <span className={`badge ${row[`${ch}_status`] === 'sent' ? 'badge-success' : 'badge-error'}`}>
                {ch.toUpperCase()}: {row[`${ch}_status`] || 'n/a'}
              </span>
              {row[`${ch}_error`] && (
                <div style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{row[`${ch}_error`]}</div>
              )}
            </div>
          ))}
        </div>

        {row.sms_body && (
          <Section title="SMS Body">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 }}>{row.sms_body}</pre>
          </Section>
        )}

        {row.email_subject && (
          <Section title="Email Subject">
            <p style={{ fontSize: 13 }}>{row.email_subject}</p>
          </Section>
        )}

        {row.email_body_text && (
          <Section title="Email Body">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 }}>{row.email_body_text}</pre>
          </Section>
        )}

        {row.rendered_body && (
          <Section title="Letter (rendered)">
            <div
              style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: '16px 20px', fontSize: 12, fontFamily: 'Georgia, serif', lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: row.rendered_body }}
            />
          </Section>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value || '—'}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-text-muted)', marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  )
}
