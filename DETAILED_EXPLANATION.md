# Detailed Explanation: Database Architecture & Implementation Plan

## Part 1: Foundation & Database Schema (Phase 1) - EXPLAINED

### What Goes Where: PostgreSQL vs Redis

#### PostgreSQL (Permanent Storage)
PostgreSQL is your **source of truth** - everything that needs to be saved permanently goes here:

**Why Postgres?**
- Relational data (clients have conversations, conversations have messages)
- Complex queries (find all conversations for client X in the last month)
- Data integrity (ensure every message belongs to a valid conversation)
- Historical data (never lose customer conversations - legal/analytics reasons)

**What we store in Postgres:**

1. **Clients table** - Your customers (the businesses using your AI)
   ```sql
   - id: unique identifier
   - name: "Bob's Pizza Shop"
   - domain: "bobspizza.com"
   - api_key: secret key they use to authenticate
   - webhook_base_url: where their n8n instance is
   - plan_type: "free", "starter", "pro" (for billing)
   - created_at: when they signed up
   ```
   **Why?** You need to know who's using your service and bill them

2. **Conversations table** - Every chat session
   ```sql
   - id: unique conversation
   - client_id: which business this belongs to
   - session_id: browser session (for reconnecting)
   - user_identifier: customer email/phone (optional)
   - started_at: when chat began
   - ended_at: when chat ended (null if ongoing)
   - total_messages: count for analytics
   ```
   **Why?** Track all customer interactions, analytics, troubleshooting

3. **Messages table** - Every single message sent
   ```sql
   - id: unique message
   - conversation_id: which conversation this belongs to
   - role: "user" (customer) or "assistant" (AI) or "system"
   - content: the actual message text
   - timestamp: when it was sent
   - tokens_used: how many tokens this message consumed (for billing!)
   ```
   **Why?**
   - Show conversation history to customers
   - Train/improve AI later
   - **Token tracking for billing** - count every token used

4. **Tools table** - Master tool catalog (NORMALIZED - shared across all clients)
   ```sql
   - id: unique tool
   - tool_name: "get_order_status"
   - description: "Check the status of a customer order"
   - parameters_schema: JSON defining required params
   - category: "ecommerce"
   - created_at: when created
   ```
   **Why?** Define each tool once, reuse for all clients (no duplication)
   **No client_id!** This is a global catalog of available tools

5. **Client_tools table** - Which clients have which tools (JUNCTION TABLE)
   ```sql
   - id: unique entry
   - client_id: which business
   - tool_id: which tool from the master catalog
   - enabled: true/false
   - n8n_webhook_url: "https://n8n.example.com/webhook/bob-pizza/orders"
   - custom_config: JSON with client-specific settings
   ```
   **Why?**
   - Prevents duplicating tool definitions
   - Easy to add new tool globally (one insert, available to all clients)
   - Each client can have same tool but different webhook (Bob's Pizza vs Jane's Bakery)
   - Example: 100 clients use "get_order_status" → 1 tool definition + 100 junction entries

6. **Client_integrations table** - HOW to connect to client's backend (NOT storing their data!)
   ```sql
   - id: unique integration
   - client_id: which business
   - integration_type: "shopify" / "woocommerce" / "custom_api" / "mysql_database"
   - connection_config: JSON with API endpoints, credentials, auth method
   - enabled: true/false
   - last_sync_test: when we last verified connection works
   - created_at: when added
   ```
   **Example connection_config:**
   ```json
   {
     "api_url": "https://bobspizza.myshopify.com/admin/api/2024-01",
     "api_key": "shpat_xxxxx",
     "auth_type": "bearer_token",
     "rate_limit": 40
   }
   ```
   **Why?**
   - Store HOW to connect, not the actual data
   - Pull data LIVE when needed (always fresh, no sync issues)
   - Manual setup when onboarding new client is fine

7. **Integration_endpoints table** - What data can be pulled
   ```sql
   - id: unique endpoint
   - integration_id: which integration this belongs to
   - endpoint_name: "get_product"
   - endpoint_url: "/products/{product_id}.json"
   - method: "GET"
   - description: "Fetch product details by ID"
   ```
   **Why?** Define what data sources are available for RAG
   **Example:** Customer asks "Do you have pepperoni pizza?"
   1. AI needs product info
   2. Check `integration_endpoints` for "get_product"
   3. Call client's API: `GET https://bobspizza.myshopify.com/.../products/search?query=pepperoni`
   4. Get live inventory count
   5. Tell customer: "Yes! We have pepperoni pizza in stock"

8. **API_usage table** - For billing (AGGREGATED, permanent)
   ```sql
   - id: unique record
   - client_id: which business
   - date: day (2024-12-07)
   - conversation_count: how many chats today
   - message_count: total messages
   - tokens_input: tokens sent to LLM
   - tokens_output: tokens received from LLM
   - tool_calls_count: how many actions executed
   - cost_estimate: calculated cost in USD
   ```
   **Why?**
   - Bill customers accurately
   - **Aggregated from messages table before deletion** (keep forever for billing)
   - Track usage per client
   - Alert when approaching limits
   - Show usage dashboard

9. **Tool_executions table** - Track every action (90-day retention)
   ```sql
   - id: unique execution
   - conversation_id: which chat triggered it
   - tool_name: "get_order_status"
   - parameters: JSON of what was sent
   - n8n_response: what came back
   - success: true/false
   - execution_time_ms: how long it took
   - timestamp: when executed
   ```
   **Why?**
   - Debug failed actions
   - Analytics (most used tools)
   - Audit trail (who ordered what refund)
   - **Retention:** Keep 90 days then delete (prevent bloat)

---

### Database Bloat Prevention Strategy

**Problem:** Storing every message forever = massive database growth
- 1000 customers × 100 messages/day × 365 days = 36.5 million messages/year!
- At ~500 bytes/message = 18 GB/year just for messages

**Solution: Tiered Storage + Aggregation**

1. **Messages table (30-day retention)**
   - Store recent messages for conversation history
   - After 30 days: Aggregate token counts → Delete message content
   - Run cleanup script daily via cron

2. **API_usage table (permanent)**
   - Daily summary: "Client X used 50k tokens on 2024-12-07"
   - Small table (365 rows/client/year)
   - Enough for billing and analytics

3. **Redis cache (1-hour TTL)**
   - Active conversations cached in Redis
   - Don't query Postgres for every message
   - Automatically expires

4. **Optional: Archive to S3**
   - Before deleting old messages, export to S3 (cheap storage)
   - Use only if client needs full history (compliance/legal)

**Result:**
- Postgres stays small and fast
- Still have all billing data
- Can show recent conversations
- Massive cost savings

#### Redis (Temporary Fast Storage)
Redis is your **speed layer** - data that needs to be accessed FAST but doesn't need to last forever:

**Why Redis?**
- In-memory = 100x faster than Postgres
- Automatic expiration (data disappears after X time)
- Perfect for temporary state

**What we store in Redis:**

1. **Active conversation context** (expires after 1 hour of inactivity)
   ```
   Key: conversation:{session_id}
   Value: {
     messages: [last 20 messages],  // Quick context without DB query
     client_id: "123",
     last_activity: timestamp
   }
   TTL: 3600 seconds (1 hour)
   ```
   **Why?**
   - Don't query Postgres for EVERY message
   - Recent messages are HOT data (used constantly)
   - After 1 hour, load from Postgres (cold storage)

2. **Rate limiting** (expires after 1 minute)
   ```
   Key: rate_limit:{client_id}:{minute}
   Value: request_count
   TTL: 60 seconds
   ```
   **Why?**
   - Prevent abuse (client sends 1000 msgs/sec)
   - "Max 60 requests per minute per client"
   - Automatically resets every minute

3. **Response caching** (expires after 5 minutes)
   ```
   Key: cache:{hash_of_question}
   Value: AI_response
   TTL: 300 seconds
   ```
   **Why?**
   - If 5 people ask "do you ship to Eilat?" → answer once, cache it
   - Save API costs (don't call ChatGPT for same question)
   - Faster responses

4. **Session locks** (prevents race conditions)
   ```
   Key: lock:conversation:{session_id}
   Value: "processing"
   TTL: 30 seconds
   ```
   **Why?**
   - User clicks send twice by accident
   - Prevent processing same message twice
   - Lock expires automatically if server crashes

---

### What Are Migration Scripts?

**Simple Explanation:**
Migration scripts are like "construction blueprints" for your database. Each one builds or modifies your database structure.

**Why Not Just Create Tables Manually?**
1. **Version control** - Database changes are tracked in Git
2. **Reproducibility** - Run same migrations on dev, staging, production
3. **Team work** - Everyone has same database structure
4. **Rollback** - Undo changes if something breaks

**How Migrations Work:**

```
Database Versions:
├── Version 0: Empty database
├── Migration 001: Create clients table          → Version 1
├── Migration 002: Create conversations table    → Version 2
├── Migration 003: Create messages table         → Version 3
├── Migration 004: Add tokens_used column        → Version 4
└── Current: Version 4
```

**Example Migration Files:**

📄 **`db/migrations/001_create_clients_table.sql`**
```sql
-- UP: Run this to apply the migration
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DOWN: Run this to undo the migration (rollback)
DROP TABLE clients;
```

📄 **`db/migrations/002_create_conversations_table.sql`**
```sql
-- UP
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    session_id VARCHAR(128) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    UNIQUE(client_id, session_id)
);

CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);

-- DOWN
DROP TABLE conversations;
```

**What Each Migration Does:**

| Migration | Purpose | Why Needed |
|-----------|---------|------------|
| 001 | Create clients table | Store businesses using your platform |
| 002 | Create conversations table | Track chat sessions |
| 003 | Create messages table | Store all messages |
| 004 | Create tools table | Define available actions per client |
| 005 | Create knowledge_base table | Store business info for AI |
| 006 | Create api_usage table | Track tokens for billing |
| 007 | Create tool_executions table | Audit trail for actions |
| 008 | Add indexes for performance | Speed up queries |

**Migration Runner Script (`db/migrate.js`):**
```javascript
// Reads all migration files in order
// Checks which version DB is at
// Runs only new migrations
// Updates version number

// Usage:
// node db/migrate.js up     → Apply all new migrations
// node db/migrate.js down   → Rollback last migration
```

---

### What Is Database Access Layer (Models)?

**Simple Explanation:**
Instead of writing SQL everywhere in your code, you create "model" classes that handle all database operations.

**Bad Way (No Models):**
```javascript
// In your route handler - messy!
app.post('/chat', async (req, res) => {
    const result = await db.query(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [convId, 'user', message]
    );
    // SQL scattered everywhere, hard to maintain
});
```

**Good Way (With Models):**
```javascript
// In your route handler - clean!
app.post('/chat', async (req, res) => {
    await Message.create(convId, 'user', message);
    // Simple, readable, reusable
});
```

**What Each Model Does:**

📄 **`backend/src/models/Client.js`**
```javascript
class Client {
    // Get client by API key (for authentication)
    static async findByApiKey(apiKey) { ... }

    // Create new client
    static async create(name, domain) { ... }

    // Update client settings
    static async update(id, settings) { ... }

    // Get client's usage stats
    static async getUsageStats(id, startDate, endDate) { ... }
}
```
**Why?** Centralize all client database operations

📄 **`backend/src/models/Conversation.js`**
```javascript
class Conversation {
    // Start new conversation
    static async create(clientId, sessionId) { ... }

    // Get conversation with all messages
    static async findBySession(sessionId) { ... }

    // Mark conversation as ended
    static async end(id) { ... }

    // Get all conversations for a client (admin dashboard)
    static async findByClient(clientId, limit, offset) { ... }
}
```
**Why?** Handle all conversation logic in one place

📄 **`backend/src/models/Message.js`**
```javascript
class Message {
    // Save new message
    static async create(conversationId, role, content, tokensUsed) { ... }

    // Get recent messages (for context)
    static async getRecent(conversationId, limit = 20) { ... }

    // Get full conversation history
    static async getAll(conversationId) { ... }

    // Count total tokens used
    static async getTotalTokens(conversationId) { ... }
}
```
**Why?** Message operations + token tracking

📄 **`backend/src/models/Tool.js`** (Master catalog)
```javascript
class Tool {
    // Get all available tools (global catalog)
    static async getAll() { ... }

    // Add new tool to catalog
    static async create(toolName, description, schema, category) { ... }

    // Get tool by name
    static async findByName(toolName) { ... }
}
```
**Why?** Manage global tool catalog (no client-specific data here)

📄 **`backend/src/models/ClientTool.js`** (Junction table)
```javascript
class ClientTool {
    // Get all enabled tools for a client
    static async getEnabledTools(clientId) { ... }

    // Enable a tool for a client
    static async enable(clientId, toolId, webhookUrl, config) { ... }

    // Disable tool for client
    static async disable(clientId, toolId) { ... }

    // Update webhook URL or config
    static async update(clientId, toolId, webhookUrl, config) { ... }
}
```
**Why?** Manage which tools each client has enabled

📄 **`backend/src/models/ClientIntegration.js`** (NEW!)
```javascript
class ClientIntegration {
    // Add new integration for client
    static async create(clientId, type, connectionConfig) { ... }

    // Test connection (verify API is reachable)
    static async testConnection(integrationId) { ... }

    // Get all integrations for client
    static async getByClient(clientId) { ... }

    // Update connection config
    static async updateConfig(integrationId, newConfig) { ... }
}
```
**Why?** Manage connections to client backends

📄 **`backend/src/models/IntegrationEndpoint.js`** (NEW!)
```javascript
class IntegrationEndpoint {
    // Add available endpoint
    static async create(integrationId, name, url, method, description) { ... }

    // Get all endpoints for an integration
    static async getByIntegration(integrationId) { ... }

    // Find endpoint by name (for data fetching)
    static async findByName(integrationId, endpointName) { ... }
}
```
**Why?** Define what data can be pulled from each integration

📄 **`backend/src/models/ApiUsage.js`** - NEW!
```javascript
class ApiUsage {
    // Record usage for billing
    static async recordUsage(clientId, tokensInput, tokensOutput) { ... }

    // Get usage for current billing period
    static async getCurrentPeriodUsage(clientId) { ... }

    // Calculate cost
    static async calculateCost(clientId, startDate, endDate) { ... }

    // Check if client is over limit
    static async isOverLimit(clientId) { ... }
}
```
**Why?** Critical for billing customers accurately

---

## Part 2: Why Each Phase Is Needed - EXPLAINED

### Phase 2: AI Engine Core

**What it does:** Connects to LLM (Ollama/ChatGPT) and manages conversations

**Why each piece is needed:**

1. **LLM Service** (`llmService.js`)
   - **Why?** You need to actually talk to the AI (Ollama now, ChatGPT later)
   - Handles: sending messages, getting responses, function calling
   - **ChatGPT Integration:**
     ```javascript
     // Support both providers:
     if (config.LLM_PROVIDER === 'ollama') {
         // Use Ollama for development
     } else if (config.LLM_PROVIDER === 'openai') {
         // Use ChatGPT API for production
     }
     ```

2. **Token Counting** - NEW!
   ```javascript
   // Before sending to LLM
   const inputTokens = countTokens(messages); // Use tiktoken library

   // After receiving response
   const outputTokens = countTokens(response);

   // Save to database for billing
   await ApiUsage.recordUsage(clientId, inputTokens, outputTokens);
   ```
   **Why?** ChatGPT charges per token - you MUST track this to bill clients

3. **Conversation Manager** (`conversationService.js`)
   - **Why?** LLMs have context limits (can't send 1000 messages)
   - Loads recent messages from Redis (fast)
   - Truncates old messages to fit context window
   - Example: Keep last 20 messages, summarize older ones

4. **System Prompts**
   - **Why?** Tell AI who it is and what it can do
   - Example:
     ```
     You are a customer service agent for Bob's Pizza Shop.
     You can check order status and answer questions about our menu.
     Always be friendly and helpful.
     ```

### Phase 3: Tool Execution System + Live Data Integration

**What it does:** Lets AI perform real actions AND pull live data from client backends

**Why each piece is needed:**

1. **Tool Manager** (`toolManager.js`)
   - **Why?** Convert your database tools into format LLM understands
   - Loads tools from `tools` table (master catalog)
   - Filters by client (via `client_tools` junction table)
   - Example: Database says "get_order_status" → LLM gets:
     ```json
     {
       "name": "get_order_status",
       "description": "Check the status of a customer order",
       "parameters": {
         "order_id": { "type": "string", "required": true }
       }
     }
     ```

2. **n8n Integration** (`n8nService.js`)
   - **Why?** Actually execute the action
   - Flow:
     1. AI says: "I need to call get_order_status with order_id=12345"
     2. Your backend calls: `POST https://n8n.example.com/webhook/order-status`
     3. n8n workflow runs (queries Shopify, database, etc.)
     4. n8n returns: `{"status": "shipped", "tracking": "ABC123"}`
     5. Feed result back to AI
     6. AI tells customer: "Your order has shipped! Tracking: ABC123"

3. **Tool Execution Flow**
   - **Why?** Handle complex multi-step conversations
   - Example:
     ```
     Customer: "Where is my order?"
     AI thinks: Need order ID first
     AI: "What's your order number?"
     Customer: "12345"
     AI: Calls get_order_status(12345)
     Tool returns: "shipped"
     AI: "Your order has shipped!"
     ```

4. **Live Data Integration Service** (`integrationService.js`) - NEW!
   - **Why?** Pull data from client's backend in real-time (not pre-stored)
   - **How it works:**
     ```
     Customer: "Do you have iPhone 15 in stock?"

     AI thinks: I need product inventory data

     Your backend:
     1. Looks up client's integration (client_integrations table)
     2. Finds "check_inventory" endpoint
     3. Calls: GET https://bobsshop.com/api/inventory?sku=iphone15
     4. Gets response: {"sku": "iphone15", "stock": 5}
     5. Caches result in Redis (5 min TTL)
     6. Passes to AI: "Product iPhone 15 has 5 units in stock"

     AI responds: "Yes! We have 5 iPhone 15s in stock."
     ```

   - **Benefits:**
     - Always fresh data (no sync issues)
     - No storage of client data (GDPR-friendly)
     - Works with ANY backend (Shopify, WooCommerce, custom API, database)

   - **Implementation:**
     - Test connection on setup (verify API works)
     - Handle authentication (API keys, OAuth, basic auth)
     - Cache responses in Redis (don't hammer client's API)
     - Timeout handling (max 5s per data fetch)
     - Error handling (if API down, tell AI "unable to check inventory")

5. **Demo n8n Workflows**
   - **Why?** Have working examples for testing
   - Each workflow can either:
     - **Execute action**: book_appointment → writes to Google Calendar
     - **Fetch data**: get_product_info → calls client's API and returns data
   - Examples:
     - **get_order_status**: Calls client's e-commerce API
     - **book_appointment**: Writes to client's booking system
     - **check_inventory**: Fetches live inventory from client's backend
     - **get_product_info**: Pulls product details for AI context (RAG)

### Phase 4: API Endpoints

**What it does:** Exposes your backend to the chat widget

**Why each piece is needed:**

1. **POST /api/v1/chat** - Main endpoint
   - **Why?** This is what the widget calls when user sends message
   - Receives: message from user
   - Returns: AI response
   - **CRITICAL:** This is your core product

2. **Session Management API**
   - **Why?** User refreshes page → conversation continues
   - Create session on first message
   - Store session_id in browser localStorage
   - All future messages include session_id to load history

3. **Configuration API**
   - **Why?** Widget needs to know client's settings
   - Returns: colors, logo, position, welcome message
   - Widget customizes itself automatically

4. **Middleware**
   - **API Key Authentication**
     - **Why?** Only paying clients can use your AI
     - Check: Does this API key exist and is active?

   - **Rate Limiting**
     - **Why?** Prevent abuse (10000 requests/sec)
     - Redis-based: "Max 60 requests/minute per client"

   - **Request Validation (AJV)**
     - **Why?** Prevent bad data crashing your server
     - Validate: message exists, is string, not empty, under 5000 chars

   - **Error Handling**
     - **Why?** Graceful failures
     - LLM down? Return: "Sorry, experiencing technical difficulties"
     - Don't expose internal errors to users

### Phase 5: Chat Widget

**What it does:** The actual chat bubble customers see on websites

**Why each piece is needed:**

1. **Widget UI**
   - **Why?** This is what end-users interact with
   - Must be:
     - Beautiful (people judge quality by UI)
     - Small (loads fast)
     - Works everywhere (all browsers, all devices)

2. **Widget API Client**
   - **Why?** Communicates with your backend
   - Handles:
     - Sending messages
     - Receiving responses (streaming or not)
     - Reconnecting if offline
     - Error messages

3. **Customization System**
   - **Why?** Every business wants their brand colors
   - Loads from `/api/v1/config`
   - Applies: colors, logo, position (bottom-right vs bottom-left)

4. **Widget Bundling**
   - **Why?** Needs to be one simple file
   - Input: Your code (React/Vue/Vanilla JS)
   - Output: `widget.js` (single file, minified, <50KB)
   - **Critical:** Must work with ONE line of code:
     ```html
     <script src="https://yourdomain.com/widget.js"
             data-client-key="abc123"></script>
     ```

### Phase 6: Admin Dashboard

**What it does:** YOUR interface to manage everything

**Why each piece is needed:**

1. **Client Management**
   - **Why?** You need to add new customers
   - Add client → generate API key → give them embed code
   - View all clients, their usage, billing

2. **Tool Configuration**
   - **Why?** Each client has different tools
   - Example: Pizza shop needs "track_order", dentist needs "book_appointment"
   - You configure: tool name, n8n webhook URL, parameters

3. **Knowledge Base Manager**
   - **Why?** AI needs to know about each business
   - Client uploads: FAQ, policies, product catalog
   - You parse and store in database

4. **Conversation Monitor**
   - **Why?** See what customers are asking
   - Debug: "Why did AI give wrong answer?"
   - Analytics: "What are top 10 questions?"

5. **Testing Interface**
   - **Why?** Test before giving to client
   - Chat as if you're a customer
   - See: full logs, tool calls, LLM raw responses
   - Debug mode

### Phase 7: Production LLM Integration

**What it does:** Switch from Ollama (dev) to ChatGPT/Claude (production)

**Why needed:**

1. **Multi-Provider Support**
   - **Why?** Ollama is free but limited, ChatGPT is powerful but costs money
   - Strategy pattern:
     ```javascript
     class LLMProvider {
         async chat(messages) { /* abstract */ }
     }

     class OllamaProvider extends LLMProvider { ... }
     class OpenAIProvider extends LLMProvider { ... }
     class ClaudeProvider extends LLMProvider { ... }

     // Switch easily:
     const llm = config.PROVIDER === 'ollama'
         ? new OllamaProvider()
         : new OpenAIProvider();
     ```

2. **Cost Tracking**
   - **Why?** You pay OpenAI → charge clients → profit
   - Track: input tokens, output tokens, cost per client
   - Set limits: "Free plan = 1000 messages/month"

3. **Optimization**
   - **Why?** Reduce costs
   - Cache common responses (Redis)
   - Use GPT-3.5 for simple queries, GPT-4 for complex
   - Compress prompts (remove unnecessary words)

### Phase 8: Hebrew Support (MOVED TO POST-MVP)

**Skipping for MVP** - focus on English first since Ollama models don't support Hebrew well.
Add this after Phase 7 when using ChatGPT (which handles Hebrew perfectly).

### Phase 9: Advanced Features (POST-MVP)

**RAG (Retrieval-Augmented Generation)**
- **Why?** AI can search through 1000-page product catalog
- Without RAG: Put entire catalog in prompt (expensive, slow, hits limits)
- With RAG: Search for relevant products, only include those 5 products
- How: Vector embeddings + semantic search

**Analytics Dashboard**
- **Why?** Clients want proof of value
- Show: "AI handled 500 conversations this month, 95% satisfaction"

**Escalation to Human**
- **Why?** AI can't handle everything
- Detect: "Customer is angry" or "AI is confused"
- Send notification: "Human needed in conversation #123"

### Phase 10: Deployment

**Why needed:** Run in production, not on your laptop

- **Backend:** Deploy to cloud (Railway, Render, Vercel)
- **Database:** Managed Postgres (Supabase)
- **Redis:** Managed Redis (Upstash)
- **n8n:** Separate VM (needs to run 24/7 for webhooks)
- **Widget:** CDN (Cloudflare) for fast global loading

---

## Part 3: Simplified MVP Checklist

**What you ACTUALLY need to launch and get first paying customer:**

### Absolute Minimum (2-3 weeks of work)

✅ **Database (Phase 1)**
- Postgres: clients, conversations, messages, tools, api_usage
- Redis: conversation cache, rate limiting
- Token tracking for billing

✅ **AI Engine (Phase 2)**
- Ollama integration (dev)
- ChatGPT API integration (production) with token counting
- Basic conversation management

✅ **Tool System (Phase 3)**
- Tool manager
- n8n webhook calling
- 2 demo tools (order status, booking)

✅ **API (Phase 4)**
- POST /api/v1/chat
- API key auth
- Basic rate limiting

✅ **Widget (Phase 5)**
- Simple chat UI
- Embed code
- Works on plain HTML

✅ **Admin Dashboard (Phase 6 - Simplified)**
- Add client (generates API key)
- Configure tools
- View conversations (basic)
- **Skip:** Analytics, advanced settings

✅ **Deployment (Phase 10 - Basic)**
- Backend on Railway
- Postgres on Supabase
- Redis on Upstash
- n8n on cheap VM

**NOT NEEDED FOR MVP:**
- ❌ Hebrew support (Phase 8) - add later
- ❌ RAG/vector search (Phase 9) - add later
- ❌ Advanced analytics (Phase 9) - add later
- ❌ Multi-channel (WhatsApp, etc.) - add later
- ❌ Beautiful admin UI - ugly but functional is fine

---

## Part 4: Missing Items Added

### New Additions to Plan:

1. **Token Tracking System** ✅ Added
   - `api_usage` table in Postgres
   - Token counting in LLM service
   - Usage dashboard for clients
   - Billing calculations

2. **Tool Execution Logging** ✅ Added
   - `tool_executions` table
   - Audit trail for all actions
   - Debugging failed tools

3. **ChatGPT Integration Prep** ✅ Added
   - Multi-provider architecture in Phase 7
   - Token counting (tiktoken library)
   - Cost tracking per client
   - API key management

4. **Rate Limiting** ✅ Already included
   - Redis-based implementation
   - Prevents abuse

5. **Error Handling** ✅ Already included
   - Graceful LLM failures
   - Tool execution timeouts
   - User-friendly error messages

6. **Session Management** ✅ Already included
   - Redis for active sessions
   - Postgres for long-term storage
   - Reconnection handling

### Nothing Critical Missing!

The plan is comprehensive. Only things we removed:
- Hebrew support (moved to post-MVP)
- Over-engineering (keeping it simple)

---

## Summary: Your Path to MVP

**Week 1:** Database schema + migrations + models
**Week 2:** AI engine (Ollama + ChatGPT) with token tracking
**Week 3:** Tool execution via n8n
**Week 4:** API endpoints
**Week 5:** Simple chat widget
**Week 6-7:** Basic admin dashboard

**Week 8:** Deploy + get first customer! 🚀

**Then later:**
- Add Hebrew support
- Add RAG for large knowledge bases
- Add analytics
- Add more integrations

**Total MVP time: 6-8 weeks for one developer**

Ready to start with Phase 1 (database)?
