export default function TemplateSelector({ templates, value, onChange }) {
  return (
    <div className="form-group">
      <label>Letter Template</label>
      <select
        value={value?.id || ''}
        onChange={e => {
          const t = templates.find(t => t.id === e.target.value)
          onChange(t || null)
        }}
      >
        <option value="">— Select a template —</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}
