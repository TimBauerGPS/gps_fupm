import { supabase } from '../lib/supabase.js'

export default function NoAccess() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: 40 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Access Required</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
          Your account hasn't been granted access to FUPM yet. Contact your company admin to be invited.
        </p>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
