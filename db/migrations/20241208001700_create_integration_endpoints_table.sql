-- Migration 007: Create integration_endpoints table
-- UP

CREATE TABLE IF NOT EXISTS integration_endpoints (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES client_integrations(id) ON DELETE CASCADE,
    endpoint_name VARCHAR(100) NOT NULL,
    endpoint_url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(integration_id, endpoint_name)
);

-- Index for finding endpoints by integration
CREATE INDEX idx_integration_endpoints_integration ON integration_endpoints(integration_id);

-- Index for finding endpoint by name (for data fetching)
CREATE INDEX idx_integration_endpoints_name ON integration_endpoints(integration_id, endpoint_name);

-- DOWN
-- DROP INDEX idx_integration_endpoints_name;
-- DROP INDEX idx_integration_endpoints_integration;
-- DROP TABLE integration_endpoints;
