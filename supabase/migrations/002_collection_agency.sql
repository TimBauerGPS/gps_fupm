-- Add collection agency fields to company_settings
alter table company_settings
  add column if not exists collection_agency text,
  add column if not exists collection_agency_phone text,
  add column if not exists resend_from_domain text;
