-- Migration: Add capabilities column to tools table
-- UP

ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT NULL;

COMMENT ON COLUMN tools.capabilities IS 'Array of capability descriptions (bullet points) for customer dashboard display';

-- DOWN
-- ALTER TABLE tools DROP COLUMN IF EXISTS capabilities;

