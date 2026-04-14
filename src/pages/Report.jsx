import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10)
}

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toDateInputValue(d)
}

function exportCsv(rows) {
  const headers = ['Date Sent', 'Job #', 'Customer', 'Template', 'Channels', 'SMS Status', 'Mail Status', 'Email Status']
  const lines = rows.map(r => [
    new Date(r.sent_at).toLocaleDateString(),
    r.job_name,
    r.recipient_name || '',
    r.template_name,
    (r.channels || []).join('+').toUpperCase(),
    r.sms_status || '',
    r.mail_status || '',
    r.email_status || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fupm-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Report() {
  const [fromDate, setFromDate] = useState(defaultFrom())
  const [toDate, setToDate] = useState(toDateInputValue(new Date()))
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runReport() {
    setLoading(true)
    setError('')
    // Parse as local time (date-only strings are parsed as UTC by spec, causing off-by-one in US timezones)
    const [fy, fm, fd] = fromDate.split('-').map(Number)
    const from = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
    const [ty, tm, td] = toDate.split('-').map(Number)
    const to = new Date(ty, tm - 1, td, 23, 59, 59, 999)
    const { data, error: err } = await supabase
      .from('communication_history')
      .select('*')
      .neq('template_name', 'Inbox reply')
      .gte('sent_at', from.toISOString())
      .lte('sent_at', to.toISOString())
      .order('sent_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  const totalSends = rows?.length ?? 0
  const smsSent = rows?.filter(r => (r.channels || []).includes('sms')).length ?? 0
  const mailSent = rows?.filter(r => (r.channels || []).includes('mail')).length ?? 0
  const emailSent = rows?.filter(r => (r.channels || []).includes('email')).length ?? 0

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Report</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
            Showing all communications sent within the selected date range.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 160 }} />
          </div>
          <button className="btn-primary" onClick={runReport} disabled={loading}>
            {loading ? <><span className="spinner" style={{ marginRight: 6 }} />Running…</> : 'Run Report'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      {rows !== null && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Sends', value: totalSends },
              { label: 'SMS Sent', value: smsSent },
              { label: 'Mail Sent', value: mailSent },
              { label: 'Email Sent', value: emailSent },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>Send History</h2>
              {rows.length > 0 && (
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => exportCsv(rows)}>
                  Export CSV
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No sends found in this date range.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {['Date Sent', 'Job #', 'Customer', 'Template', 'Channels'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 10px' }}>{new Date(r.sent_at).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 10px' }}><a href={`/jobs/${encodeURIComponent(r.job_name)}`} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{r.job_name}</a></td>
                        <td style={{ padding: '8px 10px' }}>{r.recipient_name || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{r.template_name}</td>
                        <td style={{ padding: '8px 10px' }}>{(r.channels || []).map(c => c.toUpperCase()).join(' | ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
