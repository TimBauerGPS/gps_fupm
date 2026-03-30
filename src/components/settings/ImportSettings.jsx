import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { parseAlbiCSV } from '../../lib/albiImport.js'

export default function ImportSettings({ companyId, onDirtyChange }) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [savedSheetUrl, setSavedSheetUrl] = useState('')
  const [lastSynced, setLastSynced] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('company_settings').select('albi_sheet_url, albi_last_synced_at').eq('company_id', companyId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSheetUrl(data.albi_sheet_url || '')
          setSavedSheetUrl(data.albi_sheet_url || '')
          setLastSynced(data.albi_last_synced_at)
        }
      })
  }, [companyId])

  useEffect(() => {
    onDirtyChange?.(sheetUrl !== savedSheetUrl)
  }, [sheetUrl, savedSheetUrl])

  async function testConnection() {
    setValidating(true)
    setValidateResult(null)
    try {
      const res = await fetch('/.netlify/functions/validate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = { ok: false, error: `Server error ${res.status} — check Netlify function logs` } }
      setValidateResult(data)
    } catch (err) {
      setValidateResult({ ok: false, error: err.message })
    }
    setValidating(false)
  }

  async function saveSheetUrl(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('company_settings').upsert({ company_id: companyId, albi_sheet_url: sheetUrl }, { onConflict: 'company_id' })
    setSaving(false)
    setSavedSheetUrl(sheetUrl)
    onDirtyChange?.(false)
    testConnection()
  }

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/.netlify/functions/sync-now', {
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
      const { error, count } = await supabase
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

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Google Sheets (Nightly Sync)</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          The sheet syncs automatically at midnight PT. Share your Albi sheet with the service account below as <strong>Viewer</strong>:
          <br /><code style={{ fontSize: 12, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 3 }}>
            {import.meta.env.VITE_SERVICE_ACCOUNT_EMAIL || 'fupm-sync@your-project.iam.gserviceaccount.com'}
          </code>
        </p>
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#713f12' }}>
          <strong>Data access notice:</strong> By connecting a Google Sheet, you grant Allied Restoration Services
          read access to that sheet via a shared service account. This access is used solely to sync job data
          into FUPM and is not shared with any third parties.
        </div>
        <form onSubmit={saveSheetUrl}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Sheet URL'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!sheetUrl || validating}
              onClick={testConnection}
            >
              {validating ? <><span className="spinner" /> Testing…</> : 'Test Connection'}
            </button>
          </div>
        </form>
        {validateResult && (
          <div
            className={`badge ${validateResult.ok ? 'badge-success' : 'badge-error'}`}
            style={{ marginTop: 10, padding: '8px 14px', fontSize: 13 }}
          >
            {validateResult.ok
              ? `✓ Sheet is accessible — ready to sync${validateResult.title ? ` (${validateResult.title})` : ''}`
              : `✗ ${validateResult.error}`}
          </div>
        )}

        <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={!sheetUrl || syncing}
            onClick={syncNow}
          >
            {syncing ? <><span className="spinner" style={{ width: 13, height: 13, marginRight: 6 }} />Syncing…</> : '↻ Sync Now'}
          </button>
          {syncResult && (
            <span
              style={{ fontSize: 13, color: syncResult.ok ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {syncResult.ok
                ? `✓ Synced ${syncResult.count} jobs`
                : `✗ ${syncResult.error}`}
            </span>
          )}
        </div>
      </div>

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
          <div className={`badge ${importResult.success ? 'badge-success' : 'badge-error'}`} style={{ marginTop: 10, padding: '8px 14px', fontSize: 13 }}>
            {importResult.success ? `✓ Imported ${importResult.count} jobs` : `✗ ${importResult.error}`}
          </div>
        )}
      </div>
    </div>
  )
}
