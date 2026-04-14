import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

function draftStorageKey(companyId, phone) {
  return `fupm:sms-draft:${companyId || 'unknown'}:${phone || 'unknown'}`
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatFullTime(iso) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Inbox() {
  const [threads, setThreads]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [member, setMember]       = useState(null)
  const [companyId, setCompanyId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: memberData } = await supabase
        .from('company_members')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      setMember(memberData)
      setCompanyId(memberData?.company_id || null)

      // Fetch inbound replies and outbound SMS in parallel
      const [inboundRes, outboundRes] = await Promise.all([
        supabase
          .from('sms_inbound')
          .select('id, from_phone, body, received_at, job_name')
          .order('received_at', { ascending: true }),
        supabase
          .from('communication_history')
          .select('id, recipient_name, recipient_phone, job_name, sms_body, sent_at, channels')
          .contains('channels', ['sms'])
          .order('sent_at', { ascending: true }),
      ])

      const builtThreads = buildThreads(inboundRes.data || [], outboundRes.data || [])

      // Fetch Albi links for all unique job names
      const jobNames = [...new Set(builtThreads.map(t => t.jobName).filter(Boolean))]
      if (jobNames.length > 0) {
        const { data: jobs } = await supabase
          .from('albi_jobs')
          .select('name, link_to_project')
          .in('name', jobNames)
        const linkMap = {}
        for (const j of jobs || []) {
          if (j.link_to_project?.startsWith('http')) linkMap[j.name] = j.link_to_project
        }
        builtThreads.forEach(t => { t.albiLink = linkMap[t.jobName] || null })
      }

      setThreads(builtThreads)
      if (builtThreads.length > 0) setSelected(builtThreads[0])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selected?.phone) return
    setReplyText(localStorage.getItem(draftStorageKey(companyId, selected.phone)) || '')
    setSendError('')
  }, [companyId, selected?.phone])

  // Scroll to bottom when messages change or thread changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages?.length, selected?.phone])

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || !selected || sending) return
    if (!selected.jobName) {
      setSendError('This conversation is missing a job number, so the reply cannot be saved to inbox history yet.')
      return
    }
    setSending(true)
    setSendError('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          smsBody:   replyText.trim(),
          toPhone:   selected.phone,
          jobName:   selected.jobName,
          companyId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')

      // Save to history
      const historyRes = await fetch('/api/save-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          jobName:        selected.jobName,
          templateName:   'Inbox reply',
          sentByName:     member?.display_name,
          channels:       ['sms'],
          smsStatus:      'sent',
          smsBody:        replyText.trim(),
          recipientName:  selected.name,
          recipientPhone: selected.phone,
          twilioMessageSid: data.sid,
        }),
      })

      const historyData = await historyRes.json()
      if (!historyRes.ok) {
        throw new Error(historyData.error || 'Message sent, but saving to inbox history failed')
      }

      // Optimistically append to thread
      const newMsg = {
        id:        `local-${Date.now()}`,
        direction: 'out',
        body:      replyText.trim(),
        at:        new Date().toISOString(),
        jobName:   selected.jobName,
      }
      setSelected(s => ({ ...s, messages: [...s.messages, newMsg], lastAt: newMsg.at }))
      setThreads(ts => ts.map(t =>
        t.phone === selected.phone
          ? { ...t, messages: [...t.messages, newMsg], lastAt: newMsg.at }
          : t
      ))
      localStorage.removeItem(draftStorageKey(companyId, selected.phone))
      setReplyText('')
    } catch (err) {
      setSendError(err.message)
    }
    setSending(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  if (threads.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">SMS Inbox</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 14 }}>
          No replies yet. Conversations will appear here when customers reply to your SMS messages.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Thread list */}
      <div style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
        background: 'var(--color-surface)',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Inbox</h2>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Showing customers who replied
          </p>
        </div>
        {threads.map(t => {
          const isActive = selected?.phone === t.phone
          const lastMsg  = t.messages[t.messages.length - 1]
          return (
            <button
              key={t.phone}
              onClick={() => { setSelected(t) }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                background: isActive ? 'var(--color-primary-light, #eff6ff)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                  {t.name || t.phone}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {formatTime(t.lastAt)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                {t.jobName}
              </div>
              <div style={{
                fontSize: 12,
                color: lastMsg?.direction === 'in' ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontWeight: lastMsg?.direction === 'in' ? 500 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 220,
              }}>
                {lastMsg?.direction === 'out' ? 'You: ' : ''}{lastMsg?.body || ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* Message pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              flexShrink: 0,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name || selected.phone}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span>{selected.phone}</span>
                {selected.jobName && (
                  <>
                    <span>·</span>
                    <a
                      href={selected.albiLink || `/jobs/${encodeURIComponent(selected.jobName)}`}
                      target={selected.albiLink ? '_blank' : undefined}
                      rel={selected.albiLink ? 'noopener noreferrer' : undefined}
                      style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                    >
                      {selected.jobName}
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              {selected.messages.map(msg => {
                const isOut = msg.direction === 'out'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        background: isOut ? 'var(--color-primary)' : '#e5e7eb',
                        color: isOut ? '#fff' : 'var(--color-text)',
                        borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: '10px 14px',
                        fontSize: 14,
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {msg.body}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        textAlign: isOut ? 'right' : 'left',
                        marginTop: 4,
                      }}>
                        {formatFullTime(msg.at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply compose */}
            <div style={{
              borderTop: '1px solid var(--color-border)',
              padding: '12px 16px',
              background: 'var(--color-surface)',
              flexShrink: 0,
            }}>
              {sendError && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>{sendError}</p>
              )}
              {!selected.jobName && (
                <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                  This conversation does not have a linked job number yet. Replies are disabled until the thread can be tied back to a job.
                </p>
              )}
              <form onSubmit={handleReply} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={replyText}
                  onChange={e => {
                    const nextValue = e.target.value
                    setReplyText(nextValue)
                    if (selected?.phone) {
                      localStorage.setItem(draftStorageKey(companyId, selected.phone), nextValue)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e) }
                  }}
                  placeholder="Reply… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  style={{
                    flex: 1,
                    resize: 'none',
                    borderRadius: 20,
                    padding: '10px 16px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    lineHeight: 1.4,
                  }}
                  disabled={sending || !selected.jobName}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!replyText.trim() || sending || !selected.jobName}
                  style={{ borderRadius: 20, padding: '10px 20px', fontSize: 14, flexShrink: 0 }}
                >
                  {sending ? <span className="spinner" style={{ borderTopColor: '#fff', width: 14, height: 14 }} /> : 'Send'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Select a conversation
          </div>
        )}
      </div>
    </div>
  )
}

function buildThreads(inbound, outbound) {
  const repliedPhones = new Set(inbound.map(m => m.from_phone))
  const threadMap = {}

  for (const msg of outbound) {
    const phone = msg.recipient_phone
    if (!phone || !repliedPhones.has(phone)) continue
    if (!threadMap[phone]) {
      threadMap[phone] = { phone, name: msg.recipient_name, jobName: msg.job_name, messages: [], lastAt: msg.sent_at }
    }
    threadMap[phone].messages.push({ id: msg.id, direction: 'out', body: msg.sms_body, at: msg.sent_at, jobName: msg.job_name })
    if (msg.sent_at > threadMap[phone].lastAt) {
      threadMap[phone].lastAt  = msg.sent_at
      threadMap[phone].jobName = msg.job_name
      threadMap[phone].name    = msg.recipient_name || threadMap[phone].name
    }
  }

  for (const msg of inbound) {
    const phone = msg.from_phone
    if (!threadMap[phone]) {
      threadMap[phone] = { phone, name: phone, jobName: msg.job_name, messages: [], lastAt: msg.received_at }
    }
    threadMap[phone].messages.push({ id: msg.id, direction: 'in', body: msg.body, at: msg.received_at, jobName: msg.job_name })
    if (msg.received_at > threadMap[phone].lastAt) {
      threadMap[phone].lastAt = msg.received_at
      if (msg.job_name) threadMap[phone].jobName = msg.job_name
    }
  }

  for (const t of Object.values(threadMap)) {
    t.messages.sort((a, b) => a.at.localeCompare(b.at))
  }

  return Object.values(threadMap).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}
