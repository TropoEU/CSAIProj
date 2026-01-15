-- UP

-- Add ai_mode column to plans table
ALTER TABLE plans ADD COLUMN ai_mode VARCHAR(20) DEFAULT 'standard';

-- Add comment for clarity
COMMENT ON COLUMN plans.ai_mode IS 'AI processing mode: standard (single call) or adaptive (self-assessment + conditional critique)';

-- Update pro and enterprise plans to use adaptive mode by default
UPDATE plans SET ai_mode = 'adaptive' WHERE name IN ('pro', 'enterprise');

-- Add reason_code column to tool_executions table for structured logging
ALTER TABLE tool_executions ADD COLUMN reason_code VARCHAR(50);

-- Add comment
COMMENT ON COLUMN tool_executions.reason_code IS 'Structured reason code for analytics (e.g., MISSING_PARAM, LOW_CONFIDENCE, EXECUTED_SUCCESSFULLY)';

-- Add reason_code column to messages table for tracking why certain actions were taken
ALTER TABLE messages ADD COLUMN reason_code VARCHAR(50);

-- Add comment
COMMENT ON COLUMN messages.reason_code IS 'Structured reason code for message decisions (e.g., ASK_USER, ESCALATE, CRITIQUE_TRIGGERED)';

-- Create indexes for analytics queries
CREATE INDEX idx_tool_executions_reason_code ON tool_executions(reason_code) WHERE reason_code IS NOT NULL;
CREATE INDEX idx_messages_reason_code ON messages(reason_code) WHERE reason_code IS NOT NULL;

-- Add check constraint to ensure ai_mode has valid values
ALTER TABLE plans ADD CONSTRAINT check_ai_mode CHECK (ai_mode IN ('standard', 'adaptive'));

-- DOWN
-- ALTER TABLE plans DROP CONSTRAINT IF EXISTS check_ai_mode;
-- DROP INDEX IF EXISTS idx_messages_reason_code;
-- DROP INDEX IF EXISTS idx_tool_executions_reason_code;
-- ALTER TABLE messages DROP COLUMN IF EXISTS reason_code;
-- ALTER TABLE tool_executions DROP COLUMN IF EXISTS reason_code;
-- ALTER TABLE plans DROP COLUMN IF EXISTS ai_mode;
