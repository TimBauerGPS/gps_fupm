import { useRef, useState } from 'react'

const MERGE_TAGS = {
  'Job Info': [
    { tag: 'JobNumber', label: 'Job Number' },
    { tag: 'InsuranceCompany', label: 'Insurance Company' },
  ],
  'Customer': [{ tag: 'CustomerName', label: 'Customer Name' }],
  'Property Address': [
    { tag: 'PAddress', label: 'Property Street Address' },
    { tag: 'PCity', label: 'Property City' },
    { tag: 'PState', label: 'Property State' },
    { tag: 'PZIP', label: 'Property ZIP' },
    { tag: 'PCounty', label: 'Property County' },
  ],
  'Mailing Address': [
    { tag: 'MAddress', label: 'Mailing Street Address' },
    { tag: 'MCity', label: 'Mailing City' },
    { tag: 'MState', label: 'Mailing State' },
    { tag: 'MZip', label: 'Mailing ZIP' },
  ],
  'Financial': [
    { tag: 'Balance', label: 'Outstanding Balance' },
    { tag: 'dateSent', label: 'Date Sent' },
  ],
  'Rep Info': [
    { tag: 'Rep', label: 'Rep Name' },
    { tag: 'RepPhone', label: 'Rep Phone' },
    { tag: 'RepEmail', label: 'Rep Email' },
  ],
  'Company Info': [
    { tag: 'CompanyName', label: 'Company Name' },
    { tag: 'CompanyAddress', label: 'Company Address' },
    { tag: 'LicenseLine', label: 'License Line' },
    { tag: 'CollectionAgency', label: 'Collection Agency' },
    { tag: 'CollectionAgencyPhone', label: 'Collection Agency Phone' },
    { tag: 'PaymentLink', label: 'Payment Link' },
    { tag: 'PaymentQRCode', label: 'Payment QR Code' },
    { tag: 'Logo', label: 'Company Logo' },
  ],
}

// Convert "Claim Amount" → "ask_Claim_Amount"
export function labelToAskTag(label) {
  return 'ask_' + label.trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
}

// Convert "ask_Claim_Amount" → "Claim Amount"
export function askTagToLabel(tag) {
  return tag.replace(/^ask_/, '').replace(/_/g, ' ')
}

export default function MergeTagPicker({ onInsert }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const customInputRef = useRef(null)

  function insertCustom() {
    const label = customLabel.trim()
    if (!label) return
    onInsert(`{{${labelToAskTag(label)}}}`)
    setCustomLabel('')
    setShowCustom(false)
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select
        value=""
        onChange={e => { if (e.target.value) onInsert(`{{${e.target.value}}}`); e.target.value = '' }}
        style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
      >
        <option value="">Insert merge tag…</option>
        {Object.entries(MERGE_TAGS).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map(item => (
              <option key={item.tag} value={item.tag}>{item.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {showCustom ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            ref={customInputRef}
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="Field label…"
            style={{ fontSize: 12, padding: '4px 8px', width: 140 }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); insertCustom() }
              if (e.key === 'Escape') { setShowCustom(false); setCustomLabel('') }
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={insertCustom}
            disabled={!customLabel.trim()}
            style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Insert
          </button>
          <button
            type="button"
            onClick={() => { setShowCustom(false); setCustomLabel('') }}
            style={{ fontSize: 12, padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setShowCustom(true); setTimeout(() => customInputRef.current?.focus(), 30) }}
          style={{
            fontSize: 12, padding: '4px 10px', background: 'transparent',
            border: '1px dashed var(--color-border)', borderRadius: 4,
            cursor: 'pointer', color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
          }}
          title="Insert a custom field that must be filled in at generate time"
        >
          + Custom field…
        </button>
      )}
    </div>
  )
}
