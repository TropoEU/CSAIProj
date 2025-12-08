# Phase 3: Tool Execution System - Handoff Summary

## Current Status: Ready to Begin Phase 3

**Phase 1**: ✅ Complete - Database, Models, Redis Cache
**Phase 2**: ✅ Complete - AI Engine Core (LLM, Conversations, Prompts)
**Phase 3**: ⏳ Ready to Start - Tool Execution System

---

## What Was Completed in Phase 2

### LLM Service (`backend/src/services/llmService.js`)

- Multi-provider architecture (Ollama, Claude, OpenAI placeholder)
- Ollama integration with `dolphin-llama3` model (localhost:11434)
- Claude integration (Anthropic API) - ready for production
- Token counting and cost tracking
- Error handling with retry logic
- Function calling support (Claude/OpenAI only - Ollama uses prompt engineering)

### Conversation Service (`backend/src/services/conversationService.js`)

- Full conversation lifecycle management
- Message persistence and retrieval
- Context window management (20 messages max)
- Redis caching integration
- Automatic statistics tracking (token counts, message counts)

### System Prompts (`backend/src/prompts/systemPrompt.js`)

- Base system prompt templates
- Client-specific customization
- Tool instruction templates
- Greeting and error messages

### Tests

All Phase 2 integration tests passing:

- Connection tests (Postgres, Redis, n8n, Ollama)
- LLM service tests
- Full conversation flow (4-turn conversation with Bob's Pizza Shop)
- Message and conversation persistence
- Token tracking

---

## Phase 3 Objectives

Enable the AI to execute real actions via n8n webhooks and pull live data from client systems.

### 3.1 Tool Manager

Create `backend/src/services/toolManager.js`:

- Parse tool definitions from `tools` table
- Convert to LLM function calling format (Claude/OpenAI)
- For Ollama: Add tool descriptions to system prompt (prompt engineering)
- Validate tool schemas
- Dynamic tool loading per client (from `client_tools` table)

### 3.2 n8n Integration Service

Complete `backend/src/services/n8nService.js` (file exists but empty):

- Implement webhook caller (POST to n8n webhook URLs)
- Pass parameters from AI tool calls
- Handle responses and errors
- Timeout handling (max 30s per tool)
- Response formatter (convert n8n output to AI-readable format)

### 3.3 Tool Execution Flow

Main orchestration logic:

- Detect tool calls from LLM response
- Execute tool via n8n webhook
- Wait for result with timeout
- Feed result back to LLM for final response
- Handle multi-step tool calls
- Error recovery (graceful fallback)
- Log all executions to `tool_executions` table

### 3.4 Live Data Integration Service

Create `backend/src/services/integrationService.js`:

- Connection testing (verify client APIs are reachable)
- Data fetching (call client backends on-demand)
- Temporary caching in Redis (5-10 min TTL)
- Authentication handling (API keys, OAuth, basic auth)

### 3.5 Demo n8n Workflows

Create example workflows in n8n UI:

- `get_order_status` - Check order status from e-commerce API
- `book_appointment` - Book appointment in calendar
- `check_inventory` - Check product availability
- `get_product_info` - Fetch product details
- Export workflows to `n8n-workflows/` folder

---

## Key Technical Details

### Environment

- **Platform**: Windows PowerShell (not WSL)
- **Package Manager**: npm (not pnpm)
- **Docker**: WSL2 backend, accessed via `localhost`
- **LLM**: Ollama with `dolphin-llama3` model

### Database Tables (Already Created)

- `tools` - Master catalog of all available tools
- `client_tools` - Which tools each client has enabled (with webhook URLs)
- `tool_executions` - Audit log of all tool calls
- `integration_endpoints` - n8n webhook URLs per client

### Function Calling Strategy

- **Claude/OpenAI**: Use native function calling API
- **Ollama**: Use prompt engineering (add tool descriptions to system prompt)

The LLM service already has `supportsNativeFunctionCalling()` method that returns:

- `true` for Claude and OpenAI
- `false` for Ollama

### n8n Configuration

- Running at `http://localhost:5678`
- Auth credentials in `backend/.env`
- Workflows will expose webhook URLs like: `http://localhost:5678/webhook/tool-name`

---

## Prerequisites Check

✅ All services running:

```powershell
npm run check:connections
```

✅ Database migrations applied:

```powershell
npm run migrate:status
```

✅ Phase 2 tests passing:

```powershell
npm run test:phase2
```

---

## Suggested Implementation Order

1. **Tool Manager** - Build tool loading and formatting system
2. **n8n Service** - Implement webhook calling infrastructure
3. **Create 1 Demo Workflow** - Get order status (simplest one)
4. **Tool Execution Flow** - Connect LLM → Tool Manager → n8n → back to LLM
5. **Test End-to-End** - Full conversation with tool execution
6. **Add More Workflows** - Appointments, inventory, etc.
7. **Integration Service** - Live data fetching (optional, can be Phase 4)

---

## Important Files to Reference

**Phase 2 Services (Working Examples)**:

- `backend/src/services/llmService.js` - LLM provider abstraction
- `backend/src/services/conversationService.js` - Message management
- `backend/src/services/redisCache.js` - Caching patterns

**Database Models**:

- `backend/src/models/Tool.js` - Tool definitions
- `backend/src/models/ClientTool.js` - Client-specific tools
- `backend/src/models/ToolExecution.js` - Execution audit log

**Documentation**:

- `CLAUDE.md` - Project overview and patterns
- `IMPLEMENTATION_PLAN.md` - Full roadmap
- `WINDOWS_POWERSHELL_MIGRATION.md` - Environment setup

---

## Testing Strategy for Phase 3

1. Unit test tool manager (load tools, format for LLM)
2. Unit test n8n service (webhook calling)
3. Integration test with mock n8n workflow
4. End-to-end test with real n8n workflow
5. Test error scenarios (timeout, failed webhook, invalid response)

---

## Expected Deliverable

After Phase 3, the AI should be able to:

1. Understand available tools from database
2. Decide when to use a tool based on user query
3. Execute tool via n8n webhook
4. Receive tool result
5. Generate final response incorporating tool result
6. Log execution for audit

**Example Flow**:

```
User: "What's the status of my order #12345?"
  ↓
LLM: Decides to use get_order_status tool
  ↓
Tool Manager: Formats tool call
  ↓
n8n Service: POST to webhook
  ↓
n8n Workflow: Calls e-commerce API
  ↓
n8n Service: Returns result
  ↓
LLM: "Your order #12345 is out for delivery, arriving in 30 minutes"
  ↓
User receives final response
```

---

## Quick Start for Phase 3

```powershell
# Verify everything is ready
npm run check:connections
npm run test:phase2

# Start implementing
# 1. Create backend/src/services/toolManager.js
# 2. Complete backend/src/services/n8nService.js
# 3. Create first n8n workflow in UI (localhost:5678)
# 4. Test with conversation flow
```

---

**Status**: Ready to begin Phase 3! All prerequisites met, tests passing, documentation updated.

We're ready to begin Phase 3: Tool Execution System.

CURRENT STATE:

- Phase 1 ✅ Complete: Database (9 tables), all models, Redis cache
- Phase 2 ✅ Complete: LLM service (Ollama/Claude), conversation
  service, system prompts
- All tests passing (run: npm run test:phase2)
- Environment: Windows PowerShell, npm, Docker in WSL2 backend
- LLM: Ollama with dolphin-llama3 model at localhost:11434

PHASE 3 GOALS:
Build tool execution system so AI can perform real actions via n8n
webhooks.

TASKS:

1. Create backend/src/services/toolManager.js

   - Load tool definitions from database
   - Format for LLM function calling (Claude/OpenAI native, Ollama via  
     prompts)

2. Complete backend/src/services/n8nService.js (file exists but empty)

   - Webhook caller with timeout handling
   - Response formatter

3. Build tool execution flow
   - Detect tool calls from LLM
   - Execute via n8n
   - Feed results back to LLM
   - Log to tool_executions table
4. Create demo n8n workflows
   - get_order_status
   - book_appointment
   - check_inventory

REFERENCE FILES:

- Read PHASE_3_HANDOFF.md for complete details
- Read CLAUDE.md for project overview and patterns
- See backend/src/services/llmService.js for provider abstraction
  example

START WITH: Creating toolManager.js to load and format tool definitions.
