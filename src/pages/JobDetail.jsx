import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import JobCard from '../components/JobCard.jsx'
import TemplateSelector from '../components/TemplateSelector.jsx'
import LetterPreview from '../components/LetterPreview.jsx'
import SendPanel from '../components/SendPanel.jsx'
import HistoryTable from '../components/HistoryTable.jsx'
import { mergeTemplate, buildMergeData } from '../lib/mergeTemplate.js'
import { askTagToLabel } from '../components/MergeTagPicker.jsx'

export default function JobDetail() {
  const { jobName } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [settings, setSettings] = useState(null)
  const [member, setMember] = useState(null)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [renderedHtml, setRenderedHtml] = useState('')
  const [showSendPanel, setShowSendPanel] = useState(false)
  const [jobHistory, setJobHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preflightWarnings, setPreflightWarnings] = useState([])
  const [customFields, setCustomFields] = useState({})   // ask_* tag values

  useEffect(() => {
    async function load() {
      const decodedName = decodeURIComponent(jobName)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return navigate('/login')

      const [jobRes, memberRes, templatesRes, historyRes] = await Promise.all([
        supabase.from('albi_jobs').select('*').eq('name', decodedName).maybeSingle(),
        supabase.from('company_members').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('letter_templates').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('communication_history').select('*').eq('job_name', decodedName).order('sent_at', { ascending: false }),
      ])

      if (!jobRes.data) { setError('Job not found'); setLoading(false); return }

      const settingsRes = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', jobRes.data.company_id)
        .maybeSingle()

      setJob(jobRes.data)
      setMember(memberRes.data)
      setSettings(settingsRes.data)
      setTemplates(templatesRes.data || [])
      setJobHistory(historyRes.data || [])
      setLoading(false)
    }
    load()
  }, [jobName])

  function getPreflightWarnings() {
    const warnings = []
    if (!settings?.logo_url)
      warnings.push({ field: 'Company logo', tab: 'branding' })
    if (!member?.display_name || !member?.rep_phone || !member?.rep_email)
      warnings.push({ field: 'Your rep name, phone, and email', tab: 'users' })
    if (!settings?.company_name || !settings?.address_line1 || !settings?.city || !settings?.state || !settings?.zip)
      warnings.push({ field: 'Company name and address', tab: 'branding' })
    return warnings
  }

  function handleGenerate() {
    if (!selectedTemplate) return
    const warnings = getPreflightWarnings()
    setPreflightWarnings(warnings)
    const mergeData = buildMergeData({ job, settings, member, customFields })
    const html = mergeTemplate(selectedTemplate.body, mergeData)
    setRenderedHtml(html)
    setShowSendPanel(false)
  }

  // Detect {{ask_...}} tags in the selected template body
  const askTags = selectedTemplate
    ? [...new Set([...selectedTemplate.body.matchAll(/\{\{(ask_\w+)\}\}/g)].map(m => m[1]))]
    : []
  const allCustomFilled = askTags.every(tag => customFields[tag]?.trim())

  function handleSendComplete(results) {
    setShowSendPanel(false)
    // Refresh history
    supabase
      .from('communication_history')
      .select('*')
      .eq('job_name', job.name)
      .order('sent_at', { ascending: false })
      .then(({ data }) => setJobHistory(data || []))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
  if (error) return <div className="page"><p style={{ color: 'var(--color-danger)' }}>{error}</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn-secondary" style={{ fontSize: 12, marginBottom: 8 }} onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
          <h1 className="page-title">{job.name}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{job.customer}</p>
        </div>
      </div>

      {job.link_to_project?.startsWith('http') && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>View job in Albi:</span>
          <a
            href={job.link_to_project}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: 13, padding: '5px 14px', textDecoration: 'none' }}
          >
            Open in Albi →
          </a>
        </div>
      )}

      <JobCard job={job} onChange={setJob} />

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Generate Letter</h2>

        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <TemplateSelector
              templates={templates}
              value={selectedTemplate}
              onChange={t => { setSelectedTemplate(t); setRenderedHtml(''); setShowSendPanel(false); setCustomFields({}) }}
            />
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={!selectedTemplate || !allCustomFilled}
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {askTags.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            This template requires the following fields before generating:
          </p>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            {askTags.map(tag => (
              <div key={tag} className="form-group" style={{ minWidth: 180 }}>
                <label>
                  {askTagToLabel(tag)}
                  <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  value={customFields[tag] || ''}
                  onChange={e => setCustomFields(f => ({ ...f, [tag]: e.target.value }))}
                  placeholder={askTagToLabel(tag)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {preflightWarnings.length > 0 && renderedHtml && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 'var(--radius)',
          fontSize: 13,
        }}>
          <strong style={{ color: '#92400e' }}>⚠ Letter generated with incomplete settings:</strong>
          <ul style={{ marginTop: 6, paddingLeft: '1.25em', color: '#92400e' }}>
            {preflightWarnings.map(w => (
              <li key={w.field}>
                {w.field} is missing —{' '}
                <a href={`/settings?tab=${w.tab}`} style={{ color: '#92400e', fontWeight: 600 }}>
                  Fix in Settings
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {renderedHtml && (
        <>
          <LetterPreview
            html={renderedHtml}
            onChange={setRenderedHtml}
          />
          {!showSendPanel && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn-primary" style={{ fontSize: 15, padding: '10px 32px' }} onClick={() => setShowSendPanel(true)}>
                Continue to Send →
              </button>
            </div>
          )}
        </>
      )}

      {showSendPanel && (
        <SendPanel
          job={job}
          renderedHtml={renderedHtml}
          template={selectedTemplate}
          settings={settings}
          member={member}
          onComplete={handleSendComplete}
          onCancel={() => setShowSendPanel(false)}
        />
      )}

      {jobHistory.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Send History for this Job</h2>
          <HistoryTable rows={jobHistory} />
        </div>
      )}
    </div>
  )
}
