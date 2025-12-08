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

## Phase 3: Tool Execution System ✅ COMPLETE

**Goal**: Enable AI to perform real actions via n8n

### 3.1 Tool Manager ✅

- [x] Create `backend/src/services/toolManager.js`
- [x] Implement tool registration system
  - Parse tool definitions from database
  - Convert to LLM function calling format (Claude/OpenAI native, Ollama prompt engineering)
  - Validate tool schemas
- [x] Dynamic tool loading per client
- [x] Parse tool calls from LLM responses
- [x] Format tool results for AI consumption

### 3.2 n8n Integration Service ✅

- [x] Complete `backend/src/services/n8nService.js`
- [x] Implement webhook caller
  - POST to n8n webhook URLs
  - Pass parameters from AI tool calls
  - Handle responses and errors
  - Timeout handling (default 30s, configurable)
- [x] Response formatter (convert n8n output to AI-readable format)
- [x] Retry logic with exponential backoff
- [x] Batch execution (parallel tool calls)
- [x] Health check for n8n service

### 3.3 Tool Execution Flow ✅

- [x] Implement tool call detection from LLM response (native and parsed)
- [x] Execute tool via n8n webhook
- [x] Wait for result with timeout handling
- [x] Feed result back to LLM for final response
- [x] Handle multi-step tool calls (max 3 iterations)
- [x] Error recovery with graceful fallbacks
- [x] **Log all executions** to `tool_executions` table (parameters, response, timing)

### 3.4 Live Data Integration Service

- [ ] Create `backend/src/services/integrationService.js` (OPTIONAL - can be added later)
- [ ] Implement connection testing
- [ ] Implement data fetching from client backends
- [ ] Cache fetched data temporarily in Redis
- [ ] Handle authentication (API keys, OAuth, basic auth)

**Note**: This is optional for MVP. Current implementation uses n8n workflows to connect to external APIs.

### 3.5 Create Demo n8n Workflows ✅

- [x] `get_order_status` workflow - Check order status by order number
- [x] `book_appointment` workflow - Book appointments with validation
- [x] `check_inventory` workflow - Check product stock and availability
- [x] Export workflows to `n8n-workflows/` folder
- [x] Database setup script (`n8n-workflows/setup_tools.sql`)

### 3.6 Chat API Endpoints ✅

- [x] Create `backend/src/routes/chat.js` and `backend/src/controllers/chatController.js`
- [x] `POST /chat/message` - Send message and get AI response with tool execution
- [x] `GET /chat/history/:sessionId` - Retrieve conversation history
- [x] `POST /chat/end` - End a conversation session
- [x] Authentication middleware (`backend/src/middleware/auth.js`)
- [x] Rate limiting integration (60 requests/minute per client)

**Deliverable**: ✅ AI can execute real actions via n8n workflows with full end-to-end tool execution flow

**Test Results**:
- ✅ Tool Manager operational (load, format, validate)
- ✅ n8n Service working (health check, webhook execution, retry logic)
- ✅ Full tool execution flow tested
- ✅ Tool execution logging verified
- ✅ Chat API endpoints functional with authentication
- ✅ All Phase 3 integration tests passing

---

## Phase 4: Chat Widget & Frontend (Week 4-5)

**Goal**: Build embeddable chat widget to use the API

**Note**: Chat API is already complete from Phase 3. This phase focuses on the user-facing widget.

### 4.1 Widget Core

- [ ] Create `frontend/widget/` directory structure
- [ ] Build minimal chat UI (HTML + CSS + Vanilla JS)
  - Chat bubble button (bottom right of page)
  - Chat window (open/close with animation)
  - Message list with auto-scroll
  - Input field + send button
  - Typing indicator ("AI is thinking...")
  - Error states and retry button
- [ ] Responsive design (mobile + desktop)

### 4.2 Widget API Client

- [ ] Implement fetch wrapper for backend API
- [ ] Session management (store session_id in localStorage)
- [ ] Message sending and receiving
- [ ] Error handling with user-friendly messages
- [ ] Retry logic for failed requests
- [ ] Connection status indicator
- [ ] Loading states

### 4.3 Customization System

- [ ] Widget configuration via JavaScript
  - `widgetConfig = { apiKey, position, primaryColor, greeting, etc. }`
- [ ] Apply custom branding
  - Colors, fonts, logo
  - Widget position (bottom-right, bottom-left, etc.)
- [ ] Support light/dark themes
- [ ] Custom greeting messages

### 4.4 Widget Build System

- [ ] Set up build tool (Vite or esbuild for fast builds)
- [ ] Create single JS bundle (`widget.js`)
- [ ] CSS bundling with minimal footprint
- [ ] Minification and tree-shaking
- [ ] Source maps for debugging
- [ ] Version hash for cache busting

### 4.5 Embedding & Distribution

- [ ] Create simple embed code:
  ```html
  <script src="https://yourdomain.com/widget.js"
          data-api-key="YOUR_API_KEY"
          data-position="bottom-right"></script>
  ```
- [ ] Host widget on static file server or CDN
- [ ] Test embedding on:
  - Plain HTML page
  - WordPress (via Custom HTML block)
  - Wix (via HTML embed)
  - Shopify (via theme customization)
- [ ] Create demo page showcasing the widget

### 4.6 Additional API Endpoints (Optional)

- [ ] **GET /api/config** - Widget configuration for client
  - Return: branding, greeting message, available features
- [ ] **POST /api/feedback** - User feedback submission
- [ ] **GET /api/health** - Public health check endpoint
- [ ] Add streaming support to chat endpoint (Server-Sent Events)

**Deliverable**: Working embeddable chat widget that connects to the backend API and can be added to any website with a simple script tag

**Success Criteria**:
- Widget loads in under 2 seconds
- Works on all major browsers (Chrome, Firefox, Safari, Edge)
- Mobile-responsive
- Can be embedded without conflicts with existing site CSS/JS
- Persists conversation across page reloads (via localStorage)
- Visual feedback for all user actions

---

## Phase 5: Admin Dashboard (Week 6-7)

**Goal**: Interface for you to manage clients and configure AI

### 5.1 Authentication

- [ ] Admin login system (simple username/password to start)
- [ ] JWT-based session management
- [ ] Protected routes

### 5.2 Client Management

- [ ] **Clients List Page**
  - View all clients
  - Add new client (generate API key)
  - Edit client details
  - Deactivate client

### 5.3 Tool Configuration Interface

- [ ] **Tools Page** (per client)
  - List all tools for a client
  - Add new tool (name, description, n8n webhook URL)
  - Edit tool parameters schema
  - Enable/disable tools
  - Test tool execution (manual trigger)

### 5.4 Integration Manager (CHANGED from Knowledge Base)

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

### 5.5 Conversation Monitor

- [ ] **Conversations Page**
  - View all conversations (filterable by client)
  - Read conversation transcripts
  - See tool calls made
  - Export conversations as CSV/JSON

### 5.6 Testing Interface

- [ ] **Test Chat Page**
  - Test AI as if you're a customer
  - Select client to test
  - See full tool call logs
  - Debug mode (show raw LLM responses)

**Deliverable**: Full admin dashboard to manage everything

---

## Phase 6: LLM Optimization & Provider Options (Week 8 - POST-MVP)

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

## Phase 7: Hebrew Support (POST-MVP - Add After Launch)

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

## Phase 8: Advanced Features (Week 10+)

**Goal**: Competitive advantages

### 8.1 RAG (Retrieval-Augmented Generation)

- [ ] Implement vector embeddings (OpenAI or local)
- [ ] Store embeddings in Postgres (pgvector) or Pinecone
- [ ] Semantic search over knowledge base
- [ ] Inject relevant context before LLM call

### 8.2 Analytics Dashboard

- [ ] Conversation metrics (count, avg length, satisfaction)
- [ ] Tool usage statistics
- [ ] Response time tracking
- [ ] Customer satisfaction scoring (analyze sentiment)

### 8.3 Escalation to Human

- [ ] Detect when AI is stuck
- [ ] Trigger "talk to human" option
- [ ] Send notification to client
- [ ] Handoff conversation transcript

### 8.4 Multi-Channel Support

- [ ] WhatsApp integration (via n8n)
- [ ] Facebook Messenger
- [ ] Email support
- [ ] SMS via Twilio

**Deliverable**: Enterprise-grade features

---

## Phase 9: Deployment & DevOps (Ongoing)

**Goal**: Production-ready infrastructure

### 9.1 Backend Deployment

- [ ] Dockerize backend app
- [ ] Deploy to Railway/Render/DigitalOcean
- [ ] Set up environment variables
- [ ] Configure SSL/HTTPS

### 9.2 Database Hosting

- [ ] Deploy Postgres (Supabase or managed DB)
- [ ] Set up backups
- [ ] Connection pooling

### 9.3 Redis Hosting

- [ ] Deploy Redis (Upstash or Redis Cloud)

### 9.4 n8n Hosting

- [ ] Deploy n8n on separate VM (Contabo/Hetzner)
- [ ] Secure with authentication
- [ ] Set up webhook endpoints with proper URLs

### 9.5 Widget CDN

- [ ] Host widget on Cloudflare/Vercel edge
- [ ] Enable caching
- [ ] Global CDN distribution

### 9.6 Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Add logging (Winston)
- [ ] Uptime monitoring
- [ ] Alert system for failures

**Deliverable**: Scalable production deployment

---

## Success Metrics (MVP Launch)

**Current Status (After Phase 3):**

- ✅ Backend API with chat endpoint
- ✅ AI handling customer queries (English only)
- ✅ Tool execution system working (n8n integration)
- ✅ At least 3 demo tools (order status, booking, inventory)
- ✅ Token tracking and usage logging
- ✅ Multi-provider LLM support (Ollama for dev, Claude for prod)
- ⏳ Widget not yet built (Phase 4)
- ⏳ Admin dashboard not yet built (Phase 5)

**After Phase 5 (estimated week 7), you should have:**

- ✅ Embeddable chat widget
- ✅ Admin dashboard to manage clients
- ✅ 1-3 pilot clients ready to test
- ✅ Widget embedded on test websites

**At that point, you can start onboarding real paying customers!**

_Note: Hebrew support (Phase 7), advanced features (Phase 8), and production deployment (Phase 9) can be added after getting first customers._

---

## Recommended Development Order

**✅ Completed: Phases 1 → 2 → 3**

- Working backend API with AI + tool execution
- Database, models, and all core services operational
- Demo n8n workflows created and tested

**➡️ Next: Phase 4 (Chat Widget)**

- Build embeddable widget to use the API
- Makes the platform usable by end customers

**Then: Phase 5 (Admin Dashboard)**

- Admin interface to manage clients and tools
- Essential for onboarding multiple clients

**Optional: Phases 6-9**

- Phase 6: LLM optimization and provider options
- Phase 7: Hebrew/RTL support
- Phase 8: Advanced features (RAG, analytics, escalation)
- Phase 9: Production deployment and DevOps

---

## Tech Stack Summary (from README + current setup)

| Component          | Technology                     | Status                |
| ------------------ | ------------------------------ | --------------------- |
| Backend            | Node.js + Express              | ✅ Phase 1-3          |
| Database           | PostgreSQL                     | ✅ Phase 1            |
| Cache              | Redis                          | ✅ Phase 1            |
| Workflows          | n8n                            | ✅ Phase 3            |
| AI (dev)           | Ollama (localhost:11434)       | ✅ Phase 2            |
| AI (prod)          | Claude 3.5 Sonnet              | ✅ Phase 2            |
| AI (optional)      | OpenAI GPT-4o                  | ⏳ Placeholder only   |
| Token Tracking     | Built-in                       | ✅ Phase 2            |
| Tool Execution     | n8n webhooks                   | ✅ Phase 3            |
| Chat API           | REST with auth                 | ✅ Phase 3            |
| Widget             | Vanilla JS                     | ⏳ Phase 4            |
| Admin              | React or plain HTML            | ⏳ Phase 5            |
| Deployment         | Railway/Vercel + Contabo       | ⏳ Phase 9            |
| Vector DB (RAG)    | Pinecone/pgvector              | ⏳ Phase 8 (optional) |
| Language           | English (MVP)                  | ✅ Phases 1-3         |
| Hebrew Support     | Hebrew + RTL                   | ⏳ Phase 7 (post-MVP) |

---

## Next Immediate Steps

**Phase 4: Chat Widget (Recommended Next)**

The backend is complete and fully functional. The logical next step is to build the chat widget so end-users can interact with the AI.

**Phase 4 Implementation Steps:**

1. Set up frontend directory structure and build tool (Vite/esbuild) - 1 hour
2. Create minimal chat UI (bubble, window, messages) - 3-4 hours
3. Implement API client and session management - 2 hours
4. Add customization system (colors, branding) - 2 hours
5. Build and test embedding on different platforms - 2 hours
6. Create demo page - 1 hour

**Estimated time: 11-12 hours of work**

**Alternative: Phase 5 (Admin Dashboard)**

If you want to manage clients and tools through a UI first, you can start with the admin dashboard instead. This would allow you to:
- Manage multiple clients
- Add/edit/test tools through a web interface
- Monitor conversations and tool usage

**Which would you prefer to tackle first: Widget (for end-users) or Admin Dashboard (for client management)?**
