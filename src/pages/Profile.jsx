import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { parseAlbiCSV } from '../lib/albiImport.js'
import { saveMemberProfile } from '../lib/profile.js'

export default function Profile() {
  const [member, setMember]       = useState(null)
  const [companyId, setCompanyId] = useState(null)
  const [form, setForm]           = useState({ display_name: '', rep_phone: '', rep_email: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved]   = useState(false)
  const [profileError, setProfileError]   = useState('')

  // Import state
  const [sheetUrl, setSheetUrl]           = useState('')
  const [savedSheetUrl, setSavedSheetUrl] = useState('')
  const [lastSynced, setLastSynced]       = useState(null)
  const [sheetSaving, setSheetSaving]     = useState(false)
  const [sheetSaved, setSheetSaved]       = useState(false)
  const [validating, setValidating]       = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [syncing, setSyncing]             = useState(false)
  const [syncResult, setSyncResult]       = useState(null)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: m } = await supabase
        .from('company_members')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (m) {
        setMember(m)
        setCompanyId(m.company_id)
        setForm({
          display_name: m.display_name || '',
          rep_phone:    m.rep_phone    || '',
          rep_email:    m.rep_email    || '',
        })

        const { data: settings } = await supabase
          .from('company_settings')
          .select('albi_sheet_url, albi_last_synced_at')
          .eq('company_id', m.company_id)
          .maybeSingle()
        if (settings) {
          setSheetUrl(settings.albi_sheet_url || '')
          setSavedSheetUrl(settings.albi_sheet_url || '')
          setLastSynced(settings.albi_last_synced_at)
        }
      }
    }
    load()
  }, [])

  function updatePhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    }
    setForm(f => ({ ...f, rep_phone: formatted }))
  }

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError('')

    try {
      const updatedMember = await saveMemberProfile({
        userId: member.user_id,
        companyId,
        display_name: form.display_name,
        rep_phone: form.rep_phone,
        rep_email: form.rep_email,
      })
      setMember(updatedMember)
      setForm({
        display_name: updatedMember.display_name || '',
        rep_phone: updatedMember.rep_phone || '',
        rep_email: updatedMember.rep_email || '',
      })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err) {
      setProfileError(err.message)
    }

    setProfileSaving(false)
  }

  async function handleSheetSave(e) {
    e.preventDefault()
    setSheetSaving(true)
    await supabase
      .from('company_settings')
      .upsert({ company_id: companyId, albi_sheet_url: sheetUrl }, { onConflict: 'company_id' })
    setSheetSaving(false)
    setSavedSheetUrl(sheetUrl)
    setSheetSaved(true)
    setTimeout(() => setSheetSaved(false), 2500)
    testConnection()
  }

  async function testConnection() {
    setValidating(true)
    setValidateResult(null)
    try {
      const res  = await fetch('/.netlify/functions/validate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = { ok: false, error: `Server error ${res.status}` } }
      setValidateResult(data)
    } catch (err) {
      setValidateResult({ ok: false, error: err.message })
    }
    setValidating(false)
  }

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch('/.netlify/functions/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json()
      setSyncResult(data)
      if (data.ok) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('albi_last_synced_at')
          .eq('company_id', companyId)
          .maybeSingle()
        if (settings) setLastSynced(settings.albi_last_synced_at)
      }
    } catch (err) {
      setSyncResult({ error: err.message })
    }
    setSyncing(false)
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const jobs = parseAlbiCSV(text)
      if (jobs.length === 0) throw new Error('No valid rows found in CSV')
      const rows = jobs.map(j => ({ ...j, company_id: companyId }))
      const { error } = await supabase
        .from('albi_jobs')
        .upsert(rows, { onConflict: 'company_id,name', count: 'exact' })
      if (error) throw error
      setImportResult({ success: true, count: rows.length })
    } catch (err) {
      setImportResult({ success: false, error: err.message })
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!member) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
          Update your rep information and manage job data imports.
        </p>
      </div>

      {/* Personal info */}
      <form onSubmit={handleProfileSave}>
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Your Information</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
            These fields populate <code>{'{{Rep}}'}</code>, <code>{'{{RepPhone}}'}</code>, and <code>{'{{RepEmail}}'}</code> in letter templates.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Display Name <code style={{ fontWeight: 400, fontSize: 11 }}>{'{{Rep}}'}</code></label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>
            <div className="form-group">
              <label>Phone <code style={{ fontWeight: 400, fontSize: 11 }}>{'{{RepPhone}}'}</code></label>
              <input
                value={form.rep_phone}
                onChange={e => updatePhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="form-group">
              <label>Email <code style={{ fontWeight: 400, fontSize: 11 }}>{'{{RepEmail}}'}</code></label>
              <input
                type="email"
                value={form.rep_email}
                onChange={e => setForm(f => ({ ...f, rep_email: e.target.value }))}
                placeholder="you@company.com"
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
            {profileSaved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓ Saved</span>}
          </div>
          {profileError && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{profileError}</p>}
        </div>
      </form>

      {/* Google Sheets */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Google Sheets Sync</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          The sheet syncs automatically every night. Share your Albi sheet with the service account as <strong>Viewer</strong>:
          <br />
          <code style={{ fontSize: 12, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 3 }}>
            {import.meta.env.VITE_SERVICE_ACCOUNT_EMAIL || 'fupm-sync@your-project.iam.gserviceaccount.com'}
          </code>
        </p>
        <form onSubmit={handleSheetSave}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Google Sheet URL</label>
            <input
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          {lastSynced && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Last synced: {new Date(lastSynced).toLocaleString()}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="submit" className="btn-primary" disabled={sheetSaving}>
              {sheetSaving ? 'Saving…' : 'Save Sheet URL'}
            </button>
            <button type="button" className="btn-secondary" disabled={!sheetUrl || validating} onClick={testConnection}>
              {validating ? <><span className="spinner" /> Testing…</> : 'Test Connection'}
            </button>
            <button type="button" className="btn-primary" disabled={!sheetUrl || syncing} onClick={syncNow}>
              {syncing ? <><span className="spinner" style={{ borderTopColor: '#fff', width: 13, height: 13, marginRight: 6 }} />Syncing…</> : '↻ Sync Now'}
            </button>
            {sheetSaved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓ Saved</span>}
            {syncResult && (
              <span style={{ fontSize: 13, color: syncResult.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {syncResult.ok ? `✓ Synced ${syncResult.count} jobs` : `✗ ${syncResult.error}`}
              </span>
            )}
          </div>
        </form>
        {validateResult && (
          <div className={`badge ${validateResult.ok ? 'badge-success' : 'badge-error'}`}
            style={{ padding: '8px 14px', fontSize: 13 }}>
            {validateResult.ok
              ? `✓ Sheet accessible${validateResult.title ? ` — ${validateResult.title}` : ''}`
              : `✗ ${validateResult.error}`}
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Manual CSV Import</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Export your Albi data as CSV and upload here. Existing jobs will be updated; new jobs will be added.
          The file must have a <strong>Name</strong> column header.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleCsvUpload}
          disabled={importing}
          style={{ width: 'auto' }}
        />
        {importing && <div style={{ marginTop: 10 }}><span className="spinner" /> Importing…</div>}
        {importResult && (
          <div className={`badge ${importResult.success ? 'badge-success' : 'badge-error'}`}
            style={{ marginTop: 10, padding: '8px 14px', fontSize: 13 }}>
            {importResult.success ? `✓ Imported ${importResult.count} jobs` : `✗ ${importResult.error}`}
          </div>
        )}
      </div>
    </div>
  )
}
