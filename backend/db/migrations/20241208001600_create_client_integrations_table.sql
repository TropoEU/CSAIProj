-- Migration 006: Create client_integrations table
-- UP

CREATE TABLE IF NOT EXISTS client_integrations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    connection_config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_sync_test TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for finding integrations by client
CREATE INDEX idx_client_integrations_client ON client_integrations(client_id);

-- Index for finding enabled integrations
CREATE INDEX idx_client_integrations_enabled ON client_integrations(client_id, enabled) WHERE enabled = true;

-- Index for finding integrations by type (for filtering in admin UI)
CREATE INDEX idx_client_integrations_type ON client_integrations(integration_type);

-- DOWN
-- DROP INDEX idx_client_integrations_type;
-- DROP INDEX idx_client_integrations_enabled;
-- DROP INDEX idx_client_integrations_client;
-- DROP TABLE client_integrations;
