-- Migration 009: Create tool_executions table (audit log)
-- UP

CREATE TABLE IF NOT EXISTS tool_executions (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    parameters JSONB,
    n8n_response JSONB,
    success BOOLEAN DEFAULT false,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for finding executions by conversation
CREATE INDEX idx_tool_executions_conversation ON tool_executions(conversation_id);

-- Index for finding executions by timestamp (for cleanup - 90 day retention)
CREATE INDEX idx_tool_executions_timestamp ON tool_executions(timestamp);

-- Index for finding failed executions (for debugging)
CREATE INDEX idx_tool_executions_failed ON tool_executions(success) WHERE success = false;

-- Index for finding executions by tool name (for analytics)
CREATE INDEX idx_tool_executions_tool_name ON tool_executions(tool_name);

-- DOWN
-- DROP INDEX idx_tool_executions_tool_name;
-- DROP INDEX idx_tool_executions_failed;
-- DROP INDEX idx_tool_executions_timestamp;
-- DROP INDEX idx_tool_executions_conversation;
-- DROP TABLE tool_executions;
