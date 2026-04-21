import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { classifyJobType, daysSince, getJobBalance, PENDING_JOB_TYPES } from '../lib/jobUtils.js'
import { formatCurrency, formatDate } from '../lib/formatters.js'

export default function JobsPendingApproval() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [historyByJob, setHistoryByJob] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')

    const { data: jobRows, error: jobError } = await supabase
      .from('albi_jobs')
      .select('*')
      .eq('pending_insurance_approval', true)
      .order('pending_invoice_date', { ascending: true })
      .order('name', { ascending: true })

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    const names = (jobRows || []).map(job => job.name)
    let historyMap = {}

    if (names.length > 0) {
      const { data: historyRows, error: historyError } = await supabase
        .from('communication_history')
        .select('id, job_name, template_name, channels, sent_at')
        .in('job_name', names)
        .order('sent_at', { ascending: false })

      if (historyError) {
        setError(historyError.message)
        setLoading(false)
        return
      }

      for (const row of historyRows || []) {
        if (!historyMap[row.job_name]) historyMap[row.job_name] = row
      }
    }

    setJobs(jobRows || [])
    setHistoryByJob(historyMap)
    setLoading(false)
  }

  const groupedJobs = useMemo(() => {
    const groups = Object.fromEntries(PENDING_JOB_TYPES.map(type => [type, []]))
    for (const job of jobs) {
      groups[classifyJobType(job.name)].push(job)
    }
    return groups
  }, [jobs])

  async function removeJob(job) {
    if (!window.confirm(`Remove ${job.name} from Jobs Pending Approval and delete the invoice date?`)) return
    setDeletingId(job.id)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/update-job-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          jobId: job.id,
          updates: {
            pending_insurance_approval: false,
            pending_invoice_date: null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not remove job')
      setJobs(current => current.filter(row => row.id !== job.id))
    } catch (err) {
      setError(err.message)
    }
    setDeletingId(null)
  }

  function exportXls() {
    const html = buildExportHtml(groupedJobs, historyByJob)
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jobs-pending-approval-${new Date().toISOString().slice(0, 10)}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs Pending Approval</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Jobs marked Pending Insurance Approval from the job detail page.
          </p>
        </div>
        <button className="btn-primary" onClick={exportXls}>Export XLS</button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#fecaca', color: 'var(--color-danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {PENDING_JOB_TYPES.map(type => (
        <PendingGroup
          key={type}
          type={type}
          jobs={groupedJobs[type]}
          historyByJob={historyByJob}
          deletingId={deletingId}
          onDelete={removeJob}
          onOpen={job => navigate(`/jobs/${encodeURIComponent(job.name)}`)}
        />
      ))}
    </div>
  )
}

function PendingGroup({ type, jobs, historyByJob, deletingId, onDelete, onOpen }) {
  const total = jobs.reduce((sum, job) => sum + getJobBalance(job), 0)

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>{type}</h2>
        <div style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
          Total: {formatCurrency(total)}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          No jobs of this type pending insurance approval
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <Th>Job Number</Th>
                <Th>Customer</Th>
                <Th>Invoice Date</Th>
                <Th>Days Aged</Th>
                <Th>Balance Due</Th>
                <Th>Most Recent Letter</Th>
                <Th>Letter Sent</Th>
                <Th>Mode</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const history = historyByJob[job.name]
                return (
                  <tr key={job.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      {job.link_to_project?.startsWith('http') ? (
                        <a href={job.link_to_project} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                          {job.name}
                        </a>
                      ) : (
                        <strong>{job.name}</strong>
                      )}
                    </Td>
                    <Td>{job.customer || '-'}</Td>
                    <Td>{formatDate(job.pending_invoice_date)}</Td>
                    <Td>{daysSince(job.pending_invoice_date) ?? '-'}</Td>
                    <Td>{formatCurrency(getJobBalance(job))}</Td>
                    <Td>{history?.template_name || '-'}</Td>
                    <Td>{history?.sent_at ? formatDate(history.sent_at) : '-'}</Td>
                    <Td>{history?.channels?.length ? history.channels.join('/') : '-'}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => onOpen(job)}>
                          Open in Dashboard
                        </button>
                        <button
                          className="btn-danger"
                          style={{ fontSize: 12, padding: '5px 10px' }}
                          disabled={deletingId === job.id}
                          onClick={() => onDelete(job)}
                        >
                          {deletingId === job.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{children}</th>
}

function Td({ children }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{children}</td>
}

function buildExportHtml(groupedJobs, historyByJob) {
  const sections = PENDING_JOB_TYPES.map(type => {
    const rows = groupedJobs[type]
    const total = rows.reduce((sum, job) => sum + getJobBalance(job), 0)
    const body = rows.length === 0
      ? `<tr><td colspan="8">No jobs of this type pending insurance approval</td></tr>`
      : rows.map(job => {
          const history = historyByJob[job.name]
          return [
            '<tr>',
            cell(job.name),
            cell(job.customer || ''),
            cell(formatDate(job.pending_invoice_date)),
            cell(daysSince(job.pending_invoice_date) ?? ''),
            cell(getJobBalance(job)),
            cell(history?.template_name || ''),
            cell(history?.sent_at ? formatDate(history.sent_at) : ''),
            cell(history?.channels?.length ? history.channels.join('/') : ''),
            '</tr>',
          ].join('')
        }).join('')

    return [
      `<tr><th colspan="8" style="text-align:left">${escapeHtml(type)} - Total ${escapeHtml(formatCurrency(total))}</th></tr>`,
      '<tr><th>Job Number</th><th>Customer</th><th>Invoice Date</th><th>Days Aged</th><th>Balance Due</th><th>Most Recent Letter</th><th>Letter Sent</th><th>Mode</th></tr>',
      body,
      '<tr><td colspan="8"></td></tr>',
    ].join('')
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${sections}</table></body></html>`
}

function cell(value) {
  return `<td>${escapeHtml(value)}</td>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
