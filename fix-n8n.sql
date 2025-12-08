-- Fix n8n table conflicts
-- This script removes n8n tables from the public schema
-- Run this before restarting n8n with the new schema configuration

-- Drop any n8n-created tables/sequences in the public schema
DROP TABLE IF EXISTS public.execution_entity CASCADE;
DROP TABLE IF EXISTS public.execution_data CASCADE;
DROP TABLE IF EXISTS public.credentials_entity CASCADE;
DROP TABLE IF EXISTS public.webhook_entity CASCADE;
DROP TABLE IF EXISTS public.workflow_entity CASCADE;
DROP TABLE IF EXISTS public.tag_entity CASCADE;
DROP TABLE IF EXISTS public.workflows_tags CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.installed_packages CASCADE;
DROP TABLE IF EXISTS public.installed_nodes CASCADE;
DROP SEQUENCE IF EXISTS public.execution_entity_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.credentials_entity_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.webhook_entity_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.workflow_entity_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.tag_entity_id_seq CASCADE;

-- Create n8n schema (if it doesn't exist)
CREATE SCHEMA IF NOT EXISTS n8n;

-- Grant permissions to the postgres user
GRANT ALL PRIVILEGES ON SCHEMA n8n TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA n8n TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA n8n TO postgres;
