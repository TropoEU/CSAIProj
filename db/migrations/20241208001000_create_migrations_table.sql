-- Migration 000: Create migrations tracking table
-- This runs first to track which migrations have been applied
-- UP

CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

-- DOWN
-- DROP TABLE migrations;
