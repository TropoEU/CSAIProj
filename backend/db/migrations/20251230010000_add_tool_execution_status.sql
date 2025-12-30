-- UP
-- Add status column to tool_executions for better error tracking
-- Status values: 'success', 'failed', 'blocked', 'duplicate'
ALTER TABLE tool_executions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success';

-- Add error_reason column to store why a tool was blocked/failed
ALTER TABLE tool_executions ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Update existing records: set status based on success column
UPDATE tool_executions SET status = CASE WHEN success = true THEN 'success' ELSE 'failed' END WHERE status IS NULL OR status = 'success';

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);

-- DOWN
-- DROP INDEX IF EXISTS idx_tool_executions_status;
-- ALTER TABLE tool_executions DROP COLUMN IF EXISTS error_reason;
-- ALTER TABLE tool_executions DROP COLUMN IF EXISTS status;
