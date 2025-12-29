-- UP
-- Email channels table for storing email integration configurations per client
CREATE TABLE email_channels (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel_type VARCHAR(50) NOT NULL DEFAULT 'gmail', -- 'gmail', 'outlook', etc.
  email_address VARCHAR(255) NOT NULL,
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- OAuth tokens, refresh tokens
  status VARCHAR(50) DEFAULT 'authenticating', -- active, inactive, error, authenticating
  last_checked_at TIMESTAMP,
  last_error TEXT,
  settings JSONB DEFAULT '{
    "signature": "",
    "auto_reply": true,
    "monitoring_enabled": true,
    "filter_labels": [],
    "exclude_labels": ["SPAM", "TRASH"]
  }'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_client_email UNIQUE(client_id, email_address)
);

CREATE INDEX idx_email_channels_client ON email_channels(client_id);
CREATE INDEX idx_email_channels_status ON email_channels(status);
CREATE INDEX idx_email_channels_last_checked ON email_channels(last_checked_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER email_channels_updated_at_trigger
  BEFORE UPDATE ON email_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_email_channels_updated_at();

-- DOWN
-- DROP TRIGGER IF EXISTS email_channels_updated_at_trigger ON email_channels;
-- DROP FUNCTION IF EXISTS update_email_channels_updated_at();
-- DROP INDEX IF EXISTS idx_email_channels_last_checked;
-- DROP INDEX IF EXISTS idx_email_channels_status;
-- DROP INDEX IF EXISTS idx_email_channels_client;
-- DROP TABLE IF EXISTS email_channels;
