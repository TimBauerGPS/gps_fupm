import { Resend } from 'resend'

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function getAuthEmailConfig() {
  const defaultSiteUrl = process.env.NETLIFY_DEV === 'true'
    ? 'http://localhost:8888'
    : 'https://fupm.netlify.app'

  const siteUrl = (
    process.env.INVITE_REDIRECT_URL ||
    process.env.APP_URL ||
    defaultSiteUrl
  ).replace(/\/+$/, '')

  const appName = process.env.APP_NAME || 'FUPM'
  const fromDomain = (process.env.RESEND_FROM_DOMAIN || new URL(siteUrl).hostname).trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL || `noreply@${fromDomain}`

  return {
    appName,
    siteUrl,
    redirectTo: `${siteUrl}/dashboard`,
    fromEmail,
  }
}

export async function sendAuthEmail({ toEmail, actionLink, companyName, role, mode }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured for auth emails')
  }

  const { appName, fromEmail } = getAuthEmailConfig()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const safeAppName = escapeHtml(appName)
  const safeActionLink = escapeHtml(actionLink)
  const safeCompanyName = companyName ? escapeHtml(companyName) : null
  const roleLine = role ? `Role: ${role}\n` : ''

  const introText = mode === 'invite'
    ? `You've been invited to ${appName}${companyName ? ` for ${companyName}` : ''}.`
    : `Use this secure magic link to sign in to ${appName}.`

  const bodyText = [
    introText,
    roleLine.trim(),
    '',
    actionLink,
    '',
    'This link signs you in securely and expires automatically.',
    "If you weren't expecting this email, you can ignore it.",
  ].filter(Boolean).join('\n')

  const companyLine = safeCompanyName
    ? `<p style="margin:0 0 14px;color:#334155;font-size:14px;"><strong>Company:</strong> ${safeCompanyName}</p>`
    : ''

  const roleHtml = role
    ? `<p style="margin:0 0 14px;color:#334155;font-size:14px;"><strong>Role:</strong> ${escapeHtml(role)}</p>`
    : ''

  const introHtml = mode === 'invite'
    ? `<p style="margin:0 0 14px;color:#334155;font-size:15px;">You've been invited to join ${safeAppName}.</p>`
    : `<p style="margin:0 0 14px;color:#334155;font-size:15px;">Use this secure magic link to sign in to ${safeAppName}.</p>`

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <p style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">${safeAppName}</p>
        ${introHtml}
        ${companyLine}
        ${roleHtml}
        <p style="margin:0 0 24px;">
          <a
            href="${safeActionLink}"
            style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;"
          >
            Open Magic Link
          </a>
        </p>
        <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.7;word-break:break-word;">
          <a href="${safeActionLink}" style="color:#0f766e;">${safeActionLink}</a>
        </p>
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
          This link signs you in securely and expires automatically. If you weren't expecting this email, you can ignore it.
        </p>
      </div>
    </div>
  `

  const { error } = await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: [toEmail],
    subject: 'FUPM Magic Link',
    text: bodyText,
    html,
  })

  if (error) {
    throw new Error(error.message)
  }
}
