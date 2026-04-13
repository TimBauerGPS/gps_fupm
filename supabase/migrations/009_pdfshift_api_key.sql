alter table company_settings
  add column if not exists pdfshift_api_key text;
