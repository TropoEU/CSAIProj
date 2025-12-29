-- Migration: Add email, llm_provider, model_name, and system_prompt to clients table
-- UP

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(50) DEFAULT 'ollama',
ADD COLUMN IF NOT EXISTS model_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- DOWN
-- DROP INDEX idx_clients_email;
-- ALTER TABLE clients
-- DROP COLUMN IF EXISTS system_prompt,
-- DROP COLUMN IF EXISTS model_name,
-- DROP COLUMN IF EXISTS llm_provider,
-- DROP COLUMN IF EXISTS email;
