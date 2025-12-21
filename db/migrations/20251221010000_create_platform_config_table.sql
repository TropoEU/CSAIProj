-- UP
-- Platform configuration table for storing platform-wide settings
-- like the platform email account for transactional emails

CREATE TABLE IF NOT EXISTS platform_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(key);

-- DOWN
-- DROP INDEX IF EXISTS idx_platform_config_key;
-- DROP TABLE IF EXISTS platform_config;
