-- Migration: Add business_info to clients table for storing business context and instructions
-- UP

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS business_info JSONB DEFAULT '{
  "about_business": "",
  "custom_instructions": "",
  "business_hours": "",
  "contact_phone": "",
  "contact_email": "",
  "contact_address": "",
  "return_policy": "",
  "shipping_policy": "",
  "payment_methods": "",
  "faq": []
}'::jsonb;

-- Create index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_clients_business_info ON clients USING GIN (business_info);

COMMENT ON COLUMN clients.business_info IS 'Business-specific information used to enhance AI responses (description, hours, policies, FAQs)';

-- DOWN
-- DROP INDEX IF EXISTS idx_clients_business_info;
-- ALTER TABLE clients DROP COLUMN IF EXISTS business_info;
