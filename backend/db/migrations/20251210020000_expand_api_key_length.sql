-- Migration: Expand api_key column to accommodate csai_ prefix
-- UP

ALTER TABLE clients
ALTER COLUMN api_key TYPE VARCHAR(128);

-- DOWN
-- ALTER TABLE clients
-- ALTER COLUMN api_key TYPE VARCHAR(64);
