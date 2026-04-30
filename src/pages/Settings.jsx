import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import BrandingSettings from '../components/settings/BrandingSettings.jsx'
import ApiKeySettings from '../components/settings/ApiKeySettings.jsx'
import TemplateSettings from '../components/settings/TemplateSettings.jsx'
import UserSettings from '../components/settings/UserSettings.jsx'
import ImportSettings from '../components/settings/ImportSettings.jsx'
import ExternalApiKeySettings from '../components/settings/ExternalApiKeySettings.jsx'

const EXTERNAL_API_ADMIN_EMAIL = 'tbauer+allied@alliedrestoration.com'

export default function Settings() {
  const [companyId, setCompanyId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setUserEmail(session.user.email || '')
      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setCompanyId(data?.company_id)
    })
  }, [])

  useEffect(() => { setIsDirty(false) }, [companyId])

  // Warn on browser close/refresh when dirty
  useEffect(() => {
    if (!isDirty) return
    function onBeforeUnload(e) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function handleTabClick(to, e) {
    if (!isDirty) return // let NavLink handle it normally
    e.preventDefault()
    if (window.confirm('You have unsaved changes. Leave without saving?')) {
      setIsDirty(false)
      navigate(to)
    }
  }

  const canManageExternalApi = userEmail.toLowerCase() === EXTERNAL_API_ADMIN_EMAIL

  const tabs = [
    { to: '/settings/branding', label: 'Branding & Company' },
    { to: '/settings/api-keys', label: 'API Keys' },
    { to: '/settings/templates', label: 'Templates' },
    { to: '/settings/users', label: 'Users' },
    { to: '/settings/import', label: 'Import' },
  ]

  if (canManageExternalApi) {
    tabs.push({ to: '/settings/external-api', label: 'External API' })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            onClick={e => handleTabClick(t.to, e)}
            style={({ isActive }) => ({
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              textDecoration: 'none',
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {companyId ? (
        <Routes>
          <Route path="branding"   element={<BrandingSettings companyId={companyId} onDirtyChange={setIsDirty} />} />
          <Route path="api-keys"   element={<ApiKeySettings companyId={companyId} onDirtyChange={setIsDirty} />} />
          <Route path="templates"  element={<TemplateSettings companyId={companyId} onDirtyChange={setIsDirty} />} />
          <Route path="users"      element={<UserSettings companyId={companyId} onDirtyChange={setIsDirty} />} />
          <Route path="import"     element={<ImportSettings companyId={companyId} onDirtyChange={setIsDirty} />} />
          {canManageExternalApi && (
            <Route path="external-api" element={<ExternalApiKeySettings />} />
          )}
          <Route path="*"          element={<BrandingSettings companyId={companyId} onDirtyChange={setIsDirty} />} />
        </Routes>
      ) : (
        <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
      )}
    </div>
  )
}
