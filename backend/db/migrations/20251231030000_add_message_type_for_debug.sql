-- UP
-- Add message_type column to distinguish visible messages from internal debug messages
-- This enables full conversation debugging by storing the entire LLM interaction

ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'visible';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_call_id VARCHAR(100);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_type ON messages(conversation_id, message_type);

-- Message types:
-- 'visible' - Messages shown to end users (user questions, final AI responses)
-- 'system' - System prompts sent to the LLM
-- 'tool_call' - AI's request to execute a tool (includes tool name and arguments)
-- 'tool_result' - Result returned from tool execution
-- 'internal' - Internal AI reasoning or intermediate responses

COMMENT ON COLUMN messages.message_type IS 'Type of message: visible, system, tool_call, tool_result, internal';
COMMENT ON COLUMN messages.tool_call_id IS 'Tool call ID for matching tool_call with tool_result';
COMMENT ON COLUMN messages.metadata IS 'Additional metadata (tool calls array, model info, etc.)';

-- DOWN
-- DROP INDEX IF EXISTS idx_messages_conversation_type;
-- DROP INDEX IF EXISTS idx_messages_type;
-- ALTER TABLE messages DROP COLUMN IF EXISTS metadata;
-- ALTER TABLE messages DROP COLUMN IF EXISTS tool_call_id;
-- ALTER TABLE messages DROP COLUMN IF EXISTS message_type;
