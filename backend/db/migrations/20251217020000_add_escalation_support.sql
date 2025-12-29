-- Migration: Add escalation support (human handoff)
-- UP

-- Add escalation_config to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS escalation_config JSONB DEFAULT '{
  "enabled": true,
  "notification_email": null,
  "notification_phone": null,
  "notification_method": "email",
  "auto_detect_stuck": true,
  "confidence_threshold": 0.6,
  "show_button": true,
  "button_text_en": "Talk to a human",
  "button_text_he": "דבר עם נציג אנושי"
}'::jsonb;

-- Create escalations table
CREATE TABLE IF NOT EXISTS escalations (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL, -- 'user_requested', 'ai_stuck', 'low_confidence', 'explicit_trigger'
  trigger_message_id INTEGER REFERENCES messages(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, acknowledged, resolved, cancelled
  assigned_to VARCHAR(255), -- Email/phone of human agent
  notes TEXT,
  escalated_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_escalation_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_escalation_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Create indexes for escalations
CREATE INDEX IF NOT EXISTS idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalations_client ON escalations(client_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_created ON escalations(escalated_at);

-- Add index on escalation_config for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_clients_escalation_config ON clients USING GIN (escalation_config);

COMMENT ON TABLE escalations IS 'Tracks when conversations are escalated to human agents';
COMMENT ON COLUMN escalations.reason IS 'Why the conversation was escalated: user_requested, ai_stuck, low_confidence, explicit_trigger';
COMMENT ON COLUMN escalations.status IS 'Current status: pending (waiting for human), acknowledged (human notified), resolved (handled), cancelled (no longer needed)';
COMMENT ON COLUMN clients.escalation_config IS 'Configuration for escalation behavior and notifications';

-- DOWN
-- DROP INDEX IF EXISTS idx_clients_escalation_config;
-- DROP INDEX IF EXISTS idx_escalations_created;
-- DROP INDEX IF EXISTS idx_escalations_status;
-- DROP INDEX IF EXISTS idx_escalations_client;
-- DROP INDEX IF EXISTS idx_escalations_conversation;
-- DROP TABLE IF EXISTS escalations;
-- ALTER TABLE clients DROP COLUMN IF EXISTS escalation_config;
