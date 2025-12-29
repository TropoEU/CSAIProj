-- UP
-- Add language preference column to clients table
-- This enables Hebrew/RTL support for widget and customer dashboard

ALTER TABLE clients
ADD COLUMN language VARCHAR(10) DEFAULT 'en';

COMMENT ON COLUMN clients.language IS 'Language preference for widget and customer dashboard (en, he)';

-- Create index for language filtering
CREATE INDEX idx_clients_language ON clients(language);

-- DOWN
-- DROP INDEX idx_clients_language;
-- ALTER TABLE clients DROP COLUMN language;
