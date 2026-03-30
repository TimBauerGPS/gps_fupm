-- Add requires_attachment flag to letter_templates
ALTER TABLE letter_templates
  ADD COLUMN IF NOT EXISTS requires_attachment boolean NOT NULL DEFAULT false;
