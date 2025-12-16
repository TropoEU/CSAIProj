# Tools & Integrations Architecture

## Overview

This document explains how the Tools and Integrations system works, and how they connect together.

## Key Concepts

### 1. Integration Type (Category)

**What it is:** A category or "role" that describes what kind of API an integration provides.

**Think of it as:** A "plug type" - like USB-C, HDMI, or power outlet standards.

**Examples:**

- `order_api` - Any API that can look up order information
- `inventory_api` - Any API that can check stock levels
- `email_api` - Any email sending service
- `booking_api` - Any appointment/reservation system

**Important:** Integration Type is NOT unique per client. Multiple clients can have integrations with the same type, but pointing to different actual APIs.

| Client      | Integration Type | Actual API           |
| ----------- | ---------------- | -------------------- |
| Bob's Pizza | `order_api`      | Shopify Orders API   |
| Joe's Diner | `order_api`      | WooCommerce REST API |
| Acme Corp   | `order_api`      | Custom ERP System    |

### 2. Client Integrations

**What it is:** A client's specific connection to their API.

**Contains:**

- `integration_type`: The category (e.g., "order_api")
- `name`: Friendly name (e.g., "Bob's Shopify Store")
- `connection_config`: Actual API credentials (URL, API key, auth method)
- `status`: Whether the connection is active/tested

**Example:**

```json
{
  "id": 39,
  "client_id": 19,
  "integration_type": "order_api",
  "name": "Bob's Pizza Order System",
  "connection_config": {
    "apiUrl": "https://api.bobs-pizza.com/orders",
    "apiKey": "sk_live_xxx",
    "authMethod": "bearer"
  },
  "status": "active"
}
```

### 3. Generic Tools

**What it is:** A reusable tool template that defines WHAT a tool does, not HOW it connects.

**Contains:**

- `tool_name`: Unique identifier (e.g., "get_order_status")
- `description`: What the tool does
- `parameters_schema`: What parameters it accepts
- `required_integrations`: What TYPES of integrations it needs

**Key Insight:** Generic tools specify integration TYPES, not specific client integrations.

**Example:**

```json
{
  "tool_name": "get_order_status",
  "description": "Check the status of a customer order",
  "parameters_schema": {
    "type": "object",
    "required": ["orderNumber"],
    "properties": {
      "orderNumber": { "type": "string" }
    }
  },
  "required_integrations": [
    {
      "key": "order_api",
      "name": "Order API",
      "required": true,
      "description": "API to fetch order information"
    }
  ]
}
```

### 4. Client Tools (The Bridge)

**What it is:** The connection between a generic tool and a client's specific integrations.

**Contains:**

- `client_id`: Which client
- `tool_id`: Which generic tool
- `n8n_webhook_url`: The n8n workflow to call
- `integration_mapping`: Maps required integration TYPES to specific client integration IDs

**This is where the magic happens:** The mapping tells the system "when this client uses this tool, use THESE specific integrations."

**Example:**

```json
{
  "client_id": 19,
  "tool_id": 1,
  "n8n_webhook_url": "http://localhost:5678/webhook/get_order_status",
  "integration_mapping": {
    "order_api": 39
  }
}
```

This says: "When Bob's Pizza (client 19) uses get_order_status (tool 1), use their integration #39 (Bob's Shopify) for the order_api requirement."

## The Complete Flow

### Setup Phase (One-time)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN SETUP                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Create Generic Tool                                          │
│     ┌──────────────────────────────────────┐                    │
│     │ Tool: get_order_status               │                    │
│     │ Required Integrations: ["order_api"] │                    │
│     └──────────────────────────────────────┘                    │
│                                                                  │
│  2. Client Creates Their Integration                             │
│     ┌──────────────────────────────────────┐                    │
│     │ Type: order_api                      │                    │
│     │ Name: "Bob's Shopify"                │                    │
│     │ API URL: https://api.shopify.com/... │                    │
│     │ API Key: sk_xxx                      │                    │
│     └──────────────────────────────────────┘                    │
│                                                                  │
│  3. Client Enables Tool + Maps Integrations                      │
│     ┌──────────────────────────────────────┐                    │
│     │ Tool: get_order_status               │                    │
│     │ Webhook: http://localhost:5678/...   │                    │
│     │ Mapping: order_api → Bob's Shopify   │                    │
│     └──────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime Phase (Every Tool Execution)

```
┌─────────────────────────────────────────────────────────────────┐
│                     RUNTIME EXECUTION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User asks: "What's the status of order #12345?"             │
│                          │                                       │
│                          ▼                                       │
│  2. AI decides to call "get_order_status" tool                  │
│                          │                                       │
│                          ▼                                       │
│  3. Backend looks up Client Tool configuration                  │
│     - Finds: integration_mapping = { "order_api": 39 }          │
│                          │                                       │
│                          ▼                                       │
│  4. Backend fetches Integration #39 (Bob's Shopify)             │
│     - Gets: { apiUrl, apiKey, authMethod }                      │
│                          │                                       │
│                          ▼                                       │
│  5. Backend calls n8n webhook with:                             │
│     {                                                           │
│       "orderNumber": "12345",                                   │
│       "_integrations": {                                        │
│         "order_api": {                                          │
│           "apiUrl": "https://api.shopify.com/...",              │
│           "apiKey": "sk_xxx",                                   │
│           "authMethod": "bearer"                                │
│         }                                                       │
│       }                                                         │
│     }                                                           │
│                          │                                       │
│                          ▼                                       │
│  6. n8n workflow uses _integrations.order_api to call API       │
│                          │                                       │
│                          ▼                                       │
│  7. Result returns to user: "Order #12345 is out for delivery"  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### Problem: One Tool per Client?

Without this system, you'd need to create a separate tool for each client:

- `get_order_status_bobs_pizza`
- `get_order_status_joes_diner`
- `get_order_status_acme_corp`

This doesn't scale!

### Solution: Generic Tools + Client Mapping

With this system:

- ONE generic tool: `get_order_status`
- Each client maps it to THEIR integration
- Same n8n workflow works for everyone

## FAQ

### Q: Can I add my own Integration Types?

**Yes!** Integration Type is just a text field. When you create an integration, type whatever category makes sense for your use case.

**Best Practice:** Use consistent naming (e.g., `order_api`, `inventory_api`) so your generic tools can find matching integrations.

### Q: What if my tool needs multiple integrations?

**Supported!** A tool can require multiple integration types:

```json
{
  "tool_name": "send_order_confirmation",
  "required_integrations": [
    { "key": "order_api", "name": "Order API", "required": true },
    { "key": "email_api", "name": "Email Service", "required": true }
  ]
}
```

When enabling, the client maps BOTH:

```json
{
  "integration_mapping": {
    "order_api": 39,
    "email_api": 42
  }
}
```

### Q: What if a client doesn't have a required integration?

The tool won't work until they:

1. Create an integration with the required type
2. Map it in the Client Tool configuration

### Q: Can two clients share the same n8n webhook?

**Yes!** The webhook is generic. It receives `_integrations` object and uses whatever credentials are passed. The same webhook serves all clients.

## UI Workflow Summary

### 1. Integrations Page

- Create integrations with any `integration_type` you need
- Test the connection
- View captured API schema

### 2. Tools Page (Generic)

- Create generic tools
- Define what `integration_types` they require
- These are templates, not client-specific

### 3. Client Detail Page → Tools Tab

- **Enable Tool**: Pick a generic tool, set webhook, MAP integrations
- **Edit Tool**: Update webhook URL and integration mappings
- The dropdown shows YOUR integrations, you pick which one fills each requirement
