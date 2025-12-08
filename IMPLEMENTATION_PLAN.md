# CSAIProj Implementation Plan

## Overview

Building a multi-tenant AI agent platform that businesses can embed as a chat widget to handle customer and technical support automatically.

---

## Phase 1: Foundation & Database Schema (Week 1) ✅ COMPLETE

**Goal**: Set up multi-tenant architecture and data models

### 1.1 Database Schema Design (PostgreSQL) ✅

#### Core Tables

- [x] **Clients table** (tenants)

  - `id`, `name`, `domain`, `api_key`, `plan_type`, `created_at`, `status`
  - Business info, branding settings, billing plan

- [x] **Conversations table**

  - `id`, `client_id`, `session_id`, `user_identifier`, `started_at`, `ended_at`, `message_count`, `tokens_total`
  - Track chat sessions (aggregated stats, not individual messages)

- [x] **Messages table** (WITH RETENTION POLICY)
  - `id`, `conversation_id`, `role` (user/assistant/system), `content`, `timestamp`, `tokens_used`
  - Store recent messages only (30 days retention, then auto-delete or archive to S3)
  - **Why limited?** Prevent massive database growth
  - Token counts are aggregated to `api_usage` table before deletion

#### Tools Architecture (Normalized) ✅

- [x] **Tools table** (master tool definitions - shared across all clients)

  - `id`, `tool_name`, `description`, `parameters_schema`, `category`, `created_at`
  - Example: "get_order_status", "book_appointment", "check_inventory"
  - **No client_id** - this is a catalog of ALL possible tools

- [x] **Client_tools table** (many-to-many junction - which clients have which tools)
  - `id`, `client_id`, `tool_id`, `enabled`, `n8n_webhook_url`, `custom_config`
  - Links clients to tools they have enabled
  - Each client can have same tool but different webhook URL
  - **Why?** Prevents duplicating tool definitions, easy to add new tools globally

#### Client Integrations (LIVE data pulling, not stored) ✅

- [x] **Client_integrations table** (replaces knowledge_base)

  - `id`, `client_id`, `integration_type` (shopify/woocommerce/custom_api/database)
  - `connection_config` (JSON: API endpoint, auth method, credentials)
  - `enabled`, `last_sync_test`, `created_at`
  - **Purpose:** Store HOW to connect to client's backend, not the data itself
  - Example: `{"api_url": "https://shop.com/api", "api_key": "xxx", "type": "rest"}`

- [x] **Integration_endpoints table** (what data can be pulled from each integration)
  - `id`, `integration_id`, `endpoint_name`, `endpoint_url`, `method`, `description`
  - Example: `{"name": "get_product", "url": "/products/:id", "method": "GET"}`
  - **Purpose:** Define available data sources for RAG

#### Billing & Analytics ✅

- [x] **API_usage table** (aggregated daily stats)

  - `id`, `client_id`, `date`, `conversation_count`, `message_count`, `tokens_input`, `tokens_output`, `tool_calls_count`, `cost_estimate`
  - **Aggregated from messages before they're deleted**
  - Permanent record for billing

- [x] **Tool_executions table** (audit log - keep 90 days)
  - `id`, `conversation_id`, `tool_name`, `parameters`, `n8n_response`, `success`, `execution_time_ms`, `timestamp`
  - Retention: 90 days, then delete (keep only summary stats)

### 1.1b Redis Schema Design ✅ COMPLETE

- [x] **Active conversation context** (key: `conversation:{session_id}`, TTL: 1 hour)
  - Cache recent messages for fast access
  - Implemented in `RedisCache.setConversationContext()` with error handling
- [x] **Rate limiting** (key: `rate_limit:{client_id}:{minute}`, TTL: 60s)
  - Track requests per minute per client
  - Uses Unix timestamp-based minute buckets (timezone-safe)
- [x] **Response caching** (key: `cache:{hash}`, TTL: 5 minutes)
  - Cache identical questions to save API costs
  - Includes `RedisCache.hashQuery()` utility for consistent hashing
- [x] **Session locks** (key: `lock:conversation:{session_id}`, TTL: 30s)
  - Prevent duplicate message processing
  - Uses atomic SET NX operations
- [x] **Comprehensive test suite** in `backend/tests/services/redisCache.test.js`

### 1.2 Migration Scripts

- [x] Create `db/migrations/` directory
- [x] Write SQL migration files for all tables
- [x] Create migration runner script
- [ ] Add seed data for testing

### 1.3 Database Access Layer

- [x] Create `backend/src/models/` directory
- [x] Implement **Client** model with CRUD operations
- [x] Implement **Conversation** model
- [x] Implement **Message** model (with token tracking + auto-deletion after 30 days)
- [x] Implement **Tool** model (master tool catalog)
- [x] Implement **ClientTool** model (junction table - which clients have which tools)
- [x] Implement **ClientIntegration** model (connection configs for live data)
- [x] Implement **IntegrationEndpoint** model (available data sources)
- [x] Implement **ApiUsage** model (billing tracking)
- [x] Implement **ToolExecution** model (audit logging)

### 1.4 Data Retention Scripts

- [ ] Create cleanup script (`backend/src/scripts/cleanup.js`)
  - Delete messages older than 30 days (after aggregating tokens)
  - Delete tool_executions older than 90 days
  - Run daily via cron job
- [ ] Aggregation script (summarize token usage before deletion)

**Deliverable**: Normalized database with retention policies + billing infrastructure

---

## Phase 2: AI Engine Core ✅ COMPLETE

**Goal**: Build the LLM integration and conversation management

### 2.1 LLM Service (Multi-Provider Architecture) ✅

- [x] Create `backend/src/services/llmService.js` with provider abstraction
- [x] Implement **Ollama provider** (localhost:11434 for development)
  - Chat completion with context
  - Streaming support prepared (not yet used)
  - Tool/function calling via prompt engineering (not native API)
- [x] Implement **Claude provider** (Anthropic API for production)
  - Claude 3.5 Sonnet integration
  - Function calling (tool use)
  - Token tracking and cost calculation
- [ ] Implement **OpenAI provider** (ChatGPT API for production) - Placeholder only
  - GPT-4o integration (not implemented)
  - Function calling (tool use)
  - Streaming responses
- [x] Add **token counting**
  - Count input tokens from LLM response
  - Count output tokens from response
  - Save to `api_usage` table via conversation stats
- [x] Add configuration for model selection (env var: `LLM_PROVIDER=ollama|claude|openai`)
- [x] Create prompt templates for system messages
- [x] Add error handling and retries
- [x] Cost calculation (track $ per client based on tokens)

### 2.2 Conversation Manager ✅

- [x] Create `backend/src/services/conversationService.js`
- [x] Implement conversation context management
  - Load conversation history from DB
  - Add new messages to context
  - Manage context window limits (20 messages max)
- [x] Session management (create, retrieve, end)
- [x] Context summarization for long conversations (placeholder - can add later)

### 2.3 System Prompts & Instructions ✅

- [x] Create `backend/src/prompts/` directory
- [x] Design base system prompt template (English only for MVP)
- [x] Create client-specific prompt injection
- [x] Define AI personality and tone guidelines
- [x] Add instructions for tool usage

### 2.4 Redis Integration for Caching ✅

- [x] Implement conversation context caching (recent messages)
- [x] Implement response caching (identical questions)
- [x] Implement rate limiting logic
- [x] Add session locks to prevent duplicate processing
- [x] Add error handling and production-safe SCAN usage

**Deliverable**: ✅ Working AI engine with Ollama (dev) + Claude (prod) support, token tracking, and caching

**Test Results**:
- ✅ LLM Service operational (Ollama with dolphin-llama3)
- ✅ Full 4-turn conversation flow tested
- ✅ Message and conversation persistence working
- ✅ Token tracking and statistics working
- ✅ All Phase 2 integration tests passing

---

## Phase 3: Tool Execution System (Week 3)

**Goal**: Enable AI to perform real actions via n8n

### 3.1 Tool Manager

- [ ] Create `backend/src/services/toolManager.js`
- [ ] Implement tool registration system
  - Parse tool definitions from database
  - Convert to LLM function calling format
  - Validate tool schemas
- [ ] Dynamic tool loading per client

### 3.2 n8n Integration Service

- [ ] Complete `backend/src/services/n8nService.js`
- [ ] Implement webhook caller
  - POST to n8n webhook URLs
  - Pass parameters from AI tool calls
  - Handle responses and errors
  - Timeout handling (max 30s per tool)
- [ ] Response formatter (convert n8n output to AI-readable format)

### 3.3 Tool Execution Flow

- [ ] Implement tool call detection from LLM response
- [ ] Execute tool via n8n webhook
- [ ] Wait for result (with timeout handling - max 30s)
- [ ] Feed result back to LLM for final response
- [ ] Handle multi-step tool calls
- [ ] Error recovery (if tool fails, tell AI to apologize)
- [ ] **Log all executions** to `tool_executions` table (parameters, response, timing)

### 3.4 Live Data Integration Service

- [ ] Create `backend/src/services/integrationService.js`
- [ ] Implement connection testing (verify client's API is reachable)
- [ ] Implement data fetching (call client's backend on-demand)
  - Example: Customer asks "Do you have iPhone 15?" → Fetch from client's inventory API → Tell AI the result
- [ ] Cache fetched data temporarily in Redis (5-10 min TTL to reduce API calls)
- [ ] Handle authentication (API keys, OAuth, basic auth)

### 3.5 Create Demo n8n Workflows

- [ ] `get_order_status` workflow (calls client's e-commerce API)
- [ ] `book_appointment` workflow (writes to client's booking system or Google Calendar)
- [ ] `check_inventory` workflow (fetches live inventory from client's API)
- [ ] `get_product_info` workflow (fetches product details for RAG)
- [ ] Export workflows to `n8n-workflows/` folder

**Deliverable**: AI can execute real actions AND pull live data from client backends

---

## Phase 4: API Endpoints (Week 4)

**Goal**: Expose clean REST API for widget

### 4.1 Chat API

- [ ] **POST /api/v1/chat** (main endpoint)
  - Accept: `{ client_api_key, session_id, message, user_id (optional) }`
  - Return: `{ response, session_id, tool_calls_made }`
  - Handle streaming with SSE (optional)

### 4.2 Session Management API

- [ ] **POST /api/v1/sessions/start**

  - Create new conversation session
  - Return session_id

- [ ] **GET /api/v1/sessions/:session_id/history**

  - Retrieve conversation history

- [ ] **DELETE /api/v1/sessions/:session_id/end**
  - Mark conversation as ended

### 4.3 Client Configuration API

- [ ] **GET /api/v1/config** (for widget initialization)
  - Accept: `client_api_key`
  - Return: widget settings, branding, available features

### 4.4 Middleware

- [ ] API key authentication middleware
- [ ] Rate limiting per client (Redis-based)
- [ ] Request validation using AJV
- [ ] Error handling middleware
- [ ] CORS configuration

**Deliverable**: Complete REST API for frontend integration

---

## Phase 5: Chat Widget (Week 5)

**Goal**: Build embeddable widget for any website

### 5.1 Widget Core

- [ ] Create `frontend/widget/` directory
- [ ] Build minimal chat UI (HTML + CSS + Vanilla JS)
  - Chat bubble button
  - Chat window (open/close)
  - Message list
  - Input field + send button
  - Typing indicator

### 5.2 Widget API Client

- [ ] Implement fetch wrapper for backend API
- [ ] Session management (store session_id in localStorage)
- [ ] Message sending and receiving
- [ ] Error handling and retry logic
- [ ] Offline detection

### 5.3 Customization System

- [ ] Load client branding from `/api/v1/config`
- [ ] Apply custom colors, logo, position
- [ ] Support light/dark themes
- [ ] Multilingual support (Hebrew RTL + English LTR)

### 5.4 Widget Bundling

- [ ] Set up build system (Vite or esbuild)
- [ ] Create single JS bundle (`widget.js`)
- [ ] Minimize bundle size (<50KB)
- [ ] Add version hash for cache busting
- [ ] Host on CDN-like endpoint

### 5.5 Embedding Instructions

- [ ] Create simple embed code:
  ```html
  <script
    src="https://yourdomain.com/widget.js"
    data-client-key="YOUR_API_KEY"
  ></script>
  ```
- [ ] Test on: plain HTML, WordPress, Wix, Shopify

**Deliverable**: Working widget that anyone can embed

---

## Phase 6: Admin Dashboard (Week 6-7)

**Goal**: Interface for you to manage clients and configure AI

### 6.1 Authentication

- [ ] Admin login system (simple username/password to start)
- [ ] JWT-based session management
- [ ] Protected routes

### 6.2 Client Management

- [ ] **Clients List Page**
  - View all clients
  - Add new client (generate API key)
  - Edit client details
  - Deactivate client

### 6.3 Tool Configuration Interface

- [ ] **Tools Page** (per client)
  - List all tools for a client
  - Add new tool (name, description, n8n webhook URL)
  - Edit tool parameters schema
  - Enable/disable tools
  - Test tool execution (manual trigger)

### 6.4 Integration Manager (CHANGED from Knowledge Base)

- [ ] **Integrations Page** (per client)

  - Add new integration (select type: Shopify, WooCommerce, custom API, database)
  - Configure connection (API URL, credentials, auth method)
  - Test connection (verify it works)
  - Define available endpoints (what data can be pulled)
  - View integration logs (recent API calls, errors)

  **Example workflow for new client:**

  1. Client signs up: "Bob's Pizza Shop"
  2. You add Shopify integration: `{"api_url": "bobspizza.myshopify.com", "api_key": "xxx"}`
  3. Test connection → Success
  4. Define endpoints: "get_product", "check_inventory", "get_order"
  5. AI can now answer: "Do you have pepperoni pizza?" by fetching live inventory

### 6.5 Conversation Monitor

- [ ] **Conversations Page**
  - View all conversations (filterable by client)
  - Read conversation transcripts
  - See tool calls made
  - Export conversations as CSV/JSON

### 6.6 Testing Interface

- [ ] **Test Chat Page**
  - Test AI as if you're a customer
  - Select client to test
  - See full tool call logs
  - Debug mode (show raw LLM responses)

**Deliverable**: Full admin dashboard to manage everything

---

## Phase 7: LLM Optimization & Claude Integration (Week 8 - POST-MVP)

**Goal**: Optimize costs and add Claude as alternative provider

**Note**: ChatGPT/GPT-4o is already integrated in Phase 2. This phase is about optimization and adding Claude as an option.

### 7.1 Claude Integration (Optional Alternative)

- [ ] Add Claude 3.5 Sonnet integration (Anthropic API)
- [ ] Allow per-client LLM selection (OpenAI vs Claude)
- [ ] Compare cost and quality between providers

### 7.2 Cost Optimization

- [ ] Advanced prompt compression techniques
- [ ] Optimize context window usage (smart truncation)
- [ ] Fallback to GPT-3.5 for simple queries (cheaper)
- [ ] A/B testing for model selection

### 7.3 Usage Limits & Alerts

- [ ] Set usage limits per client plan (free/starter/pro)
- [ ] Alert system when client approaches limit
- [ ] Auto-throttle or upgrade prompts

**Deliverable**: Optimized costs and multiple provider options

---

## Phase 8: Hebrew Support (POST-MVP - Add After Launch)

**Goal**: Perfect Hebrew language handling

**Note**: Skipping for MVP since Ollama models don't support Hebrew well. ChatGPT/Claude handle Hebrew natively, so this phase becomes easier after Phase 2 is complete with production LLMs.

### 8.1 RTL Support in Widget

- [ ] Detect Hebrew messages (auto-detect language)
- [ ] Apply RTL text direction dynamically
- [ ] Fix UI layout for RTL (flip alignment, scrollbars)
- [ ] Test with mixed Hebrew/English conversations

### 8.2 Hebrew Prompts & Localization

- [ ] Create Hebrew system prompt variations
- [ ] Test Hebrew comprehension and responses
- [ ] Optimize for Israeli businesses (ILS currency, shipping zones, culture)
- [ ] Add Hebrew UI labels in widget

**Deliverable**: Fully functional bilingual support (English + Hebrew)

---

## Phase 9: Advanced Features (Week 10+)

**Goal**: Competitive advantages

### 9.1 RAG (Retrieval-Augmented Generation)

- [ ] Implement vector embeddings (OpenAI or local)
- [ ] Store embeddings in Postgres (pgvector) or Pinecone
- [ ] Semantic search over knowledge base
- [ ] Inject relevant context before LLM call

### 9.2 Analytics Dashboard

- [ ] Conversation metrics (count, avg length, satisfaction)
- [ ] Tool usage statistics
- [ ] Response time tracking
- [ ] Customer satisfaction scoring (analyze sentiment)

### 9.3 Escalation to Human

- [ ] Detect when AI is stuck
- [ ] Trigger "talk to human" option
- [ ] Send notification to client
- [ ] Handoff conversation transcript

### 9.4 Multi-Channel Support

- [ ] WhatsApp integration (via n8n)
- [ ] Facebook Messenger
- [ ] Email support
- [ ] SMS via Twilio

**Deliverable**: Enterprise-grade features

---

## Phase 10: Deployment & DevOps (Ongoing)

**Goal**: Production-ready infrastructure

### 10.1 Backend Deployment

- [ ] Dockerize backend app
- [ ] Deploy to Railway/Render/DigitalOcean
- [ ] Set up environment variables
- [ ] Configure SSL/HTTPS

### 10.2 Database Hosting

- [ ] Deploy Postgres (Supabase or managed DB)
- [ ] Set up backups
- [ ] Connection pooling

### 10.3 Redis Hosting

- [ ] Deploy Redis (Upstash or Redis Cloud)

### 10.4 n8n Hosting

- [ ] Deploy n8n on separate VM (Contabo/Hetzner)
- [ ] Secure with authentication
- [ ] Set up webhook endpoints with proper URLs

### 10.5 Widget CDN

- [ ] Host widget on Cloudflare/Vercel edge
- [ ] Enable caching
- [ ] Global CDN distribution

### 10.6 Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Add logging (Winston)
- [ ] Uptime monitoring
- [ ] Alert system for failures

**Deliverable**: Scalable production deployment

---

## Success Metrics (MVP Launch)

**After Phase 6 (Week 7), you should have:**

- ✅ 1-3 pilot clients using the widget
- ✅ AI handling customer queries (English only for MVP)
- ✅ At least 3 working tools (order status, booking, inventory)
- ✅ Admin dashboard to manage clients
- ✅ Widget embedded on test websites
- ✅ Token tracking and billing system working
- ✅ Both Ollama (dev) and ChatGPT (prod) integrations ready

**At this point, you can start onboarding real paying customers!**

_Note: Hebrew support (Phase 8) and advanced features (Phase 9) can be added after getting first customers._

---

## Recommended Development Order

**Start with: Phase 1 → 2 → 3 → 4**

- This gives you a working backend API with AI + tools

**Then: Phase 5**

- Build the widget to actually use the API

**Then: Phase 6**

- Admin dashboard to manage it all

**Finally: Phases 7-10**

- Production readiness and advanced features

---

## Tech Stack Summary (from README + current setup)

| Component      | Technology                     | Status                           |
| -------------- | ------------------------------ | -------------------------------- |
| Backend        | Node.js + Express              | ✅ Setup                         |
| Database       | PostgreSQL                     | ✅ Running                       |
| Cache          | Redis                          | ✅ Running                       |
| Workflows      | n8n                            | ✅ Running                       |
| AI (dev)       | Ollama (localhost:11434)       | ✅ Available                     |
| AI (prod)      | OpenAI GPT-4o                  | ⏳ Phase 2 (with token tracking) |
| AI (optional)  | Claude 3.5 Sonnet              | ⏳ Phase 7 (post-MVP)            |
| Token Counting | tiktoken library               | ⏳ Phase 2                       |
| Widget         | Vanilla JS                     | ⏳ Phase 5                       |
| Admin          | React (optional) or plain HTML | ⏳ Phase 6                       |
| Deployment     | Railway/Vercel + Contabo       | ⏳ Phase 10                      |
| Vector DB      | Pinecone/pgvector              | ⏳ Phase 9 (optional)            |
| Language       | English (MVP)                  | ⏳ Phase 1-6                     |
| Hebrew Support | Hebrew + RTL                   | ⏳ Phase 8 (post-MVP)            |

---

## Next Immediate Steps

**Start NOW with Phase 1:**

1. Design database schema (30 min)
2. Write migration SQL files (1 hour)
3. Run migrations (10 min)
4. Create model classes (2 hours)

**Total time to working database: ~4 hours**

Once Phase 1 is done, you'll have the foundation to build everything else on top.

Would you like me to start implementing Phase 1 right now?
