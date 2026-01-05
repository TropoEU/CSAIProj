-- UP

-- Add columns to track adaptive reasoning metrics
ALTER TABLE api_usage ADD COLUMN adaptive_count INTEGER DEFAULT 0;
ALTER TABLE api_usage ADD COLUMN critique_count INTEGER DEFAULT 0;
ALTER TABLE api_usage ADD COLUMN context_fetch_count INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN api_usage.adaptive_count IS 'Number of messages processed in adaptive mode';
COMMENT ON COLUMN api_usage.critique_count IS 'Number of times critique was triggered';
COMMENT ON COLUMN api_usage.context_fetch_count IS 'Number of context fetches performed';

-- DOWN
-- ALTER TABLE api_usage DROP COLUMN IF EXISTS context_fetch_count;
-- ALTER TABLE api_usage DROP COLUMN IF EXISTS critique_count;
-- ALTER TABLE api_usage DROP COLUMN IF EXISTS adaptive_count;
