export function getJobBalance(job) {
  if (job?.balance_override_amount !== null && job?.balance_override_amount !== undefined) {
    return Number(job.balance_override_amount) || 0
  }
  return (Number(job?.total_invoice_amount) || 0) - (Number(job?.total_payment_amount) || 0)
}

export function classifyJobType(jobName) {
  const name = String(jobName || '').toUpperCase()
  if (name.includes('RBL') || name.includes('STR')) return 'Rebuild'
  if (name.includes('FIRE') || name.includes('SMK')) return 'Fire/Smoke'
  if (name.includes('EMS') || name.includes('WTR')) return 'Water'
  return 'Mold/BIO/Other'
}

export const PENDING_JOB_TYPES = ['Rebuild', 'Fire/Smoke', 'Water', 'Mold/BIO/Other']

export function daysSince(dateString) {
  if (!dateString) return null
  const start = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const today = new Date()
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((localToday - start) / 86400000))
}
