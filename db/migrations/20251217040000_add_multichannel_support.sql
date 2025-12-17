-- UP
-- Add multi-channel support to conversations and messages tables

-- Add channel columns to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'widget',
  ADD COLUMN IF NOT EXISTS channel_thread_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS channel_metadata JSONB DEFAULT '{}'::jsonb;

-- Values for channel: 'widget', 'email', 'whatsapp'
-- channel_thread_id: Gmail thread ID, WhatsApp conversation ID, etc.
-- channel_metadata: Channel-specific data (sender email, phone number, etc.)

-- Add index for channel queries
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_channel_thread ON conversations(channel_thread_id);

-- Add external message tracking to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS channel_metadata JSONB DEFAULT '{}'::jsonb;

-- external_message_id: Gmail message ID, WhatsApp message ID, etc.
-- channel_metadata: Attachments, reactions, read receipts, etc.

CREATE INDEX IF NOT EXISTS idx_messages_external ON messages(external_message_id);

-- DOWN
-- DROP INDEX IF EXISTS idx_messages_external;
-- ALTER TABLE messages DROP COLUMN IF EXISTS channel_metadata;
-- ALTER TABLE messages DROP COLUMN IF EXISTS external_message_id;
-- DROP INDEX IF EXISTS idx_conversations_channel_thread;
-- DROP INDEX IF EXISTS idx_conversations_channel;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS channel_metadata;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS channel_thread_id;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS channel;
