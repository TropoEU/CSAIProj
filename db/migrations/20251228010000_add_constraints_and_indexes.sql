-- UP
-- Add CHECK constraints for enum-like columns to prevent invalid data

-- Clients table: status constraint
DO $$ BEGIN
    ALTER TABLE clients ADD CONSTRAINT chk_clients_status
        CHECK (status IN ('active', 'inactive', 'suspended'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Invoices table: status constraint
DO $$ BEGIN
    ALTER TABLE invoices ADD CONSTRAINT chk_invoices_status
        CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Escalations table: status constraint
DO $$ BEGIN
    ALTER TABLE escalations ADD CONSTRAINT chk_escalations_status
        CHECK (status IN ('pending', 'acknowledged', 'resolved', 'cancelled'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Escalations table: reason constraint
DO $$ BEGIN
    ALTER TABLE escalations ADD CONSTRAINT chk_escalations_reason
        CHECK (reason IN ('user_requested', 'ai_stuck', 'low_confidence', 'explicit_trigger'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Client integrations table: status constraint
DO $$ BEGIN
    ALTER TABLE client_integrations ADD CONSTRAINT chk_client_integrations_status
        CHECK (status IN ('not_configured', 'active', 'inactive', 'error'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Email channels table: status constraint
DO $$ BEGIN
    ALTER TABLE email_channels ADD CONSTRAINT chk_email_channels_status
        CHECK (status IN ('active', 'inactive', 'error', 'authenticating'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Conversations table: channel constraint
DO $$ BEGIN
    ALTER TABLE conversations ADD CONSTRAINT chk_conversations_channel
        CHECK (channel IN ('widget', 'email', 'whatsapp', 'sms'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add missing index on escalations for client_id and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_escalations_client_status ON escalations(client_id, status);

-- Add index on escalations for status alone (for admin queries)
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);


-- DOWN
-- ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_status;
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoices_status;
-- ALTER TABLE escalations DROP CONSTRAINT IF EXISTS chk_escalations_status;
-- ALTER TABLE escalations DROP CONSTRAINT IF EXISTS chk_escalations_reason;
-- ALTER TABLE client_integrations DROP CONSTRAINT IF EXISTS chk_client_integrations_status;
-- ALTER TABLE email_channels DROP CONSTRAINT IF EXISTS chk_email_channels_status;
-- ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conversations_channel;
-- DROP INDEX IF EXISTS idx_escalations_client_status;
-- DROP INDEX IF EXISTS idx_escalations_status;
