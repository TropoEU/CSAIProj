# Admin Dashboard User Guide

## Overview

The Admin Dashboard is a web-based interface for managing your AI customer service platform. It allows you to manage clients, configure tools, monitor conversations, and view analytics.

**Access**: http://localhost:3002
**Login**: `admin` / `admin123`

---

## Getting Started

### Logging In

1. Navigate to http://localhost:3002
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click "Sign In"

You'll be redirected to the Dashboard page.

---

## Dashboard Pages

### 1. Dashboard (Home)

**Purpose**: Overview of platform activity and key metrics

**Features**:
- **Total Clients**: Number of active clients
- **Conversations Today**: Number of conversations with trend indicator (vs yesterday)
- **Tool Calls Today**: Number of tool executions with trend indicator
- **Tokens Used Today**: Total tokens consumed across all clients
- **Conversations Over Time**: 7-day chart showing conversation volume
- **Tool Usage**: Top 5 most-used tools in the past 7 days
- **Recent Activity**: Latest conversations and tool calls

**Use Cases**:
- Quick health check of the platform
- Identify usage trends
- Spot popular tools
- Monitor daily activity

---

### 2. Clients

**Purpose**: Manage your business clients who use the AI widget

#### Clients List Page

**What You See**:
- Table of all clients with:
  - Client name
  - Domain
  - API key (masked)
  - Plan type (free/starter/pro/enterprise)
  - Status (active/inactive)
  - Created date

**Actions**:
- **Add Client**: Click "+ Add Client" button
  - Enter client name (e.g., "Bob's Pizza Shop")
  - Enter domain (e.g., "bobspizza.com")
  - Select plan type
  - API key is auto-generated
  - Click "Create Client"
- **View Details**: Click on any client row to see full details
- **Search**: Use search box to filter clients by name

#### Client Detail Page

**What You See**:
- Client information
- **Tools Tab**: Tools enabled for this client
- **Conversations Tab**: Recent conversations for this client
- **Integrations Tab**: External system connections

**Managing Client Tools**:
1. Click on "Tools" tab
2. You'll see:
   - All available tools from the global catalog
   - Which ones are enabled for this client
   - n8n webhook URLs for each enabled tool
3. **Enable a Tool**:
   - Click "Enable" on any disabled tool
   - Enter the n8n webhook URL (e.g., `http://localhost:5678/webhook/get_order_status`)
   - Click "Save"
4. **Disable a Tool**: Click "Disable" on any enabled tool
5. **Test a Tool**: Click "Test" and provide parameter values

**Use Cases**:
- Onboard new clients
- Configure which tools each client can use
- Regenerate API keys if compromised
- Deactivate clients who cancel service

---

### 3. Tools (Main Route)

**Purpose**: Global tool catalog - view all available tools in the system

**What You See**:
- Table of all tools with:
  - Tool name
  - Description
  - Category
  - Usage (Today): Number of times executed today
  - Success Rate: Percentage of successful executions
  - Avg Time: Average execution time in milliseconds

**Important**:
- This is a **READ-ONLY catalog** showing all tools available across the platform
- You **cannot** enable/disable tools here
- To enable tools for a specific client, go to **Clients → Client Detail → Tools tab**
- The "Usage (Today)" column shows today's executions only (may be empty if no tools were called today)

**Use Cases**:
- View all available tools
- Check tool performance (success rates, execution times)
- Identify which tools are most popular
- Monitor tool health

---

### 4. Conversations

**Purpose**: Monitor and review all AI conversations across all clients

#### Conversations List Page

**What You See**:
- Table of conversations with:
  - Client name
  - Session ID
  - Message count
  - Tokens used
  - Tool calls made
  - Started date

**Filters**:
- **Client Filter**: Dropdown to show conversations for specific client only
- **Pagination**: 20 conversations per page

**Actions**:
- **View Transcript**: Click on any conversation row
- **Export**: Click "Export CSV" to download conversation data

#### Conversation Detail Page

**What You See**:
- Full conversation transcript with:
  - User messages
  - AI responses
  - Tool calls (highlighted with parameters and results)
  - Timestamps
  - Token usage per message

**Use Cases**:
- Debug customer issues
- Review AI performance
- Identify common questions
- Audit tool executions
- Export data for analysis

---

### 5. Integrations (Main Route)

**Purpose**: Manage external system connections per client (Shopify, WooCommerce, custom APIs, etc.)

**How It Works**:
1. **Select a Client**: Use the dropdown at the top to choose which client's integrations to manage
2. **View Integrations**: Table shows all integrations for the selected client
   - Integration name
   - Type (shopify, woocommerce, custom_api, database)
   - Status (active/inactive)
   - Last tested date
3. **Add Integration**:
   - Click "+ Add Integration"
   - Fill in:
     - Integration Type (dropdown)
     - Name (e.g., "Bob's Shopify Store")
     - Connection Config (JSON):
       ```json
       {
         "api_url": "https://bobspizza.myshopify.com",
         "api_key": "your_api_key_here",
         "auth_type": "bearer"
       }
       ```
   - Click "Create"
4. **Test Connection**: Click "Test" to verify the integration works
5. **Edit**: Click "Edit" to modify configuration
6. **Delete**: Click "Delete" to remove integration

**Important**:
- The table is **empty until you select a client** from the dropdown
- Each client has their own separate integrations
- Integrations store HOW to connect to client systems, not the data itself
- These are used when you want the AI to pull live data (e.g., check inventory, get order details)

**Use Cases**:
- Connect client's Shopify store for inventory checks
- Link to WooCommerce for order status
- Set up custom API endpoints for client data
- Test API connectivity before going live

---

### 6. Test Chat

**Purpose**: Test the AI as if you're a customer, with full debugging capabilities

**How It Works**:
1. **Select Client**: Choose which client's AI configuration to test
2. **Send Message**: Type a message in the input field
3. **View Response**: See AI response with:
   - Message content
   - Tool calls made (if any)
   - Parameters passed to tools
   - Tool results
   - Tokens used
4. **Debug Mode**: Toggle to see raw LLM responses
5. **Session**: Each test creates a new session ID

**Use Cases**:
- Test new tools before enabling for clients
- Debug AI behavior
- Verify tool execution
- Train on expected responses
- Demo to clients

---

## Common Workflows

### Adding a New Client

1. Go to **Clients** page
2. Click "+ Add Client"
3. Fill in client details:
   - Name: "Bob's Pizza Shop"
   - Domain: "bobspizza.com"
   - Plan: "pro"
4. Click "Create Client"
5. Copy the API key
6. Go to **Client Detail** → **Tools** tab
7. Enable required tools (e.g., get_order_status, book_appointment)
8. Enter n8n webhook URLs for each tool
9. Test each tool
10. Give client their API key and embedding code

### Setting Up Tools for a Client

1. Go to **Clients** page
2. Click on the client
3. Go to **Tools** tab
4. For each tool you want to enable:
   - Click "Enable"
   - Enter the n8n webhook URL (e.g., `http://localhost:5678/webhook/get_order_status`)
   - Click "Save"
5. Test each tool with sample parameters
6. Verify in **Test Chat** that tools work correctly

### Monitoring Client Activity

1. Go to **Dashboard** for overview
2. Check **Conversations** for detailed transcripts
3. Filter by client to see specific activity
4. Review **Tool Usage** to see which tools are popular
5. Export conversation data for analysis

### Debugging Issues

1. Go to **Conversations** page
2. Filter by client if needed
3. Find the problematic conversation
4. Click to view transcript
5. Review:
   - User messages
   - AI responses
   - Tool calls and results
   - Error messages
6. Go to **Test Chat** to reproduce
7. Check tool configuration in **Client Detail** → **Tools**
8. Test integration in **Integrations** page

---

## Tips & Best Practices

### Security

- Change the default admin password immediately
- Keep API keys secure - they're visible in the dashboard
- Regenerate API keys if compromised
- Deactivate clients who shouldn't have access

### Tool Configuration

- Always test tools before enabling for clients
- Use descriptive tool names
- Keep n8n webhook URLs updated
- Monitor tool success rates

### Conversation Monitoring

- Review conversations weekly to identify common issues
- Export data for trend analysis
- Check for AI misunderstandings
- Use insights to improve system prompts

### Performance

- Dashboard loads data from the last 7 days for charts
- Conversations page uses pagination (20 per page)
- Export feature works for filtered data
- Token usage tracked automatically

---

## Troubleshooting

### "Failed to get tool stats" Error

**Cause**: No tool executions today
**Fix**: This is normal - the page shows today's usage. If no tools were called today, the table is empty.

### Empty Integrations Table

**Cause**: No client selected
**Fix**: Select a client from the dropdown at the top of the page

### "Unauthorized" Error

**Cause**: JWT token expired (24h lifetime)
**Fix**: Log out and log back in

### Tools Not Showing for Client

**Cause**: Tools must be enabled per-client
**Fix**: Go to Client Detail → Tools tab and enable them

---

## API Integration

The admin dashboard uses these backend endpoints:

- `POST /admin/login` - Authentication
- `GET /admin/clients` - List clients
- `GET /admin/clients/:id` - Client details
- `POST /admin/clients` - Create client
- `PUT /admin/clients/:id` - Update client
- `GET /admin/clients/:id/tools` - Client tools
- `POST /admin/clients/:id/tools` - Enable tool
- `GET /admin/conversations` - List conversations
- `GET /admin/conversations/:id` - Conversation details
- `GET /admin/stats/overview` - Dashboard stats
- `GET /admin/stats/tools` - Tool usage stats
- `GET /admin/clients/:id/integrations` - Client integrations
- `POST /admin/test-chat` - Test chat interface

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Next Steps

After familiarizing yourself with the dashboard:

1. **Add your first client** via the Clients page
2. **Enable tools** for that client
3. **Test the widget** using the embedding code
4. **Monitor conversations** as they come in
5. **Set up integrations** if needed (Shopify, WooCommerce, etc.)
6. **Export data** periodically for analysis

For technical details, see `IMPLEMENTATION_PLAN.md` and `CLAUDE.md`.
