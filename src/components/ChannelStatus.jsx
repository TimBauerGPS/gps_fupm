import { formatPhone } from '../lib/formatters.js'

export default function ChannelStatus({ result, job }) {
  const { channel, ok, error } = result

  const label = channel === 'sms'   ? `SMS → ${formatPhone(job.customer_phone_number)}`
    : channel === 'mail'  ? 'Physical Mail → PostGrid'
    : `Email → ${job.customer_email}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span className={`badge ${ok ? 'badge-success' : 'badge-error'}`}>
        {ok ? '✓' : '✗'} {channel.toUpperCase()}
      </span>
      <span style={{ fontSize: 13 }}>{label}</span>
      {!ok && error && (
        <span style={{ fontSize: 12, color: 'var(--color-danger)', marginLeft: 4 }}>{error}</span>
      )}
    </div>
  )
}
