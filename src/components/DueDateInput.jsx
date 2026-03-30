export default function DueDateInput({ value, onChange }) {
  return (
    <div className="form-group">
      <label>Due Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
