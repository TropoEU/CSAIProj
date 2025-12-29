-- Migration 002: Create conversations table
-- UP

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_id VARCHAR(128) NOT NULL,
    user_identifier VARCHAR(255),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    tokens_total INTEGER DEFAULT 0,
    UNIQUE(client_id, session_id)
);

-- Index for finding conversations by client
CREATE INDEX idx_conversations_client ON conversations(client_id);

-- Index for finding conversations by session (reconnecting users)
CREATE INDEX idx_conversations_session ON conversations(session_id);

-- Index for finding active conversations (ended_at IS NULL)
CREATE INDEX idx_conversations_active ON conversations(ended_at) WHERE ended_at IS NULL;

-- DOWN
-- DROP INDEX idx_conversations_active;
-- DROP INDEX idx_conversations_session;
-- DROP INDEX idx_conversations_client;
-- DROP TABLE conversations;
