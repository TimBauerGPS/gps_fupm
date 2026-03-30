-- Grant company admins write access to letter_templates and company_settings.
-- Previously only service_role could write these tables, causing client-side
-- saves to silently fail due to RLS.

CREATE POLICY "admins can manage templates"
  ON letter_templates FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admins can update company_settings"
  ON company_settings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
