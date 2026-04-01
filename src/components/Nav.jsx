import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import posterImg from '../assets/fupm-poster.jpg'

export default function Nav() {
  const [expanded, setExpanded]         = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isAdmin, setIsAdmin]           = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('super_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
        .then(({ data }) => setIsSuperAdmin(!!data))
      supabase.from('company_members').select('role').eq('user_id', session.user.id).maybeSingle()
        .then(({ data }) => setIsAdmin(data?.role === 'admin'))
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <>
      <nav className="nav">
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img
            src={posterImg}
            alt="FUPM"
            style={{ height: 40, borderRadius: 4, objectFit: 'cover', transition: 'opacity .15s' }}
          />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary)', letterSpacing: '.03em' }}>FUPM</span>
        </button>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/inbox" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Inbox
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          History
        </NavLink>
        <NavLink to="/report" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Report
        </NavLink>
        {isAdmin && (
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Settings
          </NavLink>
        )}
        <span className="nav-spacer" />
        {isSuperAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Super Admin
          </NavLink>
        )}
        <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          My Profile
        </NavLink>
        <button className="btn-secondary" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleSignOut}>
          Sign out
        </button>
      </nav>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={posterImg}
            alt="FUPM"
            style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
