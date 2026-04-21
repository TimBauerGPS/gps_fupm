import { formatCurrency, formatPhone } from '../lib/formatters.js'
import { getJobBalance } from '../lib/jobUtils.js'

function extractUrl(val) {
  if (!val) return null
  const match = val.match(/href="([^"]+)"/)
  if (match) return match[1]
  if (val.startsWith('http')) return val
  return null
}

export default function JobCard({
  job,
  onChange,
  onPendingChange,
  onInvoiceDateChange,
  onBalanceSave,
  savingPending,
  pendingError,
  balanceSaving,
  balanceSaved,
}) {
  function update(field, value) {
    onChange({ ...job, [field]: value })
  }

  const balance = getJobBalance(job)
  const calculatedBalance = (Number(job.total_invoice_amount) || 0) - (Number(job.total_payment_amount) || 0)
  const hasBalanceOverride = job.balance_override_amount !== null && job.balance_override_amount !== undefined

  return (
    <div className="card">
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Job Details</h2>

      <div className="form-row">
        <Field label="Customer" value={job.customer} onChange={v => update('customer', v)} />
        <Field label="Email" value={job.customer_email} onChange={v => update('customer_email', v)} />
        <Field label="Phone" value={formatPhone(job.customer_phone_number)} onChange={v => update('customer_phone_number', v.replace(/\D/g, ''))} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label>Balance Due</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="number"
              step="0.01"
              value={job.balance_override_amount ?? balance}
              onChange={e => update('balance_override_amount', e.target.value)}
              onBlur={() => onBalanceSave?.(job.balance_override_amount)}
              style={{ maxWidth: 160, fontWeight: 700, color: 'var(--color-primary)' }}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 12, padding: '6px 10px' }}
              disabled={balanceSaving}
              onClick={() => onBalanceSave?.(job.balance_override_amount)}
            >
              {balanceSaving ? 'Saving...' : 'Save'}
            </button>
            {balanceSaved && <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>Saved</span>}
          </div>
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 10 }}>
            Invoice {formatCurrency(job.total_invoice_amount)} - Paid {formatCurrency(job.total_payment_amount)}
            {hasBalanceOverride && ` | Imported balance was ${formatCurrency(calculatedBalance)}`}
          </span>
        </div>
        {extractUrl(job.link_to_project) && (
          <a
            href={extractUrl(job.link_to_project)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}
          >
            View in Albi ↗
          </a>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Property Address
        </p>
        <div className="form-row">
          <Field label="Address" value={job.address_1} onChange={v => update('address_1', v)} />
          <Field label="City" value={job.city} onChange={v => update('city', v)} />
          <Field label="State" value={job.state} onChange={v => update('state', v)} style={{ maxWidth: 80 }} />
          <Field label="ZIP" value={job.zip_code} onChange={v => update('zip_code', v)} style={{ maxWidth: 100 }} />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Mailing Address <span style={{ fontWeight: 400 }}>(leave blank to use property address)</span>
        </p>
        <div className="form-row">
          <Field label="Address" value={job.mailing_address_1} onChange={v => update('mailing_address_1', v)} />
          <Field label="City" value={job.mailing_city} onChange={v => update('mailing_city', v)} />
          <Field label="State" value={job.mailing_state} onChange={v => update('mailing_state', v)} style={{ maxWidth: 80 }} />
          <Field label="ZIP" value={job.mailing_zip_code} onChange={v => update('mailing_zip_code', v)} style={{ maxWidth: 100 }} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, max-content) minmax(180px, 260px)',
            gap: 16,
            alignItems: 'end',
            marginTop: 10,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: 13, color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              checked={!!job.pending_insurance_approval}
              onChange={e => onPendingChange?.(e.target.checked)}
              disabled={savingPending}
              style={{ width: 'auto' }}
            />
            Pending Insurance Approval
          </label>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Invoice Date</label>
            <input
              type="date"
              value={job.pending_invoice_date || ''}
              disabled={!job.pending_insurance_approval || savingPending}
              onChange={e => onInvoiceDateChange?.(e.target.value)}
            />
          </div>
        </div>
        {pendingError && (
          <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{pendingError}</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, style }) {
  return (
    <div className="form-group" style={style}>
      <label>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
