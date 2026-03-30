-- Add payment_link to company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS payment_link text;
