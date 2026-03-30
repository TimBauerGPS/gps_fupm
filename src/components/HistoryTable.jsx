import { formatCurrency, formatDate } from '../lib/formatters.js'
import { useNavigate } from 'react-router-dom'

export default function HistoryTable({ rows, compact, onRowClick }) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No history yet.</p>
  }

  function handleClick(row) {
    if (onRowClick) onRowClick(row)
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
            <th style={{ padding: '10px 14px' }}>Job</th>
            <th style={{ padding: '10px 14px' }}>Template</th>
            {!compact && <th style={{ padding: '10px 14px' }}>Recipient</th>}
            <th style={{ padding: '10px 14px' }}>Channels</th>
            <th style={{ padding: '10px 14px' }}>Amount Due</th>
            <th style={{ padding: '10px 14px' }}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              onClick={() => handleClick(row)}
              style={{
                borderBottom: '1px solid var(--color-border)',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onMouseEnter={e => onRowClick && (e.currentTarget.style.background = 'var(--color-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <td style={{ padding: '10px 14px' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); navigate(`/jobs/${encodeURIComponent(row.job_name)}`) }}
                >
                  {row.job_name}
                </button>
              </td>
              <td style={{ padding: '10px 14px' }}>{row.template_name}</td>
              {!compact && <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{row.recipient_name}</td>}
              <td style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(row.channels || []).map(ch => (
                    <span
                      key={ch}
                      className={`badge badge-${ch} ${
                        (row[`${ch}_status`] === 'failed') ? 'badge-error' : ''
                      }`}
                      title={row[`${ch}_status`] || ''}
                    >
                      {ch}{row[`${ch}_status`] === 'failed' ? ' ✗' : row[`${ch}_status`] === 'sent' ? ' ✓' : ''}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '10px 14px' }}>{row.amount_due != null ? formatCurrency(row.amount_due) : '—'}</td>
              <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {formatDate(row.sent_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
