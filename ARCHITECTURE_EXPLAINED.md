# Integration Architecture - Clear Explanation

## The Confusion: Generic Tools + Client-Specific Integrations

**Your Question:** "How can a generic tool take a client-specific integration?"

**Answer:** It doesn't directly! There's a mapping layer in between.

---

## The Complete Flow (Step by Step)

### Step 1: Define Generic Tool (Reusable Across All Clients)

**In Tools page, you create:**
```json
Tool: "get_order_status"
Required Integrations: [
  {
    "key": "order_api",
    "name": "Order Management API",
    "required": true,
    "description": "Fetches order information"
  }
]
```

**What this means:**
- This tool says: "I need SOME kind of order API"
- The "key" is like a placeholder: "order_api"
- The tool is **generic** - it doesn't know about Bob's Shopify or Alice's WooCommerce yet

---

### Step 2: Create Client-Specific Integrations

**For Bob's Pizza (Client #1):**
```
Integration Type: "order_api"  ← Matches the tool's "key"
Name: "Bob's Shopify API"
API URL: https://bob-pizza.myshopify.com/api
API Key: sk-bob123
```

**For Alice's Bakery (Client #2):**
```
Integration Type: "order_api"  ← Same type, different API!
Name: "Alice's WooCommerce API"
API URL: https://alice-bakery.com/wp-json/wc/v3
API Key: ck-alice456
```

**What this means:**
- Both clients have "order_api" type integrations
- But they point to DIFFERENT APIs
- Bob's goes to Shopify, Alice's goes to WooCommerce

---

### Step 3: Enable Tool for Specific Client (THE MAPPING HAPPENS HERE!)

**When you enable "get_order_status" for Bob:**

```
Client: Bob's Pizza
Tool: get_order_status
Integration Mapping: {
  "order_api": 15  ← This is Bob's Shopify integration ID
}
Webhook: http://localhost:5678/webhook/get_order_status
```

**When you enable "get_order_status" for Alice:**

```
Client: Alice's Bakery
Tool: get_order_status
Integration Mapping: {
  "order_api": 23  ← This is Alice's WooCommerce integration ID
}
Webhook: http://localhost:5678/webhook/get_order_status
```

**What this means:**
- SAME tool (get_order_status)
- DIFFERENT mapping for each client
- The tool's "order_api" placeholder gets replaced with the actual client integration

---

### Step 4: Execution (When Customer Uses the Chat Widget)

**Customer on Bob's website asks: "Where is my order?"**

```
1. Widget sends message to backend
2. Backend loads "get_order_status" tool
3. Backend sees tool needs "order_api"
4. Backend looks up Bob's client_tool mapping: {"order_api": 15}
5. Backend fetches integration #15 → Bob's Shopify API credentials
6. Backend calls n8n webhook with:
   {
     orderNumber: "12345",
     _integrations: {
       "order_api": {
         apiUrl: "https://bob-pizza.myshopify.com/api",
         apiKey: "sk-bob123",
         authMethod: "bearer"
       }
     }
   }
7. n8n workflow calls Bob's Shopify API
8. Returns order status to customer
```

**Customer on Alice's website asks the same question:**

```
Same flow, but:
5. Backend fetches integration #23 → Alice's WooCommerce API credentials
6. Backend calls n8n webhook with:
   {
     orderNumber: "67890",
     _integrations: {
       "order_api": {
         apiUrl: "https://alice-bakery.com/wp-json/wc/v3",
         apiKey: "ck-alice456",
         authMethod: "bearer"
       }
     }
   }
7. n8n workflow calls Alice's WooCommerce API
```

---

## The Key Insight

**Generic Tool** (Reusable)
```
"I need an 'order_api'"
```

**Client Integration** (Specific)
```
Bob: "I have Shopify at this URL"
Alice: "I have WooCommerce at this URL"
```

**Client Tool Mapping** (The Bridge)
```
Bob: "order_api" → Bob's Shopify Integration
Alice: "order_api" → Alice's WooCommerce Integration
```

---

## Database Structure

```
┌─────────────────────┐
│ tools               │
│ - id: 1             │
│ - tool_name         │
│ - required_integrations: [{"key": "order_api"}]
└─────────────────────┘
         │
         │ (Many clients can enable this tool)
         ↓
┌─────────────────────┐
│ client_tools        │
│ - client_id: 5      │ ← Bob
│ - tool_id: 1        │
│ - integration_mapping: {"order_api": 15}  ← Maps to Bob's integration
│ - n8n_webhook_url   │
└─────────────────────┘
         │
         ↓
┌─────────────────────┐
│ client_integrations │
│ - id: 15            │ ← Bob's Shopify
│ - client_id: 5      │
│ - integration_type: "order_api"
│ - connection_config: {apiUrl, apiKey...}
└─────────────────────┘
```

---

## Example: Tool Requiring Multiple Integrations

**Tool: "send_order_confirmation"**
```json
{
  "required_integrations": [
    {"key": "order_api", "name": "Order API", "required": true},
    {"key": "email_api", "name": "Email Service", "required": true}
  ]
}
```

**Bob's Setup:**
```
Integration #15: type="order_api", apiUrl="shopify.com/..."
Integration #16: type="email_api", apiUrl="sendgrid.com/..."

Client Tool Mapping:
{
  "order_api": 15,
  "email_api": 16
}
```

**When Tool Executes:**
```javascript
_integrations: {
  "order_api": {
    apiUrl: "shopify.com/...",
    apiKey: "sk-bob123"
  },
  "email_api": {
    apiUrl: "sendgrid.com/...",
    apiKey: "SG.bob789"
  }
}
```

The n8n workflow can use BOTH APIs in one execution!

---

## Why This Design?

1. **One tool, many clients**: Write "get_order_status" once, use it for Shopify, WooCommerce, custom APIs
2. **Flexibility**: Each client can use different APIs
3. **Reusability**: Tools are truly generic and reusable
4. **Composability**: Tools can combine multiple APIs (order + email + SMS)

---

## The Fix Needed

**Backend bug fixed:**
- `ClientTool.getAllTools()` now includes `required_integrations` field

**What you need to do:**
1. **Restart backend server** (Ctrl+C and `npm start`)
2. **Refresh admin page**
3. **Edit a client's tool** - You should now see integration mapping!

---

**Date:** December 15, 2025
**Status:** Architecture explained, backend bug fixed
