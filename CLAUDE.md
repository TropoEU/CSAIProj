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

The system uses 9 core tables:

**Multi-Tenant Structure:**
- `clients`: Business clients using the platform (identified by API key)
- `client_tools`: Which tools each client has enabled
- `client_integrations`: External system connections per client
- `integration_endpoints`: n8n webhook URLs for each client's integrations

**Conversation Tracking:**
- `conversations`: Chat sessions between end-users and the AI
- `messages`: Individual messages in conversations

**Tool System:**
- `tools`: Master catalog of available tools (e.g., "get_order_status", "book_appointment")
- `tool_executions`: Audit log of all tool calls
- `api_usage`: Track LLM API consumption per client

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
- Base and enhanced prompt templates
- Client-specific customization
- Tool instruction templates
- Greeting and error messages

**Current LLM Provider**: Ollama (localhost:11434) with `Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf` model
- For local development and testing
- Changed from dolphin-llama3 for better tool calling capabilities
- No API costs
- Function calling handled via prompt engineering (not native API)
- Optimized settings: temperature 0.3, max_tokens 2048

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

**Tool Execution Flow**:
1. User message → Chat API
2. Load client's enabled tools
3. Call LLM with tools available
4. Detect tool calls in response
5. Execute tools via n8n webhooks
6. Log executions to `tool_executions` table
7. Feed results back to LLM
8. Return final AI response with tool data

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

**Integration Code**:
```html
<script src="http://localhost:3001/widget.js"
        data-api-key="YOUR_API_KEY"
        data-position="bottom-right"
        data-primary-color="#667eea"></script>
```

**Test Results**:
- Widget loads in <1 second
- Tool execution working (order status, appointments, inventory)
- Multi-turn conversations stable (10+ exchanges tested)
- No CSS conflicts with host pages (Shadow DOM isolation)

**See**: `PHASE_4_COMPLETE.md` and `PHASE_4_SUMMARY.md` for detailed implementation notes

### What's Not Yet Implemented

**From Phase 1** (Optional - can be added later):
- Data retention/cleanup scripts (`backend/src/scripts/cleanup.js`) - auto-delete old messages/tool executions
- Seed data for testing

**From Phase 2** (Optional):
- OpenAI provider implementation - currently placeholder only (Ollama and Claude work)
- Streaming responses (prepared but not active)

**From Phase 3** (Optional):
- Integration Service (`backend/src/services/integrationService.js`) - for pulling live data from client APIs (Shopify, WooCommerce, etc.)
- Advanced tool features: tool chaining, conditional execution, result caching

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
- Tool configuration per client
- Conversation monitoring with export
- Integration management
- Analytics dashboard with charts
- Test chat interface
- Login credentials: `admin` / `admin123`

**Phases 6-9** (Not Started):
- Phase 6: LLM optimization and provider options
- Phase 7: Hebrew/RTL support
- Phase 8: Advanced features (RAG, analytics, escalation)
- Phase 9: Production deployment and DevOps

## Important Implementation Patterns

### Adding a New Tool

1. Create n8n workflow with webhook trigger (`http://localhost:5678/webhook/<tool_name>`)
2. Add tool definition to `tools` table (name, description, parameters schema)
3. Enable tool for client in `client_tools` table with webhook URL
4. Tool Manager automatically loads and formats it for the LLM
5. No code changes needed - the system dynamically loads tools from database

**Example SQL**:
```sql
-- Add tool to catalog
INSERT INTO tools (tool_name, description, parameters_schema) VALUES (
  'get_product_info',
  'Get detailed information about a product',
  '{"type": "object", "properties": {"productId": {"type": "string", "description": "Product ID"}}, "required": ["productId"]}'
);

-- Enable tool for client
INSERT INTO client_tools (client_id, tool_id, enabled, n8n_webhook_url) VALUES (
  1,
  (SELECT id FROM tools WHERE tool_name = 'get_product_info'),
  true,
  'http://localhost:5678/webhook/get_product_info'
);
```

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
│   │   ├── models/            # Database models (10 tables: +Admin)
│   │   ├── routes/            # API route definitions (chat, tools, admin)
│   │   ├── controllers/       # Route handlers
│   │   ├── services/          # Business logic (n8n, cache, llm)
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
│   └── admin/                 # Admin Dashboard (Phase 5)
│       ├── src/
│       │   ├── main.jsx       # React entry point
│       │   ├── App.jsx        # Protected routes setup
│       │   ├── context/       # Auth context
│       │   ├── services/      # API client
│       │   ├── pages/         # Dashboard pages (Login, Dashboard, Clients, etc.)
│       │   ├── components/    # Reusable UI components
│       │   └── index.css      # Tailwind CSS
│       ├── index.html         # HTML entry point
│       ├── vite.config.js     # Vite config with proxy
│       ├── tailwind.config.js # Tailwind configuration
│       └── package.json       # Admin dependencies
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

**Fix**:
1. Stop all containers: `pnpm dockerdown`
2. Connect to Postgres and run `fix-n8n.sql` to clean up conflicting tables:
   ```bash
   docker exec -i docker-postgres-1 psql -U postgres -d csaidb < fix-n8n.sql
   ```
   Or manually via psql:
   ```bash
   docker exec -it docker-postgres-1 psql -U postgres -d csaidb
   \i /path/to/fix-n8n.sql
   ```
3. Restart containers: `pnpm dockerup`

The docker-compose.yml now configures n8n to use the `n8n` schema, preventing future conflicts.

## Development Environment

**Platform**: Windows with PowerShell (NOT WSL)
**Package Manager**: npm (not pnpm)
**Docker**: Runs in WSL2 backend, accessed via `localhost` from PowerShell
**LLM**: Ollama with `Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf` model (changed from dolphin-llama3 for better tool calling)

**IMPORTANT**: All commands should be run in Windows PowerShell, NOT in WSL or any Linux terminal. The `backend/src/config.js` automatically detects the environment and routes connections appropriately.

**Current Services Running**:
- Backend API: http://localhost:3000
- Widget Dev Server: http://localhost:3001
- n8n: http://localhost:5678
- PostgreSQL: localhost:5432
- Redis: localhost:6379