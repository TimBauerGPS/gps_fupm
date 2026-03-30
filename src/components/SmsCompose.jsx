const SMS_SEGMENT = 160

export default function SmsCompose({ body, onChange }) {
  const charCount = body.length
  const segments = Math.ceil(charCount / SMS_SEGMENT) || 1
  const warn = charCount > SMS_SEGMENT

  return (
    <div className="card" style={{ marginTop: 14, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>SMS Message</h3>
      <textarea
        value={body}
        onChange={e => onChange(e.target.value)}
        rows={4}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: warn ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
        <span>{charCount} chars</span>
        <span>{segments} SMS segment{segments > 1 ? 's' : ''} {warn ? '— exceeds 1 segment' : ''}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
        The PDF link will be appended automatically.
      </p>
    </div>
  )
}
