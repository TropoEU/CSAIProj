-- Migration 004: Create tools table (master catalog)
-- UP

CREATE TABLE IF NOT EXISTS tools (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    parameters_schema JSONB,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for finding tools by name (for tool loading)
CREATE INDEX idx_tools_name ON tools(tool_name);

-- Index for finding tools by category (for organizing in admin UI)
CREATE INDEX idx_tools_category ON tools(category);

-- DOWN
-- DROP INDEX idx_tools_category;
-- DROP INDEX idx_tools_name;
-- DROP TABLE tools;
