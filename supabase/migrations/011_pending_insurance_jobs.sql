alter table albi_jobs
  add column if not exists pending_insurance_approval boolean not null default false,
  add column if not exists pending_invoice_date date,
  add column if not exists balance_override_amount numeric;

create index if not exists idx_albi_jobs_pending_insurance
  on albi_jobs (company_id, pending_insurance_approval, pending_invoice_date);
