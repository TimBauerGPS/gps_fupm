import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function AdminRoute() {
  const [checked, setChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setChecked(true); return }

      const [{ data: sa }, { data: member }] = await Promise.all([
        supabase.from('super_admins').select('user_id').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('company_members').select('role').eq('user_id', session.user.id).maybeSingle(),
      ])

      setIsAdmin(!!sa || member?.role === 'admin')
      setChecked(true)
    }
    check()
  }, [])

  if (!checked) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
