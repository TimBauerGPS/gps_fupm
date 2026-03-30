import { formatPhone } from '../lib/formatters.js'

export default function ChannelSelector({ channels, onChange, job }) {
  function toggle(ch) {
    onChange(channels.includes(ch) ? channels.filter(c => c !== ch) : [...channels, ch])
  }

  const options = [
    { id: 'mail', label: 'Physical Mail', sub: 'via PostGrid', icon: '✉️', available: true },
    { id: 'email', label: 'Email', sub: job.customer_email || 'No email on file', icon: '📧', available: !!job.customer_email },
    { id: 'sms', label: 'SMS', sub: formatPhone(job.customer_phone_number) || 'No phone on file', icon: '💬', available: !!job.customer_phone_number },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ marginBottom: 10 }}>Channels</label>
      <div style={{ display: 'flex', gap: 12 }}>
        {options.map(opt => {
          const checked = channels.includes(opt.id)
          return (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                border: `2px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius)',
                cursor: opt.available ? 'pointer' : 'not-allowed',
                opacity: opt.available ? 1 : 0.45,
                background: checked ? '#eff6ff' : 'var(--color-surface)',
                userSelect: 'none',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!opt.available}
                onChange={() => toggle(opt.id)}
                style={{ display: 'none' }}
              />
              <span>{opt.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{opt.sub}</div>
              </div>
              {checked && <span style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
