export default function EmailCompose({ subject, body, cc, onSubjectChange, onBodyChange, onCcChange }) {
  return (
    <div className="card" style={{ marginTop: 14, background: '#fafff4', border: '1px solid #bbf7d0' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Email</h3>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>CC <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional — comma-separated)</span></label>
        <input
          value={cc}
          onChange={e => onCcChange(e.target.value)}
          placeholder="e.g. manager@company.com, billing@company.com"
        />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Subject</label>
        <input value={subject} onChange={e => onSubjectChange(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Body</label>
        <textarea
          value={body}
          onChange={e => onBodyChange(e.target.value)}
          rows={6}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
        The letter PDF will be automatically attached.
      </p>
    </div>
  )
}
