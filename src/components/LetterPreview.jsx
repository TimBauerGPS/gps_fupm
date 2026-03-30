import { useEffect, useRef } from 'react'

export default function LetterPreview({ html, onChange }) {
  const ref = useRef(null)
  const lastHtml = useRef(html)

  useEffect(() => {
    if (ref.current && html !== lastHtml.current) {
      ref.current.innerHTML = html
      lastHtml.current = html
    }
  }, [html])

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = html
      lastHtml.current = html
    }
  }, [])

  function handleInput(e) {
    const val = e.currentTarget.innerHTML
    lastHtml.current = val
    onChange(val)
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Letter Preview</h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Click to edit inline</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="letter-body"
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '24px 28px',
          minHeight: 300,
          fontFamily: 'Georgia, serif',
          fontSize: 13,
          lineHeight: 1.7,
          background: '#fff',
          outline: 'none',
        }}
      />
    </div>
  )
}
