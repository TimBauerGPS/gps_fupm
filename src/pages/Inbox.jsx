import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

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
  const [threads, setThreads] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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

      const inbound  = inboundRes.data  || []
      const outbound = outboundRes.data || []

      // Only show threads where there's at least one inbound reply
      const repliedPhones = new Set(inbound.map(m => m.from_phone))

      // Group outbound by phone, filtered to replied-only
      const threadMap = {}
      for (const msg of outbound) {
        const phone = msg.recipient_phone
        if (!phone || !repliedPhones.has(phone)) continue
        if (!threadMap[phone]) {
          threadMap[phone] = {
            phone,
            name:     msg.recipient_name,
            jobName:  msg.job_name,
            messages: [],
            lastAt:   msg.sent_at,
          }
        }
        threadMap[phone].messages.push({
          id:        msg.id,
          direction: 'out',
          body:      msg.sms_body,
          at:        msg.sent_at,
          jobName:   msg.job_name,
        })
        if (msg.sent_at > threadMap[phone].lastAt) {
          threadMap[phone].lastAt  = msg.sent_at
          threadMap[phone].jobName = msg.job_name
          threadMap[phone].name    = msg.recipient_name || threadMap[phone].name
        }
      }

      // Merge inbound replies into threads
      for (const msg of inbound) {
        const phone = msg.from_phone
        if (!threadMap[phone]) {
          // Inbound with no known outbound — still show it
          threadMap[phone] = {
            phone,
            name:     phone,
            jobName:  msg.job_name,
            messages: [],
            lastAt:   msg.received_at,
          }
        }
        threadMap[phone].messages.push({
          id:        msg.id,
          direction: 'in',
          body:      msg.body,
          at:        msg.received_at,
          jobName:   msg.job_name,
        })
        if (msg.received_at > threadMap[phone].lastAt) {
          threadMap[phone].lastAt  = msg.received_at
          if (msg.job_name) threadMap[phone].jobName = msg.job_name
        }
      }

      // Sort messages within each thread chronologically
      for (const t of Object.values(threadMap)) {
        t.messages.sort((a, b) => a.at.localeCompare(b.at))
      }

      const sorted = Object.values(threadMap).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
      setThreads(sorted)
      if (sorted.length > 0) setSelected(sorted[0])
      setLoading(false)
    }
    load()
  }, [])

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
              onClick={() => setSelected(t)}
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
                {lastMsg?.direction === 'in' ? '' : 'You: '}{lastMsg?.body || ''}
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
            }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name || selected.phone}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span>{selected.phone}</span>
                {selected.jobName && (
                  <>
                    <span>·</span>
                    <a
                      href={`/jobs/${encodeURIComponent(selected.jobName)}`}
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
