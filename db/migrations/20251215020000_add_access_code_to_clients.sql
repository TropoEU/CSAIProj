-- UP
-- Add access_code field to clients table for customer dashboard login
ALTER TABLE clients ADD COLUMN access_code VARCHAR(32) UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_clients_access_code ON clients(access_code);

-- Add comment to explain the field
COMMENT ON COLUMN clients.access_code IS 'Unique access code for customer dashboard login (6-digit code)';

-- Generate access codes for existing clients (6-digit random codes)
-- Format: ABC123 (3 uppercase letters + 3 digits)
UPDATE clients
SET access_code = CONCAT(
  CHR(65 + floor(random() * 26)::int),
  CHR(65 + floor(random() * 26)::int),
  CHR(65 + floor(random() * 26)::int),
  floor(random() * 10)::int,
  floor(random() * 10)::int,
  floor(random() * 10)::int
)
WHERE access_code IS NULL;

-- DOWN
-- ALTER TABLE clients DROP COLUMN access_code;
-- DROP INDEX idx_clients_access_code;
