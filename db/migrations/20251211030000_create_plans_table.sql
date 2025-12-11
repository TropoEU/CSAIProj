-- UP
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Limits (null = unlimited)
    conversations_per_month INTEGER,
    messages_per_month INTEGER,
    tokens_per_month BIGINT,
    tool_calls_per_month INTEGER,
    integrations_enabled INTEGER,
    cost_limit_usd DECIMAL(10, 2),
    
    -- Features (stored as JSONB for flexibility)
    features JSONB DEFAULT '{
        "llmProvider": "ollama",
        "customBranding": false,
        "prioritySupport": false,
        "advancedAnalytics": false,
        "apiAccess": true,
        "whiteLabel": false
    }'::jsonb,
    
    -- Pricing
    base_cost DECIMAL(10, 2) DEFAULT 0,
    usage_multiplier DECIMAL(10, 8) DEFAULT 0,
    
    -- Metadata
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for lookups
CREATE INDEX idx_plans_name ON plans(name);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- Insert default plans
INSERT INTO plans (name, display_name, description, conversations_per_month, messages_per_month, tokens_per_month, tool_calls_per_month, integrations_enabled, cost_limit_usd, features, base_cost, usage_multiplier, is_default, sort_order) VALUES
(
    'unlimited',
    'Unlimited',
    'No restrictions - default for all clients',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '{"llmProvider": "claude-3-5-sonnet", "customBranding": true, "prioritySupport": true, "advancedAnalytics": true, "apiAccess": true, "whiteLabel": true}'::jsonb,
    0, 0,
    true,
    0
),
(
    'free',
    'Free',
    'Limited free tier for testing and small-scale use',
    50, 500, 50000, 25, 1, 5.00,
    '{"llmProvider": "ollama", "customBranding": false, "prioritySupport": false, "advancedAnalytics": false, "apiAccess": false, "whiteLabel": false}'::jsonb,
    0, 0,
    false,
    1
),
(
    'starter',
    'Starter',
    'For small businesses getting started',
    1000, 10000, 1000000, 500, 3, 100.00,
    '{"llmProvider": "claude-3-haiku", "customBranding": false, "prioritySupport": false, "advancedAnalytics": true, "apiAccess": true, "whiteLabel": false}'::jsonb,
    29.99, 0.00001,
    false,
    2
),
(
    'pro',
    'Pro',
    'For growing businesses with higher volume',
    10000, 100000, 10000000, 5000, 10, 500.00,
    '{"llmProvider": "claude-3-5-sonnet", "customBranding": true, "prioritySupport": true, "advancedAnalytics": true, "apiAccess": true, "whiteLabel": true}'::jsonb,
    99.99, 0.000008,
    false,
    3
),
(
    'enterprise',
    'Enterprise',
    'For large organizations with high volume needs',
    100000, 1000000, 100000000, 50000, NULL, 5000.00,
    '{"llmProvider": "claude-3-5-sonnet", "customBranding": true, "prioritySupport": true, "advancedAnalytics": true, "apiAccess": true, "whiteLabel": true, "dedicatedSupport": true, "sla": true}'::jsonb,
    499.99, 0.000005,
    false,
    4
);

-- DOWN
-- DROP INDEX IF EXISTS idx_plans_is_active;
-- DROP INDEX IF EXISTS idx_plans_name;
-- DROP TABLE IF EXISTS plans;

