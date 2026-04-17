import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import Nav from './components/Nav.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Login from './pages/Login.jsx'
import NoAccess from './pages/NoAccess.jsx'
import AuthConfirm from './pages/AuthConfirm.jsx'
import Dashboard from './pages/Dashboard.jsx'
import JobDetail from './pages/JobDetail.jsx'
import History from './pages/History.jsx'
import Inbox from './pages/Inbox.jsx'
import Profile from './pages/Profile.jsx'
import Report from './pages/Report.jsx'
import Settings from './pages/Settings.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      {session && <Nav />}
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />

        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs/:jobName" element={<JobDetail />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/report" element={<Report />} />

          <Route element={<AdminRoute />}>
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
