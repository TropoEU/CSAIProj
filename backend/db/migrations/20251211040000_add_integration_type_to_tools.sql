-- UP
-- Add integration_type column to tools table
-- This specifies what type of client integration the tool needs to function
-- Examples: 'inventory_api', 'order_api', 'crm_api', 'calendar_api'
-- If NULL, the tool doesn't require an integration (n8n handles everything internally)

ALTER TABLE tools 
ADD COLUMN integration_type VARCHAR(50) DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN tools.integration_type IS 'Type of client integration this tool requires (e.g., inventory_api, order_api). NULL means no integration needed.';

-- Create index for efficient lookups
CREATE INDEX idx_tools_integration_type ON tools(integration_type) WHERE integration_type IS NOT NULL;

-- DOWN
-- DROP INDEX IF EXISTS idx_tools_integration_type;
-- ALTER TABLE tools DROP COLUMN IF EXISTS integration_type;

