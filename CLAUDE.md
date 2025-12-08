# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered customer service agent platform for business websites. It provides a plug-and-play widget that can be embedded in any website (Wix, Shopify, WordPress, custom HTML) to handle customer queries, execute actions, and integrate with business systems through n8n workflows.

The architecture follows a clean separation:
- **Backend API**: Node.js/Express server that handles AI orchestration and tool execution
- **n8n Integration**: Workflow automation that connects to external systems (Shopify, CRMs, Gmail, etc.)
- **Widget** (planned): Embeddable chat interface for client websites
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

**Note**: Commands run in Windows PowerShell, not WSL. Docker runs in WSL2 backend but is accessed via localhost.

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

**Current LLM Provider**: Ollama (localhost:11434) with `dolphin-llama3` model
- For local development and testing
- No API costs
- Function calling handled via prompt engineering (not native API)

## Important Implementation Patterns

### Adding a New Tool

1. Add tool definition to `tools` table (via SQL or programmatically)
2. Create route in `backend/src/routes/tools.js`
3. Implement controller in `backend/src/controllers/toolsController.js`
4. Create corresponding n8n workflow with webhook trigger
5. Store webhook URL in `integration_endpoints` table

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
│   │   ├── models/            # Database models (9 tables)
│   │   ├── routes/            # API route definitions
│   │   ├── controllers/       # Route handlers
│   │   ├── services/          # Business logic (n8n, cache)
│   │   ├── utils/             # Validation and helpers
│   │   └── scripts/           # Migration runner
│   ├── tests/                 # Integration tests
│   └── package.json           # Backend dependencies
├── db/
│   └── migrations/            # SQL migration files
├── docker/
│   └── docker-compose.yml     # Container orchestration
└── package.json               # Root workspace (pnpm)
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

**Platform**: Windows with PowerShell
**Package Manager**: npm (not pnpm)
**Docker**: Runs in WSL2 backend, accessed via `localhost` from PowerShell
**LLM**: Ollama with `dolphin-llama3` model

All commands should be run in PowerShell, not WSL. The `backend/src/config.js` automatically detects the environment and routes connections appropriately.