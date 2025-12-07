-- Migration 005: Create client_tools table (junction table)
-- UP

CREATE TABLE IF NOT EXISTS client_tools (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    n8n_webhook_url TEXT,
    custom_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, tool_id)
);

-- Index for finding tools by client (most common query)
CREATE INDEX idx_client_tools_client ON client_tools(client_id);

-- Index for finding enabled tools only
CREATE INDEX idx_client_tools_enabled ON client_tools(client_id, enabled) WHERE enabled = true;

-- Index for finding which clients use a specific tool
CREATE INDEX idx_client_tools_tool ON client_tools(tool_id);

-- DOWN
-- DROP INDEX idx_client_tools_tool;
-- DROP INDEX idx_client_tools_enabled;
-- DROP INDEX idx_client_tools_client;
-- DROP TABLE client_tools;
