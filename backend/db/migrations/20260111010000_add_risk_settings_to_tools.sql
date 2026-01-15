-- UP
-- Add risk/policy settings to tools table (previously hardcoded in toolPolicies.js)

ALTER TABLE tools ADD COLUMN IF NOT EXISTS is_destructive BOOLEAN DEFAULT false;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT false;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS max_confidence INTEGER DEFAULT 7;

COMMENT ON COLUMN tools.is_destructive IS 'Whether this tool performs destructive actions (cancel, delete, refund). Triggers critique step.';
COMMENT ON COLUMN tools.requires_confirmation IS 'Whether this tool always requires explicit user confirmation before execution.';
COMMENT ON COLUMN tools.max_confidence IS 'Maximum confidence level (1-10) the AI can claim for this tool. Server caps model confidence at this level.';

-- Set sensible defaults based on common tool patterns
UPDATE tools SET is_destructive = true, requires_confirmation = true, max_confidence = 5
WHERE tool_name IN ('cancel_order', 'refund', 'delete_account', 'delete_booking');

UPDATE tools SET is_destructive = false, requires_confirmation = false, max_confidence = 9
WHERE tool_name IN ('get_order_status', 'check_inventory', 'search_products', 'get_account_info');

UPDATE tools SET is_destructive = false, requires_confirmation = false, max_confidence = 7
WHERE tool_name IN ('book_appointment', 'update_profile', 'place_order');

-- DOWN
-- ALTER TABLE tools DROP COLUMN IF EXISTS is_destructive;
-- ALTER TABLE tools DROP COLUMN IF EXISTS requires_confirmation;
-- ALTER TABLE tools DROP COLUMN IF EXISTS max_confidence;
