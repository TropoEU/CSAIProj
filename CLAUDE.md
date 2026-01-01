# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered customer service agent platform for business websites. It provides a plug-and-play widget that can be embedded in any website (Wix, Shopify, WordPress, custom HTML) to handle customer queries, execute actions, and integrate with business systems through n8n workflows.

The architecture follows a clean separation:

- **Backend API**: Node.js/Express server that handles AI orchestration and tool execution
- **n8n Integration**: Workflow automation that connects to external systems (Shopify, CRMs, Gmail, etc.)
- **Widget** (✅ Phase 4): Embeddable chat interface for client websites (Vanilla JS + Vite + Shadow DOM)
- **Docker Stack**: Postgres, Redis, and n8n running in containers

## Common Development Commands

### Running the Application

```powershell
# Start Docker services (Postgres, Redis, n8n)
npm run dockerup

# Stop Docker services (preserves data)
npm run dockerdown

# Stop and remove Docker containers (deletes all data!)
npm run dockerclean

# Start the backend server
npm start
```

**IMPORTANT**: All commands run in Windows PowerShell, NOT in WSL. Docker runs in WSL2 backend but is accessed via localhost from PowerShell.

### Database Migrations

```powershell
# Apply all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback the last migration
npm run migrate:down
```

Migration files are located in `db/migrations/` and use a custom migration system (see `backend/src/scripts/migrate.js`). Each migration file has `-- UP` and `-- DOWN` sections.

### Testing

```powershell
# Check all service connections
npm run check:connections

# Check Ollama connectivity
npm run check:ollama

# Run LLM service tests
npm run test:llm

# Run Phase 2 full integration test (conversation flow)
npm run test:phase2

# Run Phase 3 full integration test (tool execution)
npm run test:phase3

# Run model tests
npm run test:models

# Run Redis cache service tests
npm run test:redis
```

## Architecture & Key Concepts

### AI-Powered Tool Execution Flow

1. **Widget** → User sends message to backend API
2. **Backend** → Processes message with LLM (OpenAI/Claude/Ollama)
3. **LLM** → Determines intent and calls appropriate tool
4. **Tool Execution** → Backend triggers n8n webhook
5. **n8n Workflow** → Executes business logic (check order, book appointment, etc.)
6. **Response** → Result flows back through the chain to user

This architecture allows each client to have customized workflows without writing custom code for each integration.

### Database Schema

The system uses 15 core tables:

**Multi-Tenant Structure:**

- `clients`: Business clients using the platform (identified by API key, includes `widget_config` JSONB for customization, `business_info` JSONB for business details, `escalation_config` JSONB for escalation settings)
- `client_tools`: Which tools each client has enabled (includes `integration_mapping` for many-to-many relationships)
- `client_integrations`: External system connections per client
  - Includes `api_schema` JSONB: captured API structure from testing
  - Includes `test_config` JSONB: test configuration for validation
  - Includes `last_test_result` JSONB: comprehensive test results with schema capture
  - Includes `status`: not_configured, active, inactive, error
- `integration_endpoints`: n8n webhook URLs for each client's integrations

**Conversation Tracking:**

- `conversations`: Chat sessions between end-users and the AI
  - Includes `channel` (widget, email, whatsapp), `channel_thread_id`, `channel_metadata` JSONB
- `messages`: Individual messages in conversations
  - Includes `external_message_id` (Gmail message ID, etc.), `channel_metadata` JSONB

**Email Channels:**

- `email_channels`: Gmail/email integration configurations per client
  - Includes `connection_config` JSONB (OAuth tokens), `settings` JSONB (signature, auto_reply)
  - Includes `status` (active, inactive, error, authenticating)
  - Includes `last_checked_at` timestamp for monitoring

**Tool System:**

- `tools`: Master catalog of available tools (e.g., "get_order_status", "book_appointment")
  - Tools define `required_integrations` JSONB array (many-to-many relationship)
  - Format: `[{"key": "order_api", "name": "Order API", "required": true, "description": "..."}]`
  - Each tool can require multiple integrations simultaneously
- `client_tools`: Junction table linking clients to enabled tools
  - Includes `integration_mapping` JSONB: maps integration keys to client_integration IDs
  - Format: `{"order_api": 5, "email_api": 8}` where values are `client_integrations.id`
- `tool_executions`: Audit log of all tool calls
- `api_usage`: Track LLM API consumption per client (conversation_count uses UPSERT with proper boolean-to-int conversion)

**Admin & Billing:**

- `admins`: Admin user accounts for dashboard access
- `invoices`: Billing invoices with payment tracking
- `plans`: Plan configurations with limits, features, and pricing (database-driven)

**Escalation System:**

- `escalations`: Human escalation tracking (status: pending, acknowledged, resolved, cancelled)
  - Includes `reason` (user_requested, ai_stuck, low_confidence, explicit_trigger)
  - Includes `escalated_at`, `acknowledged_at`, `resolved_at` timestamps
  - Foreign keys to `conversations`, `clients`, and optional `trigger_message_id`

All models use a static class pattern (see `backend/src/models/Client.js` as reference). Models directly interact with the database via `db.query()`.

### Configuration & Environment Detection

The system intelligently handles both local and Docker environments:

**Local Development:**

- Backend runs on host machine
- Connects to Docker services via `localhost:5432` (Postgres) and `localhost:6379` (Redis)

**Docker Deployment:**

- All services run inside Docker network
- Backend uses service names (`postgres`, `redis`) for internal networking

This is handled automatically by `backend/src/config.js` which detects the runtime environment.

### Redis Caching & Schema Design

Redis implements four critical functions for the platform:

**1. Active Conversation Context** (`conversation:{sessionId}` - TTL: 1 hour)

- Caches recent messages for fast retrieval during active conversations
- Automatically includes `last_activity` timestamp
- Use `RedisCache.setConversationContext()`, `getConversationContext()`, `updateConversationContext()`
- TTL extends on each update to keep active conversations cached

**2. Rate Limiting** (`rate_limit:{clientId}:{minute}` - TTL: 60 seconds)

- Per-client, per-minute request counting
- Uses Unix timestamp-based minute buckets for efficiency
- `RedisCache.checkRateLimit(clientId, maxRequests)` - returns `{allowed, remaining, resetIn}`
- Fails open (allows requests) if Redis is down
- Default: 60 requests/minute per client

**3. Response Caching** (`cache:{hash}` or `cache:{clientId}:{hash}` - TTL: 5 minutes)

- Cache identical questions to save LLM API costs
- Use `RedisCache.hashQuery(query, clientId)` to generate consistent hashes
- `RedisCache.cacheResponse(hash, response, clientId, ttl)` - stores response
- `RedisCache.getCachedResponse(hash, clientId)` - retrieves cached response
- Supports both global caching (all clients) and client-specific caching

**4. Session Locks** (`lock:conversation:{sessionId}` - TTL: 30 seconds)

- Prevents duplicate message processing from concurrent requests
- `RedisCache.acquireLock(sessionId)` - returns true if lock acquired
- `RedisCache.releaseLock(sessionId)` - releases lock
- `RedisCache.extendLock(sessionId, seconds)` - extends TTL for long operations
- Uses Redis SET with NX (only set if not exists) for atomic operations

**Important Implementation Notes:**

- All methods include error handling and fail gracefully
- `clearClientCache()` uses SCAN (not KEYS) to avoid blocking Redis in production
- Rate limiting uses simple Unix timestamp division for timezone-safe minute buckets
- The service is located in `backend/src/services/redisCache.js`

### Phase 2: AI Engine Core (✅ COMPLETE)

The AI conversation engine is fully implemented and operational:

**LLM Service** (`backend/src/services/llmService.js`):

- Multi-provider architecture (Ollama for dev, Claude/OpenAI for prod)
- Automatic environment detection and configuration
- Token counting and cost tracking
- Streaming support (prepared)
- Tool/function calling (Claude/OpenAI only - Ollama uses prompt engineering)
- Error handling with retry logic

**Conversation Service** (`backend/src/services/conversationService.js`):

- Conversation and message management
- Context window management (20 messages max)
- Redis caching integration
- Automatic token tracking and statistics
- Session management

**System Prompts** (`backend/src/prompts/systemPrompt.js`):

- **Database-driven configuration**: Prompts stored in `platform_config` table, editable via admin UI
- **Guided reasoning approach**: Configurable multi-step reasoning process
- **Language-agnostic prompts**: Single English prompt with dynamic language instruction
- **Multi-language support**: English, Hebrew, Spanish, French, German, Arabic, Russian
- **Per-client customization**: Clients can override platform defaults via `prompt_config` JSONB column
- **Admin UI**: Settings → AI Behavior tab for editing reasoning steps, tool rules, response style

**Prompt Service** (`backend/src/services/promptService.js`):

- Caches prompt configuration for performance
- Merges client-specific overrides with platform defaults
- Initialized at server startup

**Current LLM Provider**: Ollama (localhost:11434) with `Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf` model

- For local development and testing
- Changed from dolphin-llama3 for better tool calling capabilities
- No API costs
- Function calling handled via prompt engineering (not native API)
- Optimized settings: temperature 0.3, max_tokens 2048
- Token counting handles cached prompts correctly (when `prompt_eval_count` is 0, prompt was cached)

### Phase 3: Tool Execution System (✅ COMPLETE)

The tool execution system is fully operational and enables the AI to perform real actions:

**Tool Manager** (`backend/src/services/toolManager.js`):

- Dynamic tool loading per client from database
- Format tools for LLM consumption (native function calling for Claude, prompt engineering for Ollama)
- Tool schema validation
- Parse tool calls from LLM responses
- Format tool results for AI consumption

**n8n Integration Service** (`backend/src/services/n8nService.js`):

- Execute tools via n8n webhooks with timeout handling (30s default)
- Automatic retry logic with exponential backoff
- Batch execution (parallel tool calls)
- Response formatting for LLM
- Health checks and webhook connectivity testing
- **Integration support**: Automatically passes client integration credentials to n8n via `_integrations` object (plural)

**Integration Service** (`backend/src/services/integrationService.js`):

- Fetches client integration credentials based on tool's integration requirements
- Supports many-to-many tool-integration relationships via `integration_mapping`
- Formats integration config for n8n consumption
- Supports multiple auth methods (bearer, api_key, basic, custom)
- Enables reusable n8n workflows across all clients

**Chat API** (`backend/src/routes/chat.js`, `backend/src/controllers/chatController.js`):

- `POST /chat/message` - Send message and get AI response with tool execution
- `GET /chat/history/:sessionId` - Retrieve conversation history
- `POST /chat/end` - End a conversation session
- API key authentication via Bearer token
- Rate limiting (60 requests/minute per client)

**Demo n8n Workflows** (`n8n-workflows/`):

- `get_order_status` - Check order status by order number
- `book_appointment` - Book appointments with validation
- `check_inventory` - Check product availability and stock levels

**Mock API for Testing** (`backend/src/routes/mockApi.js`):

- Simulates Bob's Pizza Shop backend for demo/testing purposes
- Endpoints: inventory check, order status, table booking
- Date normalization: converts "today", "tomorrow", "yesterday" to `YYYY-MM-DD`
- Auto-corrects dates more than 1 year in the past to today's date

**Tool Execution Flow** (with Integration Support):

1. User message → Chat API
2. Load client's enabled tools
3. Call LLM with tools available
4. Detect tool calls in response
5. **If tool has `required_integrations`**: Fetch client's matching integration credentials via `integration_mapping`
6. Execute tools via n8n webhooks (with `_integrations` object containing mapped credentials)
7. n8n workflow uses integration credentials to call client's API dynamically
8. Log executions to `tool_executions` table
9. Feed results back to LLM
10. Return final AI response with tool data

**Integration-Tool Architecture** (Many-to-Many):
- **Generic Tools** define `required_integrations` - what TYPES of integrations they need (e.g., "order_api", "email_api")
- **Client Integrations** define `integration_type` - a category matching tool requirements
- **Client Tools** define `integration_mapping` - maps tool's required keys to specific client integration IDs
- This architecture allows ONE generic tool to work with different client APIs
- See `docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md` for comprehensive documentation with examples

### Phase 4: Chat Widget (✅ COMPLETE)

The embeddable chat widget is fully implemented and operational:

**Widget Core** (`frontend/widget/`):

- Vanilla JavaScript (no framework) with Vite build system
- Shadow DOM for complete CSS/JS isolation from host pages
- Auto-initialization from script tag with data attributes
- Mobile responsive (full-screen on mobile, windowed on desktop)
- Conversation persistence via localStorage
- Bundle size: ~85KB (uncompressed)

**Widget Components**:

- `src/widget.js` - Main widget class with Shadow DOM
- `src/api.js` - API client for backend communication
- `src/storage.js` - localStorage wrapper for persistence
- `src/components/bubble.js` - Floating chat button with unread counter
- `src/components/window.js` - Chat window with header, messages, input
- `src/components/messages.js` - Message list with typing indicator
- `src/components/input.js` - Auto-resizing textarea with send button
- `src/styles.css` - Complete styling with CSS variables for theming

**Critical Bug Fixes**:

- Fixed CORS issue (added cors middleware to backend)
- Fixed context pollution bug in `conversationService.js:289` (tool descriptions were being appended on every loop iteration)
- Switched to Hermes-2-Pro-Mistral-7B for better tool calling
- Optimized temperature (0.3) and max_tokens (2048) for stability
- Fixed input focus loss after sending messages (December 12, 2025)
- Fixed dev mode loading stale build instead of live source (December 12, 2025)

**Development Mode Notes**:

- **IMPORTANT**: Never put `widget.js` in `public/` folder - it will override live source code
- `demo.html` loads from `/src/index.js` as ES module in dev mode
- `public/widget.js*` is in `.gitignore` to prevent build artifacts from being committed
- Run `npm run dev` in `frontend/widget/` for hot reloading during development

**Integration Code**:

```html
<script
  src="http://localhost:3001/widget.js"
  data-api-key="YOUR_API_KEY"
  data-position="bottom-right"
  data-primary-color="#667eea"
></script>
```

**Test Results**:

- Widget loads in <1 second
- Tool execution working (order status, appointments, inventory)
- Multi-turn conversations stable (10+ exchanges tested)
- No CSS conflicts with host pages (Shadow DOM isolation)

**Widget Customization** (✅ Added December 11, 2025):

The widget supports extensive customization via the admin dashboard:

- **Position**: bottom-right, bottom-left, top-right, top-left
- **14 Color Options**: Primary color, background, header background, body background, footer background, AI bubble color, user bubble color, header text, AI text, user text, input background, input text, button text
- **Text Customization**: Title, subtitle, greeting message
- **Embed Code Generator**: Auto-generates customized script tag with copy-to-clipboard
- **Live Preview**: Preview widget appearance before deploying

Widget configuration is stored in the `clients.widget_config` JSONB column and synced with the widget at runtime.

### What's Not Yet Implemented

**From Phase 1** (Optional - can be added later):

- Data retention/cleanup scripts (`backend/src/scripts/cleanup.js`) - auto-delete old messages/tool executions
- Seed data for testing

**From Phase 2** (Optional):

- OpenAI provider implementation - currently placeholder only (Ollama and Claude work)
- Streaming responses (prepared but not active)

**From Phase 3** (✅ Complete):

- ✅ Integration Service (`backend/src/services/integrationService.js`) - **FULLY IMPLEMENTED**
  - Tools and integrations work together in a complete flow
  - Generic tools specify `required_integrations` (integration types like "order_api")
  - Client integrations define `integration_type` to match tool requirements
  - Client tools use `integration_mapping` to map tool requirements to specific client integrations
  - Integration credentials are passed to n8n workflows via `_integrations` object (plural)
  - Enables one generic n8n workflow per tool type, reusable across all clients
  - See `docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md` for complete documentation

**Advanced tool features** (Optional):
- Tool chaining, conditional execution, result caching

**From Phase 4** (Optional):

- Light/dark theme toggle (currently single theme with CSS variables)
- Version hash for cache busting
- Testing on WordPress/Wix/Shopify (manual testing required)
- Streaming support (prepared but not active)

**Phase 5** (✅ Complete - December 9, 2025):

- Admin Dashboard running on http://localhost:3002
- React 18 + Vite + Tailwind CSS
- JWT authentication with bcrypt password hashing
- Client management (CRUD, API key generation)
  - Clickable table rows for navigation
  - Tabbed interface (Overview/Business Info) for better UX
  - Business information editor with 5 tabs
- Tool configuration per client
- Conversation monitoring with export
- Integration management
- Analytics dashboard with charts
- Test chat interface
- Widget customization UI with embed code generator
- Escalation management with filtering and status updates
- Login credentials: `admin` / `admin123`

**Phase 6** (✅ Complete - December 11, 2025):

- Billing infrastructure with invoice generation
- Usage tracking and analytics per client
- **Database-driven plan management** (`plans` table with full CRUD)
  - Plans stored in database with `name`, `display_name`, limits, features, pricing
  - Admin panel "Plans" page for managing plans
  - Plan dropdowns in client creation/editing fetch from database
  - BillingService uses database pricing for invoice generation
  - PlanLimits config fetches from database with caching (1 minute TTL)
- Plan types: `unlimited` (default), `free`, `starter`, `pro`, `enterprise`
- Plan limits middleware integrated into chat API (logs warnings, doesn't block by default)
- Cost calculator for multiple LLM providers
- Revenue analytics and reporting
- Outstanding payments tracking
- Payment provider abstraction layer (ready for Stripe/PayPal)

**Phase 7** (✅ Complete - December 15, 2025):

- Customer Dashboard running on http://localhost:3003
- React 18 + Vite + Tailwind CSS (purple theme)
- JWT authentication with access code login
- Dashboard pages: Overview, Conversations, Conversation Detail, Billing, Usage
- 60-day conversation history with search and filters
- Live updates (auto-refresh every 30 seconds with visual indicator)
- Invoice PDF generation and download (client-side with @react-pdf/renderer)
- Usage progress bars and trend visualization
- Mobile-responsive design with sidebar navigation
- Read-only access (no settings changes in MVP)
- Test login: Access code `GAV091`

**Phase 8** (✅ Complete - December 16, 2025):

- Hebrew/RTL Support for Israeli market
- **Database**: `language` column on `clients` table (VARCHAR, default 'en')
- **Widget i18n** (`frontend/widget/src/i18n/translations.js`):
  - Full Hebrew/English translations
  - RTL CSS (header reversed, user messages left, AI right)
  - `/chat/config` endpoint returns client language
- **Customer Dashboard i18n** (`frontend/customer/src/i18n/translations.js`):
  - Complete Hebrew translations for all 6 pages
  - LanguageContext for state management
  - Settings page for language selection
  - RTL layout (sidebar on right, flex-direction-reverse)
  - Date/number formatting with Hebrew locale
- **Admin Dashboard**: RTL CSS support for viewing Hebrew content (UI labels remain English)
- **System Prompts** (`backend/src/prompts/systemPrompt.js`):
  - Single English prompt with guided reasoning (4-step process)
  - Dynamic language instruction appended based on `client.language`
  - Supports 7 languages: en, he, es, fr, de, ar, ru
  - Localized messages for greetings, errors, and escalations
- **API Endpoints**:
  - `GET /chat/config` - Returns language setting for widget
  - `GET/PUT /api/customer/settings` - Language preference CRUD

**Phase 9** (✅ Partial Complete - December 17, 2025):

- **Business Information Management** (✅ Complete)
  - `business_info` JSONB column on `clients` table
  - Comprehensive admin UI with 5 tabs (About, Contact, Policies, FAQs, AI Instructions)
  - Auto-integrated with system prompts via `getContextualSystemPrompt()`
  - Character limits to prevent token overuse
  - Tabbed navigation in admin dashboard (Overview/Business Info)
  - Accessible via clickable table rows in Clients page

- **Escalation to Human** (✅ Complete)
  - **Database**: `escalations` table + `escalation_config` on clients
  - **Auto-detection**: AI stuck (repeated clarifications), user request, low confidence
  - **Enhanced trigger phrases**: 23 English + 22 Hebrew phrases for detection
  - **Multi-channel notifications**: Email/WhatsApp/SMS (placeholders ready for Phase 10)
  - **Admin Dashboard**: Full escalation management page with status tracking
  - **No widget button** - Auto-detection only to prevent bypass
  - **Status flow**: Escalations stay "pending" until manually acknowledged
  - Integrated into conversation flow with graceful error handling
  - Bug fixes: Logger, Message.getAll method, status management

- **Gmail Email Integration** (✅ Complete - December 17, 2025)
  - **Database**: `email_channels` table + multi-channel columns on `conversations`/`messages`
  - **Gmail OAuth2 Flow**: Connect Gmail accounts via admin dashboard
  - **Email Monitor Service**: Background job checks inboxes every 60 seconds
  - **AI-Powered Responses**: Automatic email replies using the AI conversation engine
  - **Thread Context**: Maintains email thread context for coherent conversations
  - **Admin Dashboard**: "Email Channels" tab in Client Detail page
    - Connect/disconnect Gmail accounts
    - Test connection, send test emails
    - Configure signature, auto-reply, monitoring settings
  - **Transactional Email Service**: Platform emails for access codes, invoices, notifications
  - **API Endpoints**: `/api/email/*` for OAuth and channel management
  - **Environment Variables**: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`

**Phase 9 Remaining** (Optional):

- RAG (Retrieval-Augmented Generation) - Vector embeddings for knowledge base
- Enhanced Analytics - Conversation satisfaction scoring
- WhatsApp Integration - Critical for Israeli market (architecture complete in `docs/MULTI_CHANNEL_INTEGRATION.md`)

**Phase 10** (Not Started):

- Production deployment and DevOps

## Railway Deployment (Staging)

The staging environment uses Railway for backend services and Cloudflare Pages/Workers for frontends.

### Railway Services

| Service | Internal Domain | Notes |
|---------|-----------------|-------|
| Backend | `backend.railway.internal` | Auto-deploys on push to main |
| PostgreSQL | `postgres.railway.internal` | Managed database |
| Redis | `redis.railway.internal` | Requires REDIS_PASSWORD |
| n8n | `n8n-service.railway.internal` | Workflow automation |

### Required Environment Variables

**Backend Service:**
```
DOCKER_CONTAINER=true
POSTGRES_HOST=${{Postgres.PGHOST}}
POSTGRES_PORT=${{Postgres.PGPORT}}
POSTGRES_DB=${{Postgres.PGDATABASE}}
POSTGRES_USER=${{Postgres.PGUSER}}
POSTGRES_PASSWORD=${{Postgres.PGPASSWORD}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
N8N_HOST=${{n8n-service.RAILWAY_PRIVATE_DOMAIN}}
N8N_PORT=5678
JWT_SECRET=<your-secret>
LLM_PROVIDER=groq
GROQ_API_KEY=<your-key>
GROQ_MODEL=llama-3.3-70b-versatile
CORS_ALLOWED_ORIGINS=https://your-admin.workers.dev,https://your-customer.workers.dev,https://your-widget.workers.dev
```

**n8n Service (CRITICAL):**
```
WEBHOOK_URL=http://${{n8n-service.RAILWAY_PRIVATE_DOMAIN}}:5678
```
Without this, n8n webhook URLs will show as localhost and workflows won't work.

### Cloudflare Pages Environment Variables

**Admin Dashboard:**
```
VITE_API_URL=https://your-backend.up.railway.app
VITE_WIDGET_URL=https://your-widget.workers.dev/widget.js
```

**Customer Dashboard:**
```
VITE_API_URL=https://your-backend.up.railway.app
```

### Webhook URLs for Tools

When configuring client tools in staging, use internal Railway URLs:
```
http://n8n-service.railway.internal:5678/webhook/book_appointment
http://n8n-service.railway.internal:5678/webhook/get_order_status
http://n8n-service.railway.internal:5678/webhook/check_inventory
```

**🚀 Upcoming Planned Features** (Priority for next development cycle):

1. **Production Deployment** - Deploy all components to hosting platforms with SSL
2. **WhatsApp Integration** - Critical for Israeli market (architecture complete)
3. **RAG Implementation** - Knowledge base integration with vector embeddings
4. **Platform Email Configuration** - Configure platform's own Gmail for transactional emails

## Important Implementation Patterns

### Adding a New Tool

The system now supports **many-to-many relationships** between tools and integrations:

1. **Create n8n workflow** with webhook trigger (`http://localhost:5678/webhook/<tool_name>`)
   - Workflow receives `{{ $json._integrations }}` object (plural) with multiple integrations
   - Example: `{{ $json._integrations.order_api.apiUrl }}`, `{{ $json._integrations.email_api.apiKey }}`

2. **Add tool to catalog** with `required_integrations` array:
```sql
INSERT INTO tools (tool_name, description, parameters_schema, required_integrations) VALUES (
  'send_order_confirmation',
  'Send order confirmation email to customer',
  '{"type": "object", "properties": {"orderId": {"type": "string"}}, "required": ["orderId"]}',
  '[
    {"key": "order_api", "name": "Order API", "required": true, "description": "Fetches order details"},
    {"key": "email_api", "name": "Email Service", "required": true, "description": "Sends emails"}
  ]'::jsonb
);
```

3. **Add client integrations** (one for each integration type the client will use):
```sql
-- Order API integration
INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status) VALUES (
  1,
  'order_api',
  'Client''s Order System',
  '{"apiUrl": "https://api.client.com/orders", "apiKey": "key123", "authMethod": "bearer"}'::jsonb,
  'active'
);

-- Email API integration
INSERT INTO client_integrations (client_id, integration_type, name, connection_config, status) VALUES (
  1,
  'email_api',
  'Client''s SendGrid',
  '{"apiUrl": "https://api.sendgrid.com", "apiKey": "sg-key", "authMethod": "bearer"}'::jsonb,
  'active'
);
```

4. **Enable tool for client with integration mapping**:
```sql
INSERT INTO client_tools (client_id, tool_id, enabled, n8n_webhook_url, integration_mapping) VALUES (
  1,
  (SELECT id FROM tools WHERE tool_name = 'send_order_confirmation'),
  true,
  'http://localhost:5678/webhook/send_order_confirmation',
  '{"order_api": 5, "email_api": 8}'::jsonb  -- Maps keys to client_integrations.id
);
```

**When tool executes:**
- Backend fetches all mapped integrations
- n8n receives: `_integrations: { "order_api": {...}, "email_api": {...} }`
- Workflow can use multiple APIs in one execution

**See**: `docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md` for architecture details

### Adding a New Model

Follow the pattern established in `backend/src/models/Client.js`:

- Use static methods for all operations
- Use parameterized queries to prevent SQL injection
- Return `result.rows[0]` for single records, `result.rows` for collections
- Include timestamps (`created_at`, `updated_at`)
- Provide both soft delete (status change) and hard delete methods where appropriate

### Database Migrations

Create migration files in `db/migrations/` with timestamp prefix format: `YYYYMMDDHHMMSS_description.sql`

Structure:

```sql
-- UP
CREATE TABLE ...;
CREATE INDEX ...;

-- DOWN
-- DROP INDEX ...;
-- DROP TABLE ...;
```

The DOWN section should be commented out to prevent accidental execution.

## Docker Services

**Postgres** (`localhost:5432`):

- Database for all application data
- Health checks enabled
- **Important**: Application tables are in the `public` schema, n8n tables are in the `n8n` schema

**Redis** (`localhost:6379`):

- Caching and session management
- Health checks enabled

**n8n** (`localhost:5678`):

- Workflow automation engine
- Stores workflows in Postgres using the `n8n` schema (isolated from application tables)
- Exposes webhooks for tool execution
- Default auth credentials in `.env`
- **Schema Isolation**: n8n uses `DB_POSTGRESDB_SCHEMA: n8n` to avoid table name conflicts

## Project Structure

```
CSAIProj/
├── backend/
│   ├── src/
│   │   ├── index.js           # Express server entry point
│   │   ├── config.js          # Environment detection & config
│   │   ├── db.js              # Postgres connection pool
│   │   ├── redis.js           # Redis client
│   │   ├── models/            # Database models (14 tables: Client, Admin, Invoice, Plan, Escalation, etc.)
│   │   ├── routes/            # API route definitions (chat, tools, admin)
│   │   ├── controllers/       # Route handlers
│   │   ├── services/          # Business logic (n8n, cache, llm, billing, usage, escalation)
│   │   ├── prompts/           # System prompt templates
│   │   ├── middleware/        # Auth, rate limiting, admin auth
│   │   ├── utils/             # Validation and helpers
│   │   └── scripts/           # Migration runner
│   ├── tests/                 # Integration tests
│   └── package.json           # Backend dependencies
├── frontend/
│   ├── widget/                # Embeddable chat widget (Phase 4)
│   │   ├── src/
│   │   │   ├── index.js       # Entry point with auto-init
│   │   │   ├── widget.js      # Main widget class (Shadow DOM)
│   │   │   ├── api.js         # API client
│   │   │   ├── storage.js     # localStorage wrapper
│   │   │   ├── styles.css     # Complete styling
│   │   │   └── components/    # UI components
│   │   ├── public/
│   │   │   └── demo.html      # Demo page
│   │   ├── vite.config.js     # Build configuration
│   │   └── package.json       # Widget dependencies
│   ├── admin/                 # Admin Dashboard (Phase 5)
│   │   ├── src/
│   │   │   ├── main.jsx       # React entry point
│   │   │   ├── App.jsx        # Protected routes setup
│   │   │   ├── context/       # Auth context
│   │   │   ├── services/      # API client
│   │   │   ├── pages/         # 14 Dashboard pages:
│   │   │   │   │              #   Login, Dashboard, Clients, ClientDetail, BusinessInfo,
│   │   │   │   │              #   Tools, Conversations, ConversationDetail,
│   │   │   │   │              #   Integrations, TestChat, Billing, UsageReports, Plans, Escalations
│   │   │   ├── components/    # Reusable UI components
│   │   │   └── index.css      # Tailwind CSS
│   │   ├── index.html         # HTML entry point
│   │   ├── vite.config.js     # Vite config with proxy
│   │   ├── tailwind.config.js # Tailwind configuration
│   │   └── package.json       # Admin dependencies
│   └── customer/              # Customer Dashboard (Phase 7)
│       ├── src/
│       │   ├── main.jsx       # React entry point
│       │   ├── App.jsx        # Protected routes setup
│       │   ├── context/       # Auth context (access code)
│       │   ├── services/      # API client
│       │   ├── pages/         # 6 Dashboard pages:
│       │   │              #   Login, Dashboard, Conversations,
│       │   │              #   ConversationDetail, Billing, Usage
│       │   ├── components/    # UI components + InvoicePDF
│       │   │   └── layout/    # Header, Sidebar, Layout
│       │   └── index.css      # Tailwind CSS
│       ├── index.html         # HTML entry point
│       ├── vite.config.js     # Vite config with proxy (port 3003)
│       ├── tailwind.config.js # Tailwind config (purple theme)
│       └── package.json       # Customer dependencies
├── db/
│   └── migrations/            # SQL migration files
├── docker/
│   └── docker-compose.yml     # Container orchestration
├── n8n-workflows/             # Demo n8n workflows
└── package.json               # Root workspace (npm)
```

## Environment Variables

Located in `backend/.env`. Key variables:

- `POSTGRES_*`: Database connection settings
- `REDIS_*`: Redis connection settings
- `N8N_*`: n8n service configuration
- `WEBHOOK_URL`: Base URL for n8n webhooks
- `PORT`: Backend server port (default 3000)

When adding new environment variables, update both `.env` and document them in this section.

## Health Checks

The backend exposes a `/health` endpoint that checks:

- Redis connectivity (`PING` command)
- PostgreSQL connectivity (`SELECT 1` query)
- n8n service availability (`GET /healthz`)

Use this endpoint to verify all services are running correctly after startup.

## Troubleshooting

### n8n Migration Errors

**Symptom**: `column "timestamp" of relation "migrations" does not exist`

**Cause**: n8n and the application both use a table called `migrations`, but with different schemas.

**Status**: ✅ **RESOLVED** - This issue is prevented by the current setup:

- `docker-compose.yml` configures n8n to use the `n8n` schema via `DB_POSTGRESDB_SCHEMA: n8n`
- `docker/init-n8n-schema.sql` automatically creates the `n8n` schema on fresh database initialization
- Fresh container setups will automatically have the correct schema configuration

**If you encounter this on an existing setup** (e.g., upgrading from an older version):

1. Stop all containers: `npm run dockerdown`
2. Connect to Postgres and manually create the schema:
   ```bash
   docker exec -it docker-postgres-1 psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
   ```
   Then run:
   ```sql
   CREATE SCHEMA IF NOT EXISTS n8n;
   GRANT ALL PRIVILEGES ON SCHEMA n8n TO ${POSTGRES_USER};
   ```
3. Ensure `docker-compose.yml` has `DB_POSTGRESDB_SCHEMA: n8n` in the n8n service environment
4. Restart containers: `npm run dockerup`

**Note**: The `fix-n8n.sh` and `fix-n8n.sql` scripts are no longer needed with the current setup.

## Development Environment

**Platform**: Windows with PowerShell (NOT WSL)
**Package Manager**: npm (not pnpm)
**Docker**: Runs in WSL2 backend, accessed via `localhost` from PowerShell
**LLM**: Ollama with `Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf` model (changed from dolphin-llama3 for better tool calling)

**IMPORTANT**: All commands should be run in Windows PowerShell, NOT in WSL or any Linux terminal. The `backend/src/config.js` automatically detects the environment and routes connections appropriately.

**Current Services Running**:

- Backend API: http://localhost:3000
- Widget Dev Server: http://localhost:3001
- Admin Dashboard: http://localhost:3002
- Customer Dashboard: http://localhost:3003
- n8n: http://localhost:5678
- PostgreSQL: localhost:5432
- Redis: localhost:6379
