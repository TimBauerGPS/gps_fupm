import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function BrandingSettings({ companyId, onDirtyChange }) {
  const FORM_KEYS = ['company_name', 'address_line1', 'city', 'state', 'zip', 'license_org', 'license_number', 'logo_url', 'collection_agency', 'collection_agency_phone', 'payment_link']
  const [form, setForm] = useState({
    company_name: '', address_line1: '', city: '', state: '', zip: '',
    license_org: '', license_number: '', logo_url: '',
    collection_agency: '', collection_agency_phone: '', payment_link: '',
  })
  const [savedForm, setSavedForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [logoResizedMsg, setLogoResizedMsg] = useState('')
  const logoInputRef = useRef(null)

  function normalize(data) {
    const out = {}
    for (const [k, v] of Object.entries(data)) out[k] = v == null ? '' : v
    return out
  }

  useEffect(() => {
    supabase.from('company_settings').select('*').eq('company_id', companyId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const normalized = normalize(data)
          // Only pick form-relevant keys so savedForm and form have identical key order
          const picked = Object.fromEntries(FORM_KEYS.map(k => [k, normalized[k] ?? '']))
          setForm(picked)
          setSavedForm(picked)
        }
      })
  }, [companyId])

  useEffect(() => {
    if (!savedForm) return
    // Compare only form keys to avoid key-order false positives
    const dirty = FORM_KEYS.some(k => (form[k] ?? '') !== (savedForm[k] ?? ''))
    onDirtyChange?.(dirty)
  }, [form, savedForm])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('company_settings').upsert({ ...form, company_id: companyId }, { onConflict: 'company_id' })
    setSaving(false)
    setSaved(true)
    setSavedForm({ ...form })
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2500)
  }

  async function resizeIfNeeded(file, maxWidth = 600) {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        if (img.width <= maxWidth) {
          resolve({ blob: file, resized: false, origW: img.width, origH: img.height })
          return
        }
        const scale = maxWidth / img.width
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          blob => resolve({ blob, resized: true, origW: img.width, origH: img.height, newW: canvas.width, newH: canvas.height }),
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.92
        )
      }
      img.onerror = () => resolve({ blob: file, resized: false, error: 'Could not read image dimensions' })
      img.src = url
    })
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setLogoUploading(true)
    setLogoError('')
    setLogoResizedMsg('')
    const { blob, resized, origW, origH, newW, newH, error: resizeError } = await resizeIfNeeded(file)
    if (resizeError) {
      setLogoError(`Logo display error: ${resizeError}`)
      setLogoUploading(false)
      return
    }
    if (resized) {
      setLogoResizedMsg(`Logo resized from ${origW}×${origH}px to ${newW}×${newH}px to fit in letters.`)
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${companyId}/logo.${ext}`
    const { error } = await supabase.storage
      .from('company-assets')
      .upload(path, blob, { upsert: true, contentType: file.type })
    if (error) {
      setLogoError(error.message)
    } else {
      const { data } = supabase.storage.from('company-assets').getPublicUrl(path)
      setForm(f => ({ ...f, logo_url: data.publicUrl }))
    }
    setLogoUploading(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  function update(field, val) { setForm(f => ({ ...f, [field]: val })) }

  function updatePhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length > 0) {
      formatted = `(${digits}`
    }
    setForm(f => ({ ...f, collection_agency_phone: formatted }))
  }

  return (
    <form onSubmit={handleSave}>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Company Logo</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Appears at the top of generated letters. PNG or JPG, recommended width 400–600px.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="Company logo"
              style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 8, background: '#fff' }}
            />
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLogoUpload}
              disabled={logoUploading}
              style={{ width: 'auto' }}
            />
            {logoUploading && <div style={{ marginTop: 6, fontSize: 12 }}><span className="spinner" style={{ width: 12, height: 12 }} /> Uploading…</div>}
            {logoError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-danger)' }}>{logoError}</div>}
            {logoResizedMsg && <div style={{ marginTop: 6, fontSize: 12, color: '#92400e' }}>{logoResizedMsg}</div>}
            {form.logo_url && (
              <button
                type="button"
                style={{ marginTop: 8, fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--color-danger)' }}
                onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
              >
                Remove logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Company Identity</h3>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Company Name</label>
          <input value={form.company_name} onChange={e => update('company_name', e.target.value)} required />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Address</label>
          <input value={form.address_line1} onChange={e => update('address_line1', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group"><label>City</label><input value={form.city} onChange={e => update('city', e.target.value)} /></div>
          <div className="form-group" style={{ maxWidth: 80 }}><label>State</label><input value={form.state} onChange={e => update('state', e.target.value)} /></div>
          <div className="form-group" style={{ maxWidth: 100 }}><label>ZIP</label><input value={form.zip} onChange={e => update('zip', e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>License Line</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Leave "License Org" blank to omit the license line from letters entirely.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>License Org (e.g. CSLB)</label>
            <input value={form.license_org || ''} onChange={e => update('license_org', e.target.value)} placeholder="Leave blank to omit" />
          </div>
          <div className="form-group">
            <label>License Number</label>
            <input value={form.license_number || ''} onChange={e => update('license_number', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Collection Agency</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Used in templates via <code style={{ fontSize: 11 }}>{'{{CollectionAgency}}'}</code> and <code style={{ fontSize: 11 }}>{'{{CollectionAgencyPhone}}'}</code>. Leave blank to omit.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Collection Agency Name</label>
            <input value={form.collection_agency || ''} onChange={e => update('collection_agency', e.target.value)} placeholder="e.g. National Recovery Group" />
          </div>
          <div className="form-group">
            <label>Collection Agency Phone</label>
            <input value={form.collection_agency_phone || ''} onChange={e => updatePhone(e.target.value)} placeholder="(XXX) XXX-XXXX" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Payment Link</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          Used in templates via <code style={{ fontSize: 11 }}>{'{{PaymentLink}}'}</code> and <code style={{ fontSize: 11 }}>{'{{PaymentQRCode}}'}</code>. The QR code is generated automatically from this URL.
        </p>
        <div className="form-group">
          <label>Payment URL</label>
          <input
            type="url"
            value={form.payment_link || ''}
            onChange={e => update('payment_link', e.target.value)}
            placeholder="https://paynow.cardx.com/yourcompany"
          />
        </div>
        {form.payment_link && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(form.payment_link)}`}
              alt="Payment QR Code preview"
              style={{ width: 80, height: 80, border: '1px solid var(--color-border)', borderRadius: 4, padding: 4, background: '#fff' }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>QR code preview — this is what will appear in letters.</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>✓ Saved</span>}
      </div>
    </form>
  )
}
