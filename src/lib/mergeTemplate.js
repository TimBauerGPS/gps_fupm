/**
 * Replace all {{Tag}} placeholders in an HTML template body with values from data.
 * Unmatched tags are left as-is.
 */
export function mergeTemplate(html, data) {
  let result = html.replace(/\{\{(\w+)\}\}/g, (match, tag) => {
    const value = data[tag]
    return value !== undefined && value !== null ? value : match
  })
  // Remove any <p> or <div> that became empty after merge (e.g. {{LicenseLine}} when blank)
  result = result.replace(/<p[^>]*>\s*<\/p>/gi, '')
  result = result.replace(/<div[^>]*>\s*<\/div>/gi, '')
  return result
}

/**
 * Build the merge data object from a job row, company settings, and user member record.
 */
export function buildMergeData({ job, settings, member, customFields = {} }) {
  const balance = ((job.total_invoice_amount || 0) - (job.total_payment_amount || 0))
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(balance)

  const mailing = {
    line1: job.mailing_address_1 || job.address_1 || '',
    city:  job.mailing_city      || job.city      || '',
    state: job.mailing_state     || job.state     || '',
    zip:   job.mailing_zip_code  || job.zip_code  || '',
  }

  const today = new Date()
  const dateSent = [
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
    today.getFullYear(),
  ].join('/')

  const companyAddress = [
    settings?.address_line1,
    settings?.city,
    settings?.state,
    settings?.zip,
  ].filter(Boolean).join(', ')

  const licenseLine = settings?.license_org
    ? `${settings.license_org} Lic ${settings.license_number || ''}`
    : ''

  return {
    JobNumber:        job.name || '',
    InsuranceCompany: job.insurance_company || '',
    CustomerName:   job.customer || '',
    PAddress:       job.address_1 || '',
    PCity:          job.city || '',
    PState:         job.state || '',
    PZIP:           job.zip_code || '',
    MAddress:       mailing.line1,
    MCity:          mailing.city,
    MState:         mailing.state,
    MZip:           mailing.zip,
    PCounty:        '',
    Balance:        formattedBalance,
    dateSent,
    Rep:            member?.display_name || '',
    RepPhone:       member?.rep_phone || '',
    RepEmail:       member?.rep_email || '',
    CompanyName:    settings?.company_name || '',
    CompanyAddress: companyAddress,
    LicenseLine:    licenseLine,
    Logo: settings?.logo_url
      ? `<div style="text-align:center;margin-bottom:24px"><img src="${settings.logo_url}" alt="${settings?.company_name || 'Company'} logo" style="max-height:80px;max-width:280px;object-fit:contain;"></div>`
      : '',
    CollectionAgency:      settings?.collection_agency || '',
    CollectionAgencyPhone: settings?.collection_agency_phone || '',
    PaymentLink: settings?.payment_link
      ? `<a href="${settings.payment_link}">${settings.payment_link}</a>`
      : '',
    PaymentQRCode: settings?.payment_link
      ? `<div style="text-align:center;margin:16px 0"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(settings.payment_link)}" alt="Pay Now - Scan to pay" style="width:160px;height:160px"></div>`
      : '',
    ...customFields,
  }
}
