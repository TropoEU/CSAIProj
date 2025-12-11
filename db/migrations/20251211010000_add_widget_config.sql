-- UP
ALTER TABLE clients
ADD COLUMN widget_config JSONB DEFAULT '{
  "position": "bottom-right",
  "primaryColor": "#667eea",
  "greeting": "Hi! How can I help you today?",
  "title": "Chat Support",
  "subtitle": "We typically reply instantly"
}'::jsonb;

COMMENT ON COLUMN clients.widget_config IS 'Widget customization settings (position, colors, greeting, title, subtitle)';

-- DOWN
-- ALTER TABLE clients DROP COLUMN widget_config;
