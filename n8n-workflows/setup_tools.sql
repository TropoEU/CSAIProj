-- Phase 3: Demo Tool Setup
-- This script adds demo tools to the database and enables them for Bob's Pizza Shop

-- First, create Bob's Pizza Shop client if it doesn't exist
INSERT INTO clients (name, domain, api_key, status)
VALUES (
  'Bob''s Pizza Shop',
  'bobspizza.com',
  'bobs_pizza_api_key_123',
  'active'
)
ON CONFLICT (api_key) DO NOTHING;

-- Insert demo tools into master catalog
INSERT INTO tools (tool_name, description, parameters_schema, category) VALUES
(
  'get_order_status',
  'Check the status of a customer order by order number',
  '{
    "type": "object",
    "properties": {
      "orderNumber": {
        "type": "string",
        "description": "The order number to look up (e.g., 12345)"
      }
    },
    "required": ["orderNumber"]
  }'::jsonb,
  'orders'
),
(
  'book_appointment',
  'Book an appointment for a customer',
  '{
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "The date for the appointment (YYYY-MM-DD format)"
      },
      "time": {
        "type": "string",
        "description": "The time for the appointment (HH:MM format)"
      },
      "serviceType": {
        "type": "string",
        "description": "Type of service (e.g., consultation, haircut, massage)"
      },
      "customerName": {
        "type": "string",
        "description": "Customer full name"
      },
      "customerEmail": {
        "type": "string",
        "description": "Customer email address"
      },
      "customerPhone": {
        "type": "string",
        "description": "Customer phone number"
      }
    },
    "required": ["date", "time", "serviceType", "customerName"]
  }'::jsonb,
  'appointments'
),
(
  'check_inventory',
  'Check if a product is in stock and get availability information',
  '{
    "type": "object",
    "properties": {
      "productName": {
        "type": "string",
        "description": "Name of the product to check"
      },
      "productSku": {
        "type": "string",
        "description": "Product SKU code (alternative to product name)"
      },
      "quantity": {
        "type": "number",
        "description": "Quantity needed (optional, defaults to 1)"
      }
    }
  }'::jsonb,
  'inventory'
)
ON CONFLICT (tool_name) DO UPDATE
  SET description = EXCLUDED.description,
      parameters_schema = EXCLUDED.parameters_schema,
      category = EXCLUDED.category;

-- Enable tools for Bob's Pizza Shop
-- Using production webhook URLs (n8n automatically adds /webhook/ prefix)

INSERT INTO client_tools (client_id, tool_id, enabled, n8n_webhook_url)
SELECT
  c.id,
  t.id,
  true,
  CASE
    WHEN t.tool_name = 'get_order_status' THEN 'http://localhost:5678/webhook/get_order_status'
    WHEN t.tool_name = 'book_appointment' THEN 'http://localhost:5678/webhook/book_appointment'
    WHEN t.tool_name = 'check_inventory' THEN 'http://localhost:5678/webhook/check_inventory'
  END
FROM tools t
CROSS JOIN clients c
WHERE t.tool_name IN ('get_order_status', 'book_appointment', 'check_inventory')
  AND c.api_key = 'bobs_pizza_api_key_123'
ON CONFLICT (client_id, tool_id) DO UPDATE
  SET enabled = true,
      n8n_webhook_url = EXCLUDED.n8n_webhook_url,
      updated_at = NOW();

-- Verify setup
SELECT
  ct.id,
  c.name as client_name,
  t.tool_name,
  t.description,
  ct.enabled,
  ct.n8n_webhook_url
FROM client_tools ct
JOIN clients c ON ct.client_id = c.id
JOIN tools t ON ct.tool_id = t.id
WHERE c.api_key = 'bobs_pizza_api_key_123'
ORDER BY t.tool_name;

-- Display API key for testing
\echo ''
\echo '========================================='
\echo 'Setup Complete!'
\echo '========================================='
\echo ''
SELECT
  'API Key for Testing:' as info,
  api_key,
  name as client_name,
  status
FROM clients
WHERE api_key = 'bobs_pizza_api_key_123';
