import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { getMissingProfileFields, hasCompleteProfile, saveMemberProfile } from '../lib/profile.js'
import JobSearch from '../components/JobSearch.jsx'
import HistoryTable from '../components/HistoryTable.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const [recentHistory, setRecentHistory] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [member, setMember] = useState(null)
  const [profileForm, setProfileForm] = useState({ display_name: '', rep_phone: '', rep_email: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()

      const memberPromise = session
        ? supabase
            .from('company_members')
            .select('user_id, company_id, role, display_name, rep_phone, rep_email')
            .eq('user_id', session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null })

      const [{ data }, { count }, { data: memberData }] = await Promise.all([
        supabase
          .from('communication_history')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(10),
        supabase
          .from('albi_jobs')
          .select('id', { count: 'exact', head: true }),
        memberPromise,
      ])

      setRecentHistory(data || [])
      setJobCount(count || 0)
      setMember(memberData || null)
      setProfileForm({
        display_name: memberData?.display_name || '',
        rep_phone: memberData?.rep_phone || '',
        rep_email: memberData?.rep_email || '',
      })
      setLoading(false)
    }
    load()
  }, [])

  function handleJobSelect(job) {
    navigate(`/jobs/${encodeURIComponent(job.name)}`)
  }

  function updatePhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    }
    setProfileForm(f => ({ ...f, rep_phone: formatted }))
  }

  async function handleProfileSave(e) {
    e.preventDefault()
    if (!member) return

    setProfileSaving(true)
    setProfileError('')

    const updates = {
      display_name: profileForm.display_name.trim(),
      rep_phone: profileForm.rep_phone.trim(),
      rep_email: profileForm.rep_email.trim(),
    }

    try {
      const updatedMember = await saveMemberProfile({
        userId: member.user_id,
        companyId: member.company_id,
        ...updates,
      })
      setMember(updatedMember)
      setProfileForm({
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

  const needsProfilePrompt = member && !hasCompleteProfile(member)
  const missingProfileFields = getMissingProfileFields(member)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {needsProfilePrompt && (
        <form onSubmit={handleProfileSave}>
          <div
            className="card"
            style={{
              marginBottom: 20,
              background: '#fffbeb',
              border: '1px solid #fcd34d',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: '#92400e' }}>Complete Your Information</h2>
                <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6, margin: 0, maxWidth: 760 }}>
                  Before sending letters, fill out your display name, phone, and email here. These fields power
                  {' '}
                  <code>{'{{Rep}}'}</code>, <code>{'{{RepPhone}}'}</code>, and <code>{'{{RepEmail}}'}</code>.
                </p>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                Missing: {missingProfileFields.join(', ')}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Display Name</label>
                <input
                  value={profileForm.display_name}
                  onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  value={profileForm.rep_phone}
                  onChange={e => updatePhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={profileForm.rep_email}
                  onChange={e => setProfileForm(f => ({ ...f, rep_email: e.target.value }))}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="btn-primary" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save Information'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/profile')}>
                Open My Profile
              </button>
            </div>
            {profileError && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{profileError}</p>}
          </div>
        </form>
      )}

      {profileSaved && !needsProfilePrompt && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#166534',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Your information is saved. You're ready to send communications.
        </div>
      )}

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
