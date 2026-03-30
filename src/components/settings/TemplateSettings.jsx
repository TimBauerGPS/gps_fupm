import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import TemplateEditor from '../TemplateEditor.jsx'

export default function TemplateSettings({ companyId }) {
  const [templates, setTemplates] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { loadTemplates() }, [companyId])

  async function loadTemplates() {
    const { data } = await supabase.from('letter_templates').select('*').eq('company_id', companyId).order('sort_order')
    setTemplates(data || [])
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    let error
    if (editing.id) {
      ;({ error } = await supabase.from('letter_templates').update({
        name:                editing.name,
        description:         editing.description,
        body:                editing.body,
        is_active:           editing.is_active,
        requires_attachment: editing.requires_attachment ?? false,
      }).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('letter_templates').insert({
        name:                editing.name,
        description:         editing.description,
        body:                editing.body,
        is_active:           editing.is_active,
        requires_attachment: editing.requires_attachment ?? false,
        sort_order:          editing.sort_order,
        company_id:          companyId,
      }))
    }

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setEditing(null)
    loadTemplates()
  }

  function newTemplate() {
    setEditing({ name: '', description: '', body: '', requires_due_date: false, is_active: true, sort_order: templates.length })
  }

  async function toggleActive(t) {
    await supabase.from('letter_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    loadTemplates()
  }

  if (editing) return (
    <form onSubmit={handleSave}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>{editing.id ? 'Edit Template' : 'New Template'}</h2>
        <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label>Template Name</label>
            <input value={editing.name} onChange={e => setEditing(t => ({ ...t, name: e.target.value }))} required />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
              <input type="checkbox" checked={!!editing.requires_attachment} onChange={e => setEditing(t => ({ ...t, requires_attachment: e.target.checked }))} style={{ width: 'auto' }} />
              Requires attachment
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
              <input type="checkbox" checked={!!editing.is_active} onChange={e => setEditing(t => ({ ...t, is_active: e.target.checked }))} style={{ width: 'auto' }} />
              Active
            </label>
          </div>
        </div>
        <div className="form-group">
          <label>Description (optional)</label>
          <input value={editing.description || ''} onChange={e => setEditing(t => ({ ...t, description: e.target.value }))} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ marginBottom: 10 }}>Body</label>
        <TemplateEditor
          value={editing.body}
          onChange={body => setEditing(t => ({ ...t, body }))}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓ Saved</span>}
        {saveError && <span style={{ color: 'var(--color-danger)', fontSize: 13 }}>Error: {saveError}</span>}
      </div>
    </form>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={newTemplate}>+ New Template</button>
      </div>

      {templates.map(t => (
        <div key={t.id} className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
            {t.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.description}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {t.requires_attachment && <span className="badge badge-pending">requires attachment</span>}
              <span className={`badge ${t.is_active ? 'badge-success' : 'badge-error'}`}>{t.is_active ? 'active' : 'inactive'}</span>
            </div>
          </div>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setEditing(t)}>Edit</button>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => toggleActive(t)}>
            {t.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ))}
    </div>
  )
}
