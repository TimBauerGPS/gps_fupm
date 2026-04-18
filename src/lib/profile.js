import { supabase } from './supabase.js'

const PROFILE_FIELDS = [
  ['display_name', 'display name'],
  ['rep_phone', 'phone'],
  ['rep_email', 'email'],
]

export function getMissingProfileFields(member) {
  return PROFILE_FIELDS
    .filter(([field]) => !member?.[field]?.toString().trim())
    .map(([, label]) => label)
}

export function hasCompleteProfile(member) {
  return getMissingProfileFields(member).length === 0
}

export async function saveMemberProfile({ userId, companyId, display_name, rep_phone, rep_email }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/update-member-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      userId,
      companyId,
      displayName: display_name,
      repPhone: rep_phone,
      repEmail: rep_email,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Unable to save profile')
  }

  return data.member
}
