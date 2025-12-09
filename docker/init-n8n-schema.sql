-- Create n8n schema on first database initialization
-- This script runs automatically when Postgres container is first created
-- It ensures the n8n schema exists before n8n starts

CREATE SCHEMA IF NOT EXISTS n8n;

-- Grant all privileges to the postgres superuser (which owns the database)
-- The POSTGRES_USER will inherit these permissions
GRANT ALL PRIVILEGES ON SCHEMA n8n TO postgres;

-- Also grant to PUBLIC to ensure any database user can access it
-- (This is safe since n8n will manage its own tables within the schema)
GRANT USAGE ON SCHEMA n8n TO PUBLIC;

