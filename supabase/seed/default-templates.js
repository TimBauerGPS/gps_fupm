/**
 * Seeds the default letter templates for a company.
 * Deletes all existing templates for the company first, then inserts fresh.
 *
 * Usage:
 *   import { seedDefaultTemplates } from './supabase/seed/default-templates.js'
 *   await seedDefaultTemplates(supabase, companyId)
 */

// Shared letter header/footer helpers
const letterHeader = () => `{{Logo}}
<p style="text-align:right">{{dateSent}}</p>

<p>{{CustomerName}}<br>
{{MAddress}}<br>
{{MCity}}, {{MState}} {{MZip}}</p>`

const legalNoticeHeader = () => `{{Logo}}
<table style="width:100%;margin-bottom:24px;font-size:13px">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:16px">
      <strong>NOTIFYING PARTY:</strong><br>
      {{CompanyName}}<br>
      {{CompanyAddress}}
    </td>
    <td style="width:50%;vertical-align:top">
      <strong>Property where Services Provided:</strong><br>
      Reference Number: {{JobNumber}}<br>
      {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}<br>
      {{PCounty}}
    </td>
  </tr>
</table>`

const signature = () => `<p>Best Regards,</p>
<p>{{Rep}}<br>
Accounts Receivable<br>
{{CompanyName}}<br>
{{CompanyAddress}}<br>
{{RepPhone}}<br>
{{RepEmail}}<br>
{{LicenseLine}}</p>`

export const DEFAULT_TEMPLATES = [
  // ─── A ──────────────────────────────────────────────────────────────────────
  {
    name: 'A - Initial Invoice / Pending Claim Approval',
    description: 'First notice after job completion, while insurance claim is in review.',
    is_active: true,
    sort_order: 0,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p>Dear {{CustomerName}},</p>

<p>Here is the initial invoice for the services performed at your property. We have submitted the invoice and supporting documentation for these services to your insurance provider.</p>

<p>The amount of the invoice may change based on the insurance review and as we work with them to have payment issued.</p>

<p>We ask that you send all correspondence and estimates received from your insurance to {{RepEmail}} for review.</p>

<p>In addition, we may need your help in this process if the insurance company becomes unresponsive or delayed in their review. We will keep you informed regarding their release of payment and if additional assistance is needed from you.</p>

<p>Please let us know if you have any questions!</p>

${signature()}`,
  },

  // ─── B (Review) ─────────────────────────────────────────────────────────────
  {
    name: 'B - Invoice Post Insurance Review',
    description: 'Invoice after insurance has settled in full. Requires settlement and payment amounts.',
    is_active: true,
    sort_order: 1,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p>Dear {{CustomerName}},</p>

<p>Attached is the invoice for the mitigation and dry out services completed at your property.</p>

<p>According to your insurance, a settlement of <strong>{{ask_Insurance_Approved}}</strong> has been approved. This amount is now due from you.</p>

<ul>
  <li>Total Invoice: {{Balance}}</li>
  <li>Insurance Approved: {{ask_Insurance_Approved}}</li>
  <li>Previous Deposit Paid: {{ask_Deposit_Paid}}</li>
  <li>Initial Payment Due: {{ask_Amount_Due}}</li>
</ul>

<p>To make your payment, please visit {{PaymentLink}} and follow these steps:</p>
<ol>
  <li>Enter the payment amount: <strong>{{ask_Amount_Due}}</strong></li>
  <li>Enter your card information. Keep in mind that all credit card transactions will charge you a 3.5% fee but there is no fee for debit card transactions.</li>
  <li>Then click "Pay" and follow the prompts to complete your transaction.</li>
</ol>

<p>Thank you for your attention and prompt payment. We understand that the claims process can be confusing, so please let us know if you have any questions. We are here to help!</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}`,
  },

  // ─── B (Partial) ────────────────────────────────────────────────────────────
  {
    name: 'B - Invoice Post Insurance Partial Approval',
    description: 'Invoice after insurance partial settlement. Requires partial and remaining amounts.',
    is_active: true,
    sort_order: 2,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p>Dear {{CustomerName}},</p>

<p>Attached is the invoice for the mitigation and dry out services completed at your property.</p>

<p>According to your insurance, a partial settlement of <strong>{{ask_Partial_Amount}}</strong> has been approved and your insurance company has confirmed they have released or are releasing payment to you. This amount is now due from you.</p>

<ul>
  <li>Total Invoice: {{Balance}}</li>
  <li>Partial Settled Amount: {{ask_Partial_Amount}}</li>
  <li>Remaining Unsettled Amount: {{ask_Remaining_Amount}}</li>
  <li>Current Payment Due: {{ask_Amount_Due}}</li>
</ul>

<p>To make your payment, please visit {{PaymentLink}} and follow these steps:</p>
<ol>
  <li>Enter the payment amount: <strong>{{ask_Amount_Due}}</strong></li>
  <li>Enter your card information. Keep in mind that all credit card transactions will charge you a 3.5% fee but there is no fee for debit card transactions.</li>
  <li>Then click "Pay" and follow the prompts to complete your transaction.</li>
</ol>

<p>We are still working with your insurance company regarding the remaining balance. As more funds are issued, we will keep you updated. If you receive any correspondence from your insurance company regarding your claim, please let us know.</p>

<p>Thank you for your attention and prompt payment. We understand that the claims process can be confusing, so please let us know if you have any questions. We are here to help!</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}`,
  },

  // ─── C ──────────────────────────────────────────────────────────────────────
  {
    name: 'C - Help Needed with Insurance',
    description: 'Asks customer to contact their adjuster. Requires insurance company, phone, and due date.',
    is_active: true,
    sort_order: 3,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p>Dear {{CustomerName}},</p>

<p>We have reached out repeatedly to your carrier, {{InsuranceCompany}}, to have payment issued to cover the cost of your invoice and they have been unresponsive.</p>

<p>We are quickly approaching the maximum timeframe to collect payment for our services. We are asking for your assistance by reaching out to your adjuster with {{InsuranceCompany}} at {{ask_Insurance_Phone}} to expedite this payment process and avoid escalation. If this invoice is not paid in full by <strong>{{ask_Due_Date}}</strong>, it will escalate which may include a lien or collections.</p>

<p>Please relay any information received from {{InsuranceCompany}} to our office at {{RepPhone}} or {{RepEmail}}.</p>

<p>We appreciate your help in this process and will keep you updated as we receive information and updates, as well.</p>

<p>We understand that the claims process can be frustrating, so please let us know if you have any questions. We are here to help!</p>

${signature()}`,
  },

  // ─── D ──────────────────────────────────────────────────────────────────────
  {
    name: 'D - Request for Payment',
    description: 'Formal payment request with a specific due date.',
    is_active: true,
    sort_order: 4,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>Request for Payment</strong></p>

<p>Dear {{CustomerName}},</p>

<p>Thank you again for choosing {{CompanyName}} to assist you with your project. We know that you have a lot of choices in terms of companies to help you through this process and every time a customer chooses us, we are grateful!</p>

<p>Our records show that the following payment became due on <strong>{{ask_Due_Date}}</strong> but remains outstanding. Oftentimes, if there is an insurance or mortgage company involved in the process, you may not have received the funds yet. If this is the case, please let us know right away so we can help get the ball rolling on that.</p>

<p>If the funds have been released and you have any questions or concerns, please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}}.</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>Thank you for promptly addressing this issue. If payment has already been made, please disregard this notice.</p>

<p>You can use this QR Code to pay immediately or submit a check to the address listed below:</p>

${signature()}`,
  },

  // ─── E ──────────────────────────────────────────────────────────────────────
  {
    name: 'E - Invoice Reminder',
    description: 'Friendly reminder that invoice is due or past due, with payment options.',
    is_active: true,
    sort_order: 5,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>Invoice Reminder</strong></p>

<p>Dear {{CustomerName}},</p>

<p>Thank you again for trusting {{CompanyName}} with your restoration needs. Our records indicate that the invoice for project {{JobNumber}} is either due soon or past due for the project at the address listed above and, as of the mailing of this letter, we have not received payment. Is everything ok? Would you mind letting us know the status?</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>Here are your payment options:</p>

<ul>
  <li>Mail a check made out to {{CompanyName}} to {{CompanyAddress}}.</li>
  <li>Pay via credit or debit card via the QR code below. Keep in mind that all credit card transactions will charge you a 3.5% fee but there is no fee for debit transactions.</li>
</ul>

<p>Disagree or have concerns? Please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}}.</p>

<p>If you are waiting on a payment from your insurance or mortgage company in regards to a claim attached to this project, please also let us know so we can help facilitate payment being released.</p>

${signature()}`,
  },

  // ─── F ──────────────────────────────────────────────────────────────────────
  {
    name: 'F - Demand for Payment',
    description: 'Escalated demand after no response to prior notices.',
    is_active: true,
    sort_order: 6,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>Demand for Payment</strong></p>

<p>Dear {{CustomerName}},</p>

<p>Our records indicate that <strong>{{Balance}}</strong> remains unpaid and we have not heard back since sending other notices for the payment being past due.</p>

<p>We know that life gets busy. We also understand that you may be waiting on an insurance or mortgage company to release payment. Please contact us immediately if so to update us. We may also be able to assist!</p>

<p>Unfortunately, we are required to file certain notices to protect our ability to collect the fees for the work performed and if we don't hear back soon, we will be forced to escalate our collection processes. Can you please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}} with the status of your payment.</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

<p>Disagree or have concerns? Please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}}.</p>

${signature()}`,
  },

  // ─── G (RBL) ────────────────────────────────────────────────────────────────
  {
    name: 'G - Final Demand for Payment (Mechanics Lien)',
    description: 'Final demand — mechanics lien / bond claim route.',
    is_active: true,
    sort_order: 7,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>FINAL Demand for Payment</strong></p>

<p>Dear {{CustomerName}},</p>

<p>We have sent several notices regarding this outstanding balance and have still not received payment. Unfortunately, this will be our final demand for payment. Immediately following this final demand, {{CompanyName}} will begin pursuing payment recovery options, including but not limited to, mechanics lien rights, bond claim rights, retainage claims, prompt payment claims, or other legal remedies available to us.</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>If payment is not received within the next ten (10) days, this invoice will enter our mechanic's lien process.</p>

<p>If payment is made immediately, {{CompanyName}} will cease its recovery efforts. Otherwise, we will proceed with whatever legal options may be available to enforce this claim for payment.</p>

<p>Contact us immediately at {{RepPhone}}. We look forward to resolving this dispute.</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}`,
  },

  // ─── G (CTS) ────────────────────────────────────────────────────────────────
  {
    name: 'G - Final Demand for Payment (Possessory Lien)',
    description: 'Final demand — possessory lien / personal property route.',
    is_active: true,
    sort_order: 8,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>FINAL Demand for Payment</strong></p>

<p>Dear {{CustomerName}},</p>

<p>We have sent several notices regarding this outstanding balance and have still not received payment. Unfortunately, this will be our final demand for payment. Immediately following this final demand, {{CompanyName}} will begin pursuing payment recovery options, including but not limited to, possessory lien rights to sell property for any unpaid amounts.</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>If payment is not received within the next ten (10) days, this invoice will enter our possessory lien process.</p>

<p>If payment is made immediately, {{CompanyName}} will cease its recovery efforts. Otherwise, we will proceed with whatever legal options may be available to enforce this claim for payment.</p>

<p>Contact us immediately at {{RepPhone}}. We look forward to resolving this dispute.</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}`,
  },

  // ─── G (Other) ──────────────────────────────────────────────────────────────
  {
    name: 'G - Final Demand for Payment (Advanced Collections)',
    description: 'Final demand — advanced collections / general legal remedies route.',
    is_active: true,
    sort_order: 9,
    body: `${letterHeader()}

<p>Re: Job #{{JobNumber}} — {{PAddress}}, {{PCity}}, {{PState}} {{PZIP}}</p>

<p><strong>FINAL Demand for Payment</strong></p>

<p>Dear {{CustomerName}},</p>

<p>We have sent several notices regarding this outstanding balance and have still not received payment. Unfortunately, this will be our final demand for payment. Immediately following this final demand, {{CompanyName}} will begin pursuing payment recovery options, including but not limited to retainage claims, prompt payment claims, or other legal remedies available to us.</p>

<p><strong>Amount Outstanding: {{Balance}}</strong></p>

<p>If payment is not received within the next ten (10) days, this invoice will enter our advanced collections process.</p>

<p>If payment is made immediately, {{CompanyName}} will cease its recovery efforts. Otherwise, we will proceed with whatever legal options may be available to enforce this claim for payment.</p>

<p>Contact us immediately at {{RepPhone}}. We look forward to resolving this dispute.</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}`,
  },

  // ─── H (RBL) ────────────────────────────────────────────────────────────────
  {
    name: 'H - Notice of Intent to Lien (Mechanics Lien)',
    description: 'Formal NOI for mechanics lien on real property. Requires services description.',
    is_active: true,
    sort_order: 10,
    body: `${legalNoticeHeader()}

<p style="text-align:center"><strong>NOTICE OF INTENT TO FILE A LIEN</strong><br>
{{dateSent}}</p>

<p><strong>NOTICE DELIVERED TO:</strong><br>
{{CustomerName}}<br>
{{MAddress}}<br>
{{MCity}}, {{MState}} {{MZip}}</p>

<p>Services: {{ask_Services}}</p>

<p>Dear {{CustomerName}},</p>

<p>If the party that has given you this notice is not paid in full for labor, service, equipment, or material provided, or to be provided, to your construction project, a lien may lead to loss of all or part of your property, and/or other significant legal consequences.</p>

<p><strong>Total Amount Owed to Notifying Party ("the Debt"): {{Balance}}</strong></p>

<p>This notice is provided to inform you that the Notifying Party has provided the above-described Services to the Property, and that payment for these Services (the "Debt"), is due and owing to the Notifying Party. This is a notice to you that the Notifying Party is owed the Debt, and that payment has not been made to the Notifying Party on the Debt.</p>

<p>If payment is not made to the Notifying Party in ten (10) days, a Claim of Lien, commonly referred to as a Mechanic's Lien, or Claim against the Project Bond or Contract Funds, as the case may be, will be filed against the Property in ten (10) days after delivery of this Notice as per California Statutes.</p>

<p>Disagree or have concerns? Please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}}.</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}

<hr style="margin:32px 0">

<p style="text-align:center"><strong>AVOID HAVING A LIEN PLACED AGAINST YOUR PROJECT</strong></p>

<p>To avoid having a Claim filed against you and/or your project, payment of the total Debt must be made within ten (10) days from the mailing of this Notice of Intent To File A Lien.</p>

<p>Payment of the Debt shall be made to the contact listed below:</p>

<p>{{CompanyName}}<br>
{{CompanyAddress}}<br>
{{RepPhone}}</p>

<p style="text-align:center"><strong>DO NOT IGNORE THIS NOTICE</strong></p>`,
  },

  // ─── H (CTS) ────────────────────────────────────────────────────────────────
  {
    name: 'H - Notice of Intent to Lien (Possessory Lien)',
    description: 'Formal NOI for possessory lien on personal property. Requires services description.',
    is_active: true,
    sort_order: 11,
    body: `${legalNoticeHeader()}

<p style="text-align:center"><strong>NOTICE OF INTENT TO FILE A LIEN</strong><br>
{{dateSent}}</p>

<p><strong>NOTICE DELIVERED TO:</strong><br>
{{CustomerName}}<br>
{{MAddress}}<br>
{{MCity}}, {{MState}} {{MZip}}</p>

<p>Services: {{ask_Services}}</p>

<p>Dear {{CustomerName}},</p>

<p>If the party that has given you this notice is not paid in full for labor, service, equipment, or material provided, or to be provided, to your Personal Property project, a lien may lead to loss of all or part of your personal property, and/or other significant legal consequences.</p>

<p><strong>Total Amount Owed to Notifying Party ("the Debt"): {{Balance}}</strong></p>

<p>This notice is provided to inform you that the Notifying Party has provided the above-described Services to the Property, and that payment for these Services (the "Debt"), is due and owing to the Notifying Party. This is a notice to you that the Notifying Party is owed the Debt, and that payment has not been made to the Notifying Party on the Debt.</p>

<p>If payment is not made to the Notifying Party in ten (10) days, we will begin the possessory lien process which may result in the selling of your personal property in our possession for the purposes of satisfying this amount owed.</p>

<p>Disagree or have concerns? Please call {{Rep}} today at {{RepPhone}} or email us at {{RepEmail}}.</p>

<p>You can also pay online here: {{PaymentLink}}</p>
{{PaymentQRCode}}

${signature()}

<hr style="margin:32px 0">

<p style="text-align:center"><strong>AVOID HAVING A LIEN PLACED AGAINST YOUR PROJECT</strong></p>

<p>To avoid having a Claim filed against you and/or your project, payment of the total Debt must be made within ten (10) days from the mailing of this Notice of Intent To File A Lien.</p>

<p>Payment of the Debt shall be made to the contact listed below:</p>

<p>{{CompanyName}}<br>
{{CompanyAddress}}<br>
{{RepPhone}}</p>

<p style="text-align:center"><strong>DO NOT IGNORE THIS NOTICE</strong></p>`,
  },

  // ─── I ──────────────────────────────────────────────────────────────────────
  {
    name: 'I - Notice of Collections',
    description: 'Notifies customer account has been sent to collections. Requires services description.',
    is_active: true,
    sort_order: 12,
    body: `${legalNoticeHeader()}

<p style="text-align:center"><strong>NOTICE OF COLLECTIONS</strong><br>
{{dateSent}}</p>

<p><strong>NOTICE DELIVERED TO:</strong><br>
{{CustomerName}}<br>
{{MAddress}}<br>
{{MCity}}, {{MState}} {{MZip}}</p>

<p>Services: {{ask_Services}}</p>

<p>Dear {{CustomerName}},</p>

<p>This letter is to inform you that your account with {{CompanyName}} has been placed with a collections agency due to non-payment.</p>

<p>Despite previous attempts to resolve the outstanding balance, your account remains unpaid in the amount of <strong>{{Balance}}</strong>. As a result, your account has been transferred to a third-party collections agency as of {{dateSent}}.</p>

<p>Moving forward, all communication regarding this debt, as well as payment arrangements, must be directed to the collections agency listed below:</p>

<p><strong>{{CollectionAgency}}</strong><br>
{{CollectionAgencyPhone}}</p>

<p>Please be advised that this action may impact your credit and could result in additional fees or further collection efforts if the balance remains unresolved.</p>

<p>If you believe this action has been taken in error or if you have any questions, please contact us immediately at {{RepPhone}}.</p>

<p>We encourage you to resolve this matter as soon as possible.</p>

${signature()}`,
  },
]

export async function seedDefaultTemplates(supabase, companyId) {
  // Delete all existing templates for this company first
  const { error: deleteError } = await supabase
    .from('letter_templates')
    .delete()
    .eq('company_id', companyId)
  if (deleteError) throw deleteError

  const rows = DEFAULT_TEMPLATES.map(t => ({ ...t, company_id: companyId }))
  const { error: insertError } = await supabase.from('letter_templates').insert(rows)
  if (insertError) throw insertError
  return rows.length
}
