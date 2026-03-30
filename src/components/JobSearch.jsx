import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function JobSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timer.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('albi_jobs')
        .select('id, name, customer, city, state')
        .or(`name.ilike.%${val}%,customer.ilike.%${val}%`)
        .limit(10)
      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 250)
  }

  function handleSelect(job) {
    setQuery(job.name)
    setOpen(false)
    onSelect(job)
  }

  return (
    <div ref={ref} style={{ position: 'relative', maxWidth: 500 }}>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search by job number or customer name…"
          autoComplete="off"
        />
        {loading && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <span className="spinner" />
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 4px 12px rgba(0,0,0,.1)',
          zIndex: 100,
          marginTop: 4,
        }}>
          {results.map(job => (
            <div
              key={job.id}
              onClick={() => handleSelect(job)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{job.name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                {job.customer} — {job.city}, {job.state}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && results.length === 0 && query && !loading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          color: 'var(--color-text-muted)',
          fontSize: 13,
          marginTop: 4,
        }}>
          No jobs found for "{query}"
        </div>
      )}
    </div>
  )
}
