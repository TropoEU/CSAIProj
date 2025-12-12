# Integration System Guide

This guide explains how the integration system works and how to set up reusable n8n workflows that connect to client-specific APIs.

## 🎯 Overview

The integration system allows you to create **one generic n8n workflow per tool type** that can be reused across all clients. Instead of creating duplicate workflows for each client, the system:

1. Stores client-specific API credentials in the **Integrations** tab
2. Automatically passes those credentials to n8n when a tool is executed
3. n8n uses the credentials dynamically to call each client's API

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOW IT WORKS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. AI calls tool "check_inventory" with { productId: "sony-tv" }           │
│                         │                                                    │
│                         ▼                                                    │
│  2. Backend looks up tool → sees integration_type = "inventory_api"         │
│                         │                                                    │
│                         ▼                                                    │
│  3. Backend fetches client's "inventory_api" integration credentials        │
│                         │                                                    │
│                         ▼                                                    │
│  4. Backend calls n8n with:                                                  │
│     {                                                                        │
│       productId: "sony-tv",                                                  │
│       _integration: {                                                        │
│         apiUrl: "https://api.bobshop.com",                                   │
│         apiKey: "abc123",                                                    │
│         authMethod: "bearer"                                                 │
│       }                                                                      │
│     }                                                                        │
│                         │                                                    │
│                         ▼                                                    │
│  5. n8n workflow uses {{ $json._integration.apiUrl }} dynamically           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Setup

### Step 1: Create the Tool (with Integration Type)

In Admin Panel → Tools → Add Tool:

| Field | Example Value |
|-------|---------------|
| Tool Name | `check_inventory` |
| Description | Check product availability in stock |
| **Integration Type** | `inventory_api` |
| Parameters Schema | See below |

**Parameters Schema Example:**
```json
{
  "type": "object",
  "properties": {
    "productId": {
      "type": "string",
      "description": "Product ID or SKU to check"
    }
  },
  "required": ["productId"]
}
```

---

### Step 2: Create a Generic n8n Workflow

Create **ONE** n8n workflow that handles all clients:

```
┌─────────────────┐     ┌────────────────────────────────────┐     ┌──────────────┐
│    Webhook      │────▶│         HTTP Request               │────▶│   Respond    │
│                 │     │                                    │     │              │
│  Trigger: POST  │     │  URL: {{ $json._integration.apiUrl│     │  Return:     │
│                 │     │        }}/api/inventory            │     │  {{ $json }} │
│  Receives:      │     │                                    │     │              │
│  - productId    │     │  Headers:                          │     │              │
│  - _integration │     │    Authorization: Bearer           │     │              │
│                 │     │    {{ $json._integration.apiKey }} │     │              │
└─────────────────┘     └────────────────────────────────────┘     └──────────────┘
```

**n8n HTTP Request Node Configuration:**

- **Method:** GET
- **URL:** `{{ $json._integration.apiUrl }}/api/inventory/{{ $json.productId }}`
- **Authentication:** Predefined Credential Type → None
- **Headers:**
  - `Authorization`: `Bearer {{ $json._integration.apiKey }}`
  - `Content-Type`: `application/json`

**n8n Expression Examples:**

| What you need | n8n Expression |
|---------------|----------------|
| API Base URL | `{{ $json._integration.apiUrl }}` |
| API Key | `{{ $json._integration.apiKey }}` |
| API Secret | `{{ $json._integration.apiSecret }}` |
| Auth Method | `{{ $json._integration.authMethod }}` |
| Custom Headers | `{{ $json._integration.headers }}` |
| Full Config | `{{ $json._integration.config }}` |

---

### Step 3: Enable Tool for Client + Set Webhook URL

In Admin Panel → Clients → [Client] → Tools tab:

1. Enable the `check_inventory` tool
2. Set the **Webhook URL** to your n8n webhook URL:
   ```
   http://localhost:5678/webhook/check_inventory
   ```

---

### Step 4: Configure Client Integration

In Admin Panel → Clients → [Client] → Integrations tab:

Click "Add Integration" and fill in:

| Field | Value |
|-------|-------|
| Integration Type | `inventory_api` |
| Name | Bob's Inventory API |
| API URL | `https://api.bobshop.com` |
| API Key | `sk-abc123xyz` |
| Auth Method | `bearer` (or `api_key`, `basic`) |

---

## 🔄 Reusability

### What's Reusable (Create Once)

| Component | Create Once | Use For All Clients |
|-----------|-------------|---------------------|
| Tool Definition | ✅ Yes | All clients share the same tool definition |
| n8n Workflow | ✅ Yes | One workflow handles all clients dynamically |
| Integration Type | ✅ Yes | Same type can be used by multiple tools |

### What's Per-Client

| Component | Per Client | Why |
|-----------|------------|-----|
| Integration Config | ✅ Yes | Each client has their own API credentials |
| Tool Webhook URL | ✅ Yes | May vary if different n8n instance per environment |

---

## 🔧 Supported Integration Types

These are the built-in integration types:

| Type | Name | Use Case |
|------|------|----------|
| `inventory_api` | Inventory API | Product stock and availability |
| `order_api` | Order API | Order status and management |
| `customer_api` | Customer API | Customer data and profiles |
| `booking_api` | Booking API | Appointments and reservations |
| `crm_api` | CRM API | Customer relationship management |
| `ecommerce_api` | E-commerce API | Shopify, WooCommerce, etc. |
| `calendar_api` | Calendar API | Google Calendar, Outlook |
| `email_api` | Email API | Email sending and tracking |
| `sms_api` | SMS API | SMS notifications |
| `payment_api` | Payment API | Payment processing |
| `shipping_api` | Shipping API | Shipping and delivery |
| `custom_api` | Custom API | Any custom REST API |

---

## 🔐 Auth Methods

When configuring a client integration, you can choose:

| Method | How it works |
|--------|--------------|
| `bearer` | Adds `Authorization: Bearer {apiKey}` header |
| `api_key` | Adds `X-API-Key: {apiKey}` header |
| `basic` | Adds `Authorization: Basic {base64(apiKey:apiSecret)}` header |
| `custom` | Use the headers you define in the config |

---

## 📊 Data Flow Example

**Scenario:** Bob's Electronics customer asks "Do you have Sony TVs in stock?"

```
User: "Do you have Sony TVs in stock?"
                │
                ▼
AI determines: Need to use check_inventory tool
                │
                ▼
AI calls: check_inventory({ productId: "sony-tv" })
                │
                ▼
Backend:
  1. Finds tool → integration_type = "inventory_api"
  2. Finds Bob's "inventory_api" integration
  3. Calls n8n with:
     {
       productId: "sony-tv",
       _integration: {
         apiUrl: "https://api.bobshop.com",
         apiKey: "sk-bob-abc123",
         authMethod: "bearer"
       }
     }
                │
                ▼
n8n Workflow:
  1. Receives webhook data
  2. Makes HTTP request to:
     GET https://api.bobshop.com/api/inventory/sony-tv
     Authorization: Bearer sk-bob-abc123
  3. Returns: { "inStock": true, "quantity": 15 }
                │
                ▼
AI receives: "Product sony-tv is in stock with 15 units"
                │
                ▼
AI responds: "Yes! We have 15 Sony TVs in stock."
```

---

## 🛠️ Advanced: Complex Integration Config

For complex integrations, you can store additional config:

**When creating integration via API:**
```json
{
  "integrationType": "inventory_api",
  "name": "Advanced Inventory",
  "apiKey": "main-api-key",
  "apiSecret": "secret-for-signing",
  "config": {
    "baseUrl": "https://api.example.com",
    "version": "v2",
    "timeout": 30000,
    "retryCount": 3,
    "customField": "anything you need"
  }
}
```

**Access in n8n:**
```
Base URL: {{ $json._integration.config.baseUrl }}
Version: {{ $json._integration.config.version }}
Full URL: {{ $json._integration.config.baseUrl }}/{{ $json._integration.config.version }}/inventory
```

---

## ⚡ Quick Reference

### Creating a New Tool with Integration

1. **Define tool** with `integration_type` set
2. **Create n8n workflow** that reads `_integration` object
3. **Enable tool** for each client (set webhook URL)
4. **Add integration** for each client (with their API credentials)

### Adding a New Client

1. **Enable tools** for the client
2. **Add integrations** for each integration type the tools need
3. Test using **Test Chat** in admin panel

### Updating API Credentials

1. Go to client → Integrations tab
2. Edit the integration
3. Update credentials
4. All tools using that integration type automatically use new credentials

---

## 🐛 Troubleshooting

| Issue | Check |
|-------|-------|
| "No integration found for client" | Client needs matching integration type in Integrations tab |
| Tool not receiving credentials | Tool's `integration_type` must match integration's type |
| n8n not seeing `_integration` | Check webhook is receiving POST body correctly |
| Auth failing | Verify auth method matches what client API expects |

---

## 📈 Benefits

✅ **One workflow per tool type** - No duplication
✅ **Easy credential updates** - Change in one place
✅ **Centralized management** - All credentials in admin panel
✅ **Client isolation** - Each client's data stays separate
✅ **Scalable** - Add 100 clients without creating new workflows

