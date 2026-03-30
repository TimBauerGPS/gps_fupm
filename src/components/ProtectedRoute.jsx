import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function ProtectedRoute({ session }) {
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('user_app_access')
      .select('role')
      .eq('app_name', 'fupm')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setHasAccess(!!data)
        setAccessChecked(true)
      })
  }, [session])

  if (!session) return <Navigate to="/login" replace />
  if (!accessChecked) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
  if (!hasAccess) return <Navigate to="/no-access" replace />

  return <Outlet />
}
