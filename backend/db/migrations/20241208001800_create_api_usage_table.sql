-- Migration 008: Create api_usage table (for billing)
-- UP

CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    conversation_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    tool_calls_count INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10, 4) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, date)
);

-- Index for finding usage by client
CREATE INDEX idx_api_usage_client ON api_usage(client_id);

-- Index for finding usage by date range (for billing periods)
CREATE INDEX idx_api_usage_date ON api_usage(date);

-- Index for finding usage by client and date range (most common query)
CREATE INDEX idx_api_usage_client_date ON api_usage(client_id, date DESC);

-- DOWN
-- DROP INDEX idx_api_usage_client_date;
-- DROP INDEX idx_api_usage_date;
-- DROP INDEX idx_api_usage_client;
-- DROP TABLE api_usage;
