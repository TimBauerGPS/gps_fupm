import Papa from 'papaparse'
import { normalizePhone } from './formatters.js'

// Header name → albi_jobs column mapping
const HEADER_MAP = {
  'Name':                     'name',
  'Customer':                 'customer',
  'Customer Email':           'customer_email',
  'Customer Phone Number':    'customer_phone_number',
  'Address 1':                'address_1',
  'City':                     'city',
  'State':                    'state',
  'Zip Code':                 'zip_code',
  'Mailing Address 1':        'mailing_address_1',
  'Mailing City':             'mailing_city',
  'Mailing State':            'mailing_state',
  'Mailing Zip Code':         'mailing_zip_code',
  'Total Invoice Amount':     'total_invoice_amount',
  'Total Payment Amount':     'total_payment_amount',
  'Deductible':               'deductible',
  'Created At':               'created_at_albi',
  'Link to Project':          'link_to_project',
  'Sales Person':             'sales_person',
  'Inspection Date':          'inspection_date',
  'Estimator':                'estimator',
  'Estimated Revenue':        'estimated_revenue',
  'Estimated Work Start Date':'estimated_work_start_date',
  'File Closed':              'file_closed',
  'Referrer':                 'referrer',
  'Estimate Sent':            'estimate_sent',
  'Project Manager':          'project_manager',
  'Status':                   'status',
  'Total Actual Expenses':    'total_actual_expenses',
  'Accrual Revenue':          'accrual_revenue',
  'Contract Signed':          'contract_signed',
  'COC/COS Signed':           'coc_cos_signed',
  'Invoiced':                 'invoiced',
  'Insurance Company':        'insurance_company',
  'Insurance Claim Number':   'insurance_claim_number',
  'Work Start':               'work_start',
  'Property Type':            'property_type',
  'Paid':                     'paid',
  'Estimated Completion Date':'estimated_completion_date',
}

export function parseAlbiCSV(csvText) {
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  })

  if (errors.length) {
    console.warn('CSV parse warnings:', errors)
  }

  return mapRows(data, 'csv')
}

export function parseAlbiRows(rows) {
  // rows[0] = header row (array of strings), rows[1..] = data rows
  if (!rows || rows.length < 2) return []

  const headers = rows[0].map(h => h?.toString().trim())
  const nameIdx = headers.findIndex(h => h === 'Name')
  if (nameIdx === -1) {
    throw new Error("Required column 'Name' not found in import data")
  }

  const objects = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })

  return mapRows(objects, 'google_sheets')
}

function mapRows(rows, importSource) {
  return rows
    .filter(row => row['Name'] || row['name'])
    .map(row => {
      const job = { import_source: importSource }

      for (const [header, col] of Object.entries(HEADER_MAP)) {
        const raw = row[header]
        if (raw === undefined || raw === null || raw === '') continue

        if (col === 'link_to_project') {
          const s = String(raw).trim()
          // Google Sheets API (FORMULA mode): =HYPERLINK("url","text")
          const formulaMatch = s.match(/=HYPERLINK\("([^"]+)"/)
          if (formulaMatch) { job[col] = formulaMatch[1]; continue }
          // CSV export: <a href="url">text</a>
          const hrefMatch = s.match(/href="([^"]+)"/)
          if (hrefMatch) { job[col] = hrefMatch[1]; continue }
          // Plain URL
          if (s.startsWith('http')) { job[col] = s; continue }
          job[col] = null; continue
        } else if (col === 'customer_phone_number') {
          job[col] = normalizePhone(raw)
        } else if (['total_invoice_amount', 'total_payment_amount', 'deductible',
                    'estimated_revenue', 'total_actual_expenses', 'accrual_revenue'].includes(col)) {
          const n = parseFloat(String(raw).replace(/[$,]/g, ''))
          if (!isNaN(n)) job[col] = n
        } else if (['file_closed', 'estimate_sent', 'contract_signed', 'coc_cos_signed',
                    'invoiced', 'paid'].includes(col)) {
          const v = String(raw).toLowerCase().trim()
          job[col] = v === 'true' || v === 'yes' || v === '1'
        } else {
          job[col] = String(raw).trim()
        }
      }

      return job
    })
}
