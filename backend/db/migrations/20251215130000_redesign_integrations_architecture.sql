-- Migration: Redesign integrations architecture for many-to-many relationships
-- UP

-- 1. Add required_integrations JSONB array to tools (replaces single integration_type)
ALTER TABLE tools ADD COLUMN required_integrations JSONB DEFAULT '[]'::jsonb;

-- Migrate existing integration_type data to new format
UPDATE tools
SET required_integrations = jsonb_build_array(
    jsonb_build_object(
        'key', integration_type,
        'name', integration_type,
        'required', true
    )
)
WHERE integration_type IS NOT NULL;

-- Create index for querying tools by required integration keys
CREATE INDEX idx_tools_required_integrations ON tools USING gin(required_integrations);

-- 2. Add integration_mapping to client_tools (maps tool integration keys to client integration IDs)
ALTER TABLE client_tools ADD COLUMN integration_mapping JSONB DEFAULT '{}'::jsonb;

-- Add index for querying by integration mapping
CREATE INDEX idx_client_tools_integration_mapping ON client_tools USING gin(integration_mapping);

-- 3. Enhance client_integrations with schema and testing fields
ALTER TABLE client_integrations ADD COLUMN api_schema JSONB;
ALTER TABLE client_integrations ADD COLUMN test_config JSONB;
ALTER TABLE client_integrations ADD COLUMN last_test_result JSONB;
ALTER TABLE client_integrations ADD COLUMN name VARCHAR(255);
ALTER TABLE client_integrations ADD COLUMN description TEXT;
ALTER TABLE client_integrations ADD COLUMN status VARCHAR(50) DEFAULT 'not_configured';

-- Add index for integration status
CREATE INDEX idx_client_integrations_status ON client_integrations(client_id, status);

-- Update existing integrations to have default names
UPDATE client_integrations
SET name = integration_type || ' Integration',
    status = CASE
        WHEN enabled = true AND connection_config IS NOT NULL THEN 'active'
        WHEN enabled = false THEN 'inactive'
        ELSE 'not_configured'
    END
WHERE name IS NULL;

-- 4. Add comments for documentation
COMMENT ON COLUMN tools.required_integrations IS 'Array of integration requirements: [{"key": "order_api", "name": "Order API", "required": true, "description": "Used to fetch order data"}]';
COMMENT ON COLUMN client_tools.integration_mapping IS 'Maps integration keys to client_integration IDs: {"order_api": 5, "email_api": 8}';
COMMENT ON COLUMN client_integrations.api_schema IS 'API structure: {"endpoints": {"/orders/{id}": {"method": "GET", "parameters": [...], "response_fields": [...]}}}';
COMMENT ON COLUMN client_integrations.test_config IS 'Test configuration: {"test_endpoint": "/health", "test_method": "GET", "expected_status": 200, "sample_request": {...}}';
COMMENT ON COLUMN client_integrations.last_test_result IS 'Last test result: {"success": true, "timestamp": "...", "response_time": 150, "captured_schema": {...}, "error": null}';
COMMENT ON COLUMN client_integrations.status IS 'Integration status: not_configured, active, inactive, error';

-- DOWN
-- DROP INDEX idx_client_integrations_status;
-- ALTER TABLE client_integrations DROP COLUMN status;
-- ALTER TABLE client_integrations DROP COLUMN description;
-- ALTER TABLE client_integrations DROP COLUMN name;
-- ALTER TABLE client_integrations DROP COLUMN last_test_result;
-- ALTER TABLE client_integrations DROP COLUMN test_config;
-- ALTER TABLE client_integrations DROP COLUMN api_schema;
-- DROP INDEX idx_client_tools_integration_mapping;
-- ALTER TABLE client_tools DROP COLUMN integration_mapping;
-- DROP INDEX idx_tools_required_integrations;
-- ALTER TABLE tools DROP COLUMN required_integrations;
