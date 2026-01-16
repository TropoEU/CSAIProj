-- UP
-- Demo Upgrade: Bob's Pizza Overhaul
-- 1. Update widget_config with red/gold pizza theme
-- 2. Add new demo tools for realistic pizza shop interactions

-- Update Bob's Pizza widget_config with pizza-themed colors
UPDATE clients
SET widget_config = '{
  "position": "bottom-right",
  "primaryColor": "#D32F2F",
  "backgroundColor": "#ffffff",
  "headerBgColor": "#D32F2F",
  "bodyBgColor": "#ffffff",
  "footerBgColor": "#ffffff",
  "aiBubbleColor": "#FFF8E1",
  "userBubbleColor": "#D32F2F",
  "headerTextColor": "#ffffff",
  "aiTextColor": "#2D2D2D",
  "userTextColor": "#ffffff",
  "inputBgColor": "#FFF8E1",
  "inputTextColor": "#2D2D2D",
  "buttonTextColor": "#ffffff",
  "greeting": "Welcome to Bob''s Pizza! I can help you check our menu, look up an order, make a reservation, or answer questions about our restaurant. How can I help you today?",
  "title": "Bob''s Pizza Support",
  "subtitle": "We typically reply instantly"
}'::jsonb,
business_info = '{
  "about": {
    "name": "Bob''s Pizza",
    "description": "Authentic Italian pizza since 1985. Made fresh daily with love and the finest imported ingredients.",
    "founded": "1985",
    "owner": "The Martinez Family"
  },
  "contact": {
    "phone": "(555) 123-4567",
    "email": "hello@bobspizza.com",
    "address": "123 Main Street, Downtown, CA 90210"
  },
  "policies": {
    "delivery": "Free delivery on orders over $25. Delivery fee: $2.99. Delivery radius: 5 miles. Average time: 30-45 minutes.",
    "refunds": "We stand behind our pizza! If you''re not satisfied, contact us within 30 minutes of delivery for a full refund or remake.",
    "cancellation": "Orders can be cancelled within 5 minutes of placement. After that, the order is already in preparation."
  },
  "faqs": [
    {"q": "Do you have gluten-free options?", "a": "Yes! We offer gluten-free crust for any pizza for an additional $3."},
    {"q": "Can I customize my pizza?", "a": "Absolutely! You can add or remove any toppings. Extra toppings are $1.50 each."},
    {"q": "Do you offer catering?", "a": "Yes! We cater events of all sizes. Contact us at least 48 hours in advance for catering orders."}
  ],
  "hours": {
    "monday": "11am - 10pm",
    "tuesday": "11am - 10pm",
    "wednesday": "11am - 10pm",
    "thursday": "11am - 10pm",
    "friday": "11am - 11pm",
    "saturday": "11am - 11pm",
    "sunday": "12pm - 9pm"
  }
}'::jsonb
WHERE api_key = 'bobs_pizza_api_key_123';

-- Add new demo tools
INSERT INTO tools (tool_name, description, parameters_schema, category, required_integrations) VALUES
(
  'get_menu',
  'Get the restaurant menu with items and prices. Optionally filter by category (pizzas, sides, drinks, specials).',
  '{
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "description": "Optional category filter: pizzas, sides, drinks, specials, or all",
        "enum": ["pizzas", "sides", "drinks", "specials", "all"]
      }
    }
  }',
  'information',
  '[{"key": "menu_api", "name": "Menu API", "required": true, "description": "Provides menu data"}]'::jsonb
),
(
  'get_specials',
  'Get current daily deals, promotions, and special offers.',
  '{
    "type": "object",
    "properties": {}
  }',
  'information',
  '[{"key": "specials_api", "name": "Specials API", "required": true, "description": "Provides daily specials and promotions"}]'::jsonb
),
(
  'check_delivery_area',
  'Check if a given address is within the delivery zone and get delivery details.',
  '{
    "type": "object",
    "properties": {
      "address": {
        "type": "string",
        "description": "The delivery address to check"
      }
    },
    "required": ["address"]
  }',
  'information',
  '[{"key": "delivery_api", "name": "Delivery API", "required": true, "description": "Checks delivery zones and fees"}]'::jsonb
),
(
  'place_order',
  'Place a new order for delivery or pickup. Requires items and customer phone number.',
  '{
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "description": "List of items to order with quantities",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "quantity": {"type": "integer", "minimum": 1}
          },
          "required": ["name", "quantity"]
        }
      },
      "customerPhone": {
        "type": "string",
        "description": "Customer phone number for order confirmation"
      },
      "deliveryAddress": {
        "type": "string",
        "description": "Delivery address (optional for pickup)"
      },
      "orderType": {
        "type": "string",
        "enum": ["delivery", "pickup"],
        "description": "Whether this is a delivery or pickup order"
      },
      "notes": {
        "type": "string",
        "description": "Special instructions or notes for the order"
      }
    },
    "required": ["items", "customerPhone"]
  }',
  'action',
  '[{"key": "order_api", "name": "Order API", "required": true, "description": "Creates and manages orders"}]'::jsonb
)
ON CONFLICT (tool_name) DO UPDATE SET
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema,
  required_integrations = EXCLUDED.required_integrations;

-- Create client integrations for Bob's Pizza demo tools
-- First, get Bob's Pizza client ID
DO $$
DECLARE
  bobs_client_id INTEGER;
  menu_integration_id INTEGER;
  specials_integration_id INTEGER;
  delivery_integration_id INTEGER;
  order_integration_id INTEGER;
  get_menu_tool_id INTEGER;
  get_specials_tool_id INTEGER;
  check_delivery_tool_id INTEGER;
  place_order_tool_id INTEGER;
BEGIN
  -- Get Bob's Pizza client ID
  SELECT id INTO bobs_client_id FROM clients WHERE api_key = 'bobs_pizza_api_key_123';

  IF bobs_client_id IS NULL THEN
    RAISE NOTICE 'Bob''s Pizza client not found, skipping integration setup';
    RETURN;
  END IF;

  -- Create integrations for new tools (if not exists)
  INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status)
  VALUES (bobs_client_id, 'menu_api', 'Bob''s Pizza Menu API',
    '{"apiUrl": "http://localhost:3000/mock-api/bobs-pizza/menu", "authMethod": "none"}'::jsonb, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO menu_integration_id;
  IF menu_integration_id IS NULL THEN
    SELECT id INTO menu_integration_id FROM client_integrations
    WHERE client_id = bobs_client_id AND integration_type = 'menu_api';
  END IF;

  INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status)
  VALUES (bobs_client_id, 'specials_api', 'Bob''s Pizza Specials API',
    '{"apiUrl": "http://localhost:3000/mock-api/bobs-pizza/specials", "authMethod": "none"}'::jsonb, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO specials_integration_id;
  IF specials_integration_id IS NULL THEN
    SELECT id INTO specials_integration_id FROM client_integrations
    WHERE client_id = bobs_client_id AND integration_type = 'specials_api';
  END IF;

  INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status)
  VALUES (bobs_client_id, 'delivery_api', 'Bob''s Pizza Delivery API',
    '{"apiUrl": "http://localhost:3000/mock-api/bobs-pizza/delivery-areas", "authMethod": "none"}'::jsonb, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO delivery_integration_id;
  IF delivery_integration_id IS NULL THEN
    SELECT id INTO delivery_integration_id FROM client_integrations
    WHERE client_id = bobs_client_id AND integration_type = 'delivery_api';
  END IF;

  INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status)
  VALUES (bobs_client_id, 'order_api', 'Bob''s Pizza Order API',
    '{"apiUrl": "http://localhost:3000/mock-api/bobs-pizza/orders", "authMethod": "none"}'::jsonb, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO order_integration_id;
  IF order_integration_id IS NULL THEN
    SELECT id INTO order_integration_id FROM client_integrations
    WHERE client_id = bobs_client_id AND integration_type = 'order_api';
  END IF;

  -- Get tool IDs
  SELECT id INTO get_menu_tool_id FROM tools WHERE tool_name = 'get_menu';
  SELECT id INTO get_specials_tool_id FROM tools WHERE tool_name = 'get_specials';
  SELECT id INTO check_delivery_tool_id FROM tools WHERE tool_name = 'check_delivery_area';
  SELECT id INTO place_order_tool_id FROM tools WHERE tool_name = 'place_order';

  -- Enable new tools for Bob's Pizza client
  INSERT INTO client_tools (client_id, tool_id, enabled, n8n_webhook_url, integration_mapping)
  VALUES
    (bobs_client_id, get_menu_tool_id, true, 'http://localhost:5678/webhook/get_menu',
      jsonb_build_object('menu_api', menu_integration_id)),
    (bobs_client_id, get_specials_tool_id, true, 'http://localhost:5678/webhook/get_specials',
      jsonb_build_object('specials_api', specials_integration_id)),
    (bobs_client_id, check_delivery_tool_id, true, 'http://localhost:5678/webhook/check_delivery_area',
      jsonb_build_object('delivery_api', delivery_integration_id)),
    (bobs_client_id, place_order_tool_id, true, 'http://localhost:5678/webhook/place_order',
      jsonb_build_object('order_api', order_integration_id))
  ON CONFLICT (client_id, tool_id) DO UPDATE SET
    enabled = true,
    n8n_webhook_url = EXCLUDED.n8n_webhook_url,
    integration_mapping = EXCLUDED.integration_mapping;

END $$;

-- DOWN
-- -- Delete new tools and integrations
-- DELETE FROM client_tools WHERE tool_id IN (
--   SELECT id FROM tools WHERE tool_name IN ('get_menu', 'get_specials', 'check_delivery_area', 'place_order')
-- );
-- DELETE FROM client_integrations WHERE integration_type IN ('menu_api', 'specials_api', 'delivery_api', 'order_api');
-- DELETE FROM tools WHERE tool_name IN ('get_menu', 'get_specials', 'check_delivery_area', 'place_order');
-- -- Note: widget_config rollback would need to store previous values
