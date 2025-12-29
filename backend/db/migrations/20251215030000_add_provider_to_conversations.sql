-- Migration: Add llm_provider and model_name to conversations table
-- UP

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS model_name VARCHAR(255);

-- Create index for provider lookups
CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(llm_provider);

-- DOWN
-- DROP INDEX IF EXISTS idx_conversations_provider;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS llm_provider;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS model_name;

