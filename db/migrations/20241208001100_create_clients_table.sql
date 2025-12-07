-- Migration 001: Create clients table
-- UP

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    plan_type VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on api_key for fast authentication lookups
CREATE INDEX idx_clients_api_key ON clients(api_key);

-- Create index on status for filtering active clients
CREATE INDEX idx_clients_status ON clients(status);

-- DOWN
-- DROP INDEX idx_clients_status;
-- DROP INDEX idx_clients_api_key;
-- DROP TABLE clients;
