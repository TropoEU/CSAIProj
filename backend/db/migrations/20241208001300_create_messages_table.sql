-- Migration 003: Create messages table
-- UP

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for finding messages by conversation (most common query)
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- Index for finding old messages (for cleanup script - 30 day retention)
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- Index for finding messages by conversation ordered by time (for context loading)
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, timestamp DESC);

-- DOWN
-- DROP INDEX idx_messages_conversation_time;
-- DROP INDEX idx_messages_timestamp;
-- DROP INDEX idx_messages_conversation;
-- DROP TABLE messages;
