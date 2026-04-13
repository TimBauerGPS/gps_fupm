import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import JobSearch from '../components/JobSearch.jsx'
import HistoryTable from '../components/HistoryTable.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const [recentHistory, setRecentHistory] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from('communication_history')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(10),
        supabase
          .from('albi_jobs')
          .select('id', { count: 'exact', head: true }),
      ])
      setRecentHistory(data || [])
      setJobCount(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  function handleJobSelect(job) {
    navigate(`/jobs/${encodeURIComponent(job.name)}`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        {jobCount > 0 ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              To send an invoice or collection letter, please enter a job number or customer name.
            </p>
            <JobSearch onSelect={handleJobSelect} />
          </>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              No jobs have been imported yet. An admin can import a CSV in Settings before anyone can search or send communications from the dashboard.
            </p>
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Recent activity</h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
        ) : (
          <HistoryTable rows={recentHistory} compact />
        )}
      </div>
    </div>
  )
}
