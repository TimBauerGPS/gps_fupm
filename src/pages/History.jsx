import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import HistoryTable from '../components/HistoryTable.jsx'
import HistoryDetail from '../components/HistoryDetail.jsx'

export default function History() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase
      .from('communication_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.job_name?.toLowerCase().includes(q) ||
      r.template_name?.toLowerCase().includes(q) ||
      r.recipient_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Send History</h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Search by job number, template, or recipient…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <HistoryTable rows={filtered} onRowClick={setSelected} />
      )}

      {selected && (
        <HistoryDetail row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
