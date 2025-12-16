# n8n Workflows with Integration Support

This directory contains n8n workflows that support the **Integration System** - allowing ONE workflow per tool to serve ALL clients with their own API credentials.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOW IT WORKS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend receives tool call from AI                                          │
│           │                                                                  │
│           ▼                                                                  │
│  Gets tool's required_integrations (e.g., ["order_api"])                    │
│           │                                                                  │
│           ▼                                                                  │
│  Gets client_tool's integration_mapping (e.g., {"order_api": 39})           │
│           │                                                                  │
│           ▼                                                                  │
│  Fetches integration credentials from database                               │
│           │                                                                  │
│           ▼                                                                  │
│  Calls n8n webhook with:                                                     │
│  {                                                                           │
│    orderNumber: "ORD-001",              // Tool parameters                   │
│    _integrations: {                     // Client's API credentials          │
│      "order_api": {                     // Keyed by integration type         │
│        apiUrl: "https://api.client.com/orders/{orderNumber}/status",        │
│        apiKey: "client_api_key",                                            │
│        method: "GET",                                                        │
│        authMethod: "bearer"                                                  │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
│           │                                                                  │
│           ▼                                                                  │
│  n8n workflow:                                                               │
│  - Gets integration by key: _integrations.order_api                          │
│  - Replaces URL placeholders: {orderNumber} → ORD-001                        │
│  - Calls the client's API with their credentials                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Integration URLs
Each integration stores the **FULL endpoint URL** with optional placeholders:
- `http://api.example.com/orders/{orderNumber}/status` (GET)
- `http://api.example.com/inventory/check` (POST)
- `http://api.example.com/bookings` (POST)

The n8n workflow replaces placeholders like `{orderNumber}` with actual values.

## 📁 Available Workflows

### 1. Check Inventory (`check_inventory.json`)
- **Purpose**: Check product availability and stock levels
- **Webhook Path**: `/webhook/check_inventory`
- **Integration Type**: `inventory_api`
- **Parameters**:
  - `productName` (optional): Product name
  - `productSku` (optional): Product SKU
  - `quantity` (optional): Quantity needed (default: 1)
- **Mock Data**: Pizza items, sides, and out-of-stock items

### 2. Get Order Status (`get_order_status.json`)
- **Purpose**: Check the status of a customer order
- **Webhook Path**: `/webhook/get_order_status`
- **Integration Type**: `order_api`
- **Parameters**:
  - `orderNumber` (required): Order number to look up
- **Mock Data**: Orders in various statuses (preparing, out for delivery, delivered)

### 3. Book Appointment (`book_appointment.json`)
- **Purpose**: Book a reservation or appointment
- **Webhook Path**: `/webhook/book_appointment`
- **Integration Type**: `booking_api`
- **Parameters**:
  - `date` (required): Appointment date (YYYY-MM-DD)
  - `time` (required): Appointment time (HH:MM)
  - `serviceType` (optional): Type of service
  - `customerName` (optional): Customer name
  - `customerEmail` (optional): Customer email
  - `customerPhone` (optional): Customer phone
  - `partySize` (optional): Number of guests
  - `notes` (optional): Special requests
- **Features**: Availability checking, confirmation IDs

---

## 🚀 Setup Instructions

### Step 1: Import Workflows into n8n

1. Open n8n: `http://localhost:5678`
2. Log in with your credentials
3. For each workflow file:
   - Click **Add Workflow** or **+**
   - Click the three dots menu (⋮) → **Import from File**
   - Select the JSON file
   - Click **Save** and **Activate**

### Step 2: Verify Workflow Structure

Each workflow should have this structure:

```
Webhook → Check Integration → Has Real API? → [Branch]
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
            Call Real API                    Mock Fallback
                    │                                 │
                    ▼                                 │
            Format Response                          │
                    │                                 │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                              Merge
                                 │
                                 ▼
                        Respond to Webhook
```

### Step 3: Test Webhooks

**Test with mock data (no integration):**
```bash
curl -X POST http://localhost:5678/webhook/check_inventory \
  -H "Content-Type: application/json" \
  -d '{"productName": "pepperoni"}'
```

**Test with integration credentials (simulates real client):**
```bash
curl -X POST http://localhost:5678/webhook/check_inventory \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "pepperoni",
    "_integration": {
      "apiUrl": "https://api.example.com",
      "apiKey": "test_key_123",
      "authMethod": "bearer"
    }
  }'
```

---

## 🔧 Accessing Integration Data in n8n

When the backend passes integration credentials, access them in n8n like this:

| What | n8n Expression |
|------|----------------|
| API Base URL | `{{ $json._integration.apiUrl }}` |
| API Key | `{{ $json._integration.apiKey }}` |
| API Secret | `{{ $json._integration.apiSecret }}` |
| Auth Method | `{{ $json._integration.authMethod }}` |
| Headers | `{{ $json._integration.headers }}` |
| Full Config | `{{ $json._integration.config }}` |

### Example: HTTP Request Node Configuration

**URL:**
```
{{ $json._integration.apiUrl }}/api/inventory/{{ $json.productSku }}
```

**Headers:**
```
Authorization: Bearer {{ $json._integration.apiKey }}
Content-Type: application/json
```

---

## 📋 Client Setup Checklist

For each client that needs these tools:

1. **Admin Panel → Tools**
   - Verify each tool has the correct `integration_type` set

2. **Admin Panel → Clients → [Client] → Tools**
   - Enable the tools needed
   - Set webhook URL: `http://localhost:5678/webhook/{tool_name}`

3. **Admin Panel → Clients → [Client] → Integrations**
   - Add integrations matching the tool requirements:
     - `inventory_api` for check_inventory tool
     - `order_api` for get_order_status tool
     - `booking_api` for book_appointment tool
   - Fill in API URL and API Key

---

## 🧪 Testing Flow

### Full Integration Test (via Backend)

```bash
# Start the backend
cd backend && npm start

# In another terminal, test via the chat API
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_CLIENT_API_KEY" \
  -d '{
    "sessionId": "test-session",
    "message": "Do you have pepperoni in stock?"
  }'
```

Expected flow:
1. AI recognizes need for `check_inventory` tool
2. Backend fetches client's `inventory_api` credentials
3. Backend calls n8n with tool params + `_integration`
4. n8n calls real API (or mock if no integration)
5. AI receives result and responds to user

### Test in Admin Panel

1. Go to Admin Panel → Chat Test
2. Select a client (e.g., Bob's Pizza)
3. Ask: "Check if you have pepperoni in stock"
4. Watch console logs to see integration data being passed

---

## 🔍 Troubleshooting

### Workflow Not Using Real API

1. Check that client has the correct integration type configured
2. Verify integration has `api_url` set (not just `webhook_url`)
3. Check backend logs for `[Integration] No {type} integration found`

### Mock Data Always Used

The mock fallback runs when:
- No `_integration` object in request
- `_integration.apiUrl` is null/empty
- Testing directly via n8n (without backend)

### Real API Call Failing

1. Check the "Call Real API" node execution in n8n
2. Verify API URL is correct
3. Check authentication method matches what API expects
4. Look at HTTP response status and body

---

## 🏢 Adding More Tools

To add a new tool with integration support:

1. **Create workflow in n8n:**
   - Copy an existing workflow as template
   - Modify the mock data and API endpoints
   - Update parameter handling

2. **Register tool in Admin Panel:**
   - Add tool with appropriate `integration_type`

3. **Define integration type (if new):**
   - Add to `integrationService.getAvailableIntegrationTypes()`

4. **Export workflow:**
   - Download as JSON
   - Save to this directory

---

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Webhook Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [INTEGRATION_SYSTEM_GUIDE.md](../INTEGRATION_SYSTEM_GUIDE.md) - Full integration system documentation
