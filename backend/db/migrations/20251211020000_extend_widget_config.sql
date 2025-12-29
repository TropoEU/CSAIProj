-- UP
-- Update default widget_config to include extended color options
ALTER TABLE clients
ALTER COLUMN widget_config SET DEFAULT '{
  "position": "bottom-right",
  "primaryColor": "#667eea",
  "backgroundColor": "#ffffff",
  "aiBubbleColor": "#f3f4f6",
  "userBubbleColor": "#667eea",
  "headerTextColor": "#111827",
  "aiTextColor": "#111827",
  "userTextColor": "#ffffff",
  "inputBgColor": "#f9fafb",
  "inputTextColor": "#111827",
  "buttonTextColor": "#ffffff",
  "greeting": "Hi! How can I help you today?",
  "title": "Chat Support",
  "subtitle": "We typically reply instantly"
}'::jsonb;

-- Update existing clients to have the extended config (merge with existing values)
UPDATE clients
SET widget_config = widget_config || '{
  "backgroundColor": "#ffffff",
  "aiBubbleColor": "#f3f4f6",
  "userBubbleColor": "#667eea",
  "headerTextColor": "#111827",
  "aiTextColor": "#111827",
  "userTextColor": "#ffffff",
  "inputBgColor": "#f9fafb",
  "inputTextColor": "#111827",
  "buttonTextColor": "#ffffff"
}'::jsonb
WHERE widget_config IS NOT NULL;

-- DOWN
-- Revert to simple config if needed
-- ALTER TABLE clients ALTER COLUMN widget_config SET DEFAULT '{"position": "bottom-right", "primaryColor": "#667eea", "greeting": "Hi! How can I help you today?", "title": "Chat Support", "subtitle": "We typically reply instantly"}'::jsonb;
