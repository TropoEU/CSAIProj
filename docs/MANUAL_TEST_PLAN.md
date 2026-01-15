# Manual Test Plan - Guided Reasoning System

## Test Environment Setup

### Prerequisites
- [ ] Backend running on `http://localhost:3000`
- [ ] Admin dashboard running on `http://localhost:3002`
- [ ] Customer dashboard running on `http://localhost:3003`
- [ ] Widget demo page available
- [ ] Create two test clients:
  - Client A: Plan with `ai_mode = 'standard'`
  - Client B: Plan with `ai_mode = 'adaptive'`
- [ ] Enable at least these tools for both clients:
  - `get_order_status` (read-only)
  - `book_appointment` (medium-risk)
  - `cancel_order` (destructive)

---

## Part 1: Standard Mode Tests (Client A)

### Test 1.1: Simple Greeting
**Steps:**
1. Open widget with Client A's API key
2. Send: "Hello"

**Expected:**
- Friendly greeting response
- No internal messages (assessment/critique)
- `api_usage` record shows: `adaptive_count = 0`, `critique_count = 0`
- Response time: < 2 seconds

### Test 1.2: FAQ Question
**Steps:**
1. Send: "What are your business hours?"

**Expected:**
- Response uses business_info context
- No tool calls
- Standard response format

### Test 1.3: Read-Only Tool Call
**Steps:**
1. Send: "Check status of order 12345"

**Expected:**
- Tool call to `get_order_status` executes
- Returns order information
- No confirmation required
- Tool execution logged in admin dashboard

### Test 1.4: Destructive Tool (Standard Mode)
**Steps:**
1. Send: "Cancel order 12345"

**Expected:**
- In Standard mode, tool executes DIRECTLY (no confirmation)
- Order cancellation happens immediately
- This is the key difference from Adaptive mode

---

## Part 2: Adaptive Mode - Basic Flows (Client B)

### Test 2.1: Simple Greeting (Skip Critique)
**Steps:**
1. Open widget with Client B's API key
2. Send: "Hi there"

**Expected:**
- Friendly greeting response
- **Assessment visible in admin debug mode** (check conversation detail)
- Assessment shows: `confidence = 10`, `tool_call = null`, `is_destructive = false`
- **Critique SKIPPED** (high confidence, no tool, no risk)
- `api_usage` shows: `adaptive_count = 1`, `critique_count = 0`
- Response time: < 2 seconds (single LLM call)

### Test 2.2: Read-Only Tool - High Confidence
**Steps:**
1. Send: "What's the status of order 67890?"

**Expected:**
- Assessment shows: `tool_call = 'get_order_status'`, `confidence = 8-9`, `is_destructive = false`
- **Critique SKIPPED** (read-only tool, high confidence)
- Tool executes immediately
- Response includes order status
- `critique_count` remains 0

### Test 2.3: FAQ with Minimal Context
**Steps:**
1. Send: "What's your return policy?"

**Expected:**
- Assessment may show: `needs_more_context = ['policies.returns']`
- System fetches context and re-prompts automatically
- Response includes return policy details
- Check admin debug: should see context fetch in metadata

---

## Part 3: Adaptive Mode - Destructive Actions

### Test 3.1: Destructive Tool - Confirmation Flow
**Steps:**
1. Send: "Cancel my order 12345"

**Expected:**
- Assessment shows: `tool_call = 'cancel_order'`, `is_destructive = true`, `needs_confirmation = true`
- Server applies confidence floor: `effective_confidence ≤ 6`
- **Critique TRIGGERED** (destructive tool)
- Critique decision: `ASK_USER`
- Response: "Are you sure you want to cancel order #12345? This action cannot be undone."
- **Pending intent stored in Redis** (check with Redis CLI or admin debug)
- `critique_count` increments to 1

**Steps (continued):**
2. Send: "Yes, cancel it"

**Expected:**
- System detects confirmation phrase
- Retrieves pending intent from Redis
- Intent hash matches
- Tool executes: `cancel_order` with params `{orderId: '12345'}`
- Response: "Order #12345 has been cancelled successfully."
- Pending intent cleared from Redis

### Test 3.2: Destructive Action with Missing Params
**Steps:**
1. Send: "I want a refund"

**Expected:**
- Assessment shows: `tool_call = 'refund'`, `missing_params = ['orderId']`
- **Critique NOT TRIGGERED** (HARD STOP for missing params)
- Response: "I'd be happy to help with a refund. Which order would you like to refund?"
- Reason code: `MISSING_PARAM`

### Test 3.3: Implied Destructive Intent
**Steps:**
1. Send: "I don't want this order anymore"

**Expected:**
- System detects implied destructive phrase: "don't want"
- Assessment shows: `is_destructive = true` or triggers critique
- Response asks for clarification: "Would you like to cancel your order? If so, please provide the order number."

---

## Part 4: Edge Cases

### Test 4.1: Context Fetch Loop Prevention
**Steps:**
1. Send a query that requires context (e.g., "What's your shipping policy?")
2. If system requests more context, send another related query immediately

**Expected:**
- Maximum 2 context fetches per message
- If limit reached, falls back to full context
- Check `api_usage.context_fetch_count` ≤ 2 per message

### Test 4.2: Tool Hallucination
**Steps:**
1. Send: "Delete all my data permanently"

**Expected:**
- Assessment may suggest: `tool_call = 'delete_all_data'`
- **Server validation BLOCKS** (tool doesn't exist)
- Reason code: `TOOL_NOT_FOUND`
- Response: "I don't have the ability to do that. Let me connect you with a team member."
- Escalation may be triggered

### Test 4.3: Confirmation Timeout
**Steps:**
1. Send: "Cancel order 99999"
2. Wait for confirmation prompt
3. **Wait 6+ minutes** (pending intent TTL is 5 minutes)
4. Send: "Yes"

**Expected:**
- Pending intent expired (not in Redis anymore)
- Reason code: `PENDING_INTENT_MISMATCH` or `AWAITING_CONFIRMATION`
- Response: "I'm sorry, but I need you to confirm again. Which order would you like to cancel?"

### Test 4.4: Confirmation Mismatch
**Steps:**
1. Send: "Cancel order 11111"
2. Wait for confirmation prompt
3. Open **new conversation tab/window** (same client)
4. In new tab, send: "Cancel order 22222"
5. Wait for confirmation
6. In **original tab**, send: "Yes"

**Expected:**
- Intent hash mismatch (confirming order 11111 but pending is 22222)
- System asks for clarification
- Each conversation has its own pending intent cache

### Test 4.5: Low Confidence Tool Call
**Steps:**
1. Send an ambiguous message: "I need help with my thing"

**Expected:**
- Assessment shows: `confidence ≤ 6`
- **Critique TRIGGERED** (low confidence)
- Critique decision: `ASK_USER` or `ESCALATE`
- Response asks for clarification

---

## Part 5: Hebrew Language Tests

### Test 5.1: Hebrew Conversation - Simple
**Steps:**
1. Set client language to Hebrew
2. Send: "שלום" (Hello)

**Expected:**
- Response in Hebrew
- **Assessment block in admin debug is ENGLISH** (JSON format)
- Widget displays Hebrew correctly
- Assessment parsing works correctly

### Test 5.2: Hebrew Destructive Intent
**Steps:**
1. Send: "בטל את ההזמנה 12345" (Cancel order 12345)

**Expected:**
- System detects Hebrew destructive phrase: "בטל"
- Confirmation prompt in Hebrew
- Assessment block still in English

### Test 5.3: Hebrew Confirmation
**Steps:**
1. After receiving Hebrew confirmation prompt
2. Send: "כן" (Yes)

**Expected:**
- Confirmation detected correctly
- Intent matches and executes
- Response in Hebrew

---

## Part 6: Performance & Metrics

### Test 6.1: Response Time Comparison
**Steps:**
1. Send 5 messages to Standard mode client
2. Send 5 messages to Adaptive mode client (no critique triggered)
3. Send 5 messages to Adaptive mode client (critique triggered)

**Expected:**
- Standard mode: ~1-2 seconds per message (1 LLM call)
- Adaptive no critique: ~1-2 seconds per message (1 LLM call)
- Adaptive with critique: ~3-4 seconds per message (2 LLM calls: assessment + critique)

### Test 6.2: Admin Dashboard Metrics
**Steps:**
1. After completing tests, open Admin Dashboard
2. Navigate to Usage Reports page
3. Check Client A and Client B usage

**Expected Client A (Standard):**
- `adaptive_count = 0`
- `critique_count = 0`
- `context_fetch_count = 0`

**Expected Client B (Adaptive):**
- `adaptive_count > 0` (all adaptive messages)
- `critique_count = X` (~20-40% of messages, depending on scenarios)
- `context_fetch_count ≥ 0` (if context was fetched)
- Critique trigger rate displayed as percentage

### Test 6.3: Customer Dashboard
**Steps:**
1. Login to Customer Dashboard with Client B's access code
2. Navigate to Usage page

**Expected:**
- Usage stats show adaptive mode metrics
- Reasoning section visible with:
  - Adaptive mode message count
  - Critique triggers with percentage
  - Context fetches with average
- Translations work in both English and Hebrew

---

## Part 7: Debug Mode Verification

### Test 7.1: Admin Conversation Detail - Standard Mode
**Steps:**
1. Open Admin Dashboard
2. Go to Conversations page
3. Open a Standard mode conversation
4. Enable debug mode

**Expected:**
- User and assistant messages visible
- No assessment/critique messages
- `reason_code` field empty or null for most messages

### Test 7.2: Admin Conversation Detail - Adaptive Mode
**Steps:**
1. Open an Adaptive mode conversation in admin dashboard
2. Enable debug mode

**Expected:**
- User messages
- **Assessment messages** (type: 'assessment', sender: 'system')
  - JSON format visible
  - Shows confidence, tool_call, tool_params, is_destructive, etc.
- **Critique messages** (type: 'critique', sender: 'system') when triggered
  - JSON format visible
  - Shows decision, reasoning, message
- Assistant messages (final responses)
- Reason codes visible as badges on messages

---

## Part 8: Error Handling

### Test 8.1: LLM Service Failure
**Steps:**
1. Stop Ollama or disconnect LLM provider temporarily
2. Send a message

**Expected:**
- Graceful error response
- User sees: "I'm having trouble processing your request. Please try again."
- Error logged in backend console
- No crash

### Test 8.2: Redis Failure
**Steps:**
1. Stop Redis temporarily
2. Send a destructive action that requires confirmation

**Expected:**
- Confirmation still works (fails open)
- Warning logged in backend
- Conversation continues
- May not store pending intent, but doesn't block flow

### Test 8.3: n8n Webhook Failure
**Steps:**
1. Stop n8n service
2. Send a message that triggers a tool call

**Expected:**
- Tool execution fails
- User sees: "I encountered an error executing that action."
- Error logged in tool_executions table
- Conversation continues

---

## Test Checklist Summary

**Standard Mode (Client A):**
- [ ] 1.1 Simple greeting
- [ ] 1.2 FAQ question
- [ ] 1.3 Read-only tool call
- [ ] 1.4 Destructive tool (no confirmation)

**Adaptive Mode - Basic (Client B):**
- [ ] 2.1 Simple greeting (skip critique)
- [ ] 2.2 Read-only tool high confidence
- [ ] 2.3 FAQ with minimal context

**Adaptive Mode - Destructive:**
- [ ] 3.1 Destructive tool confirmation flow
- [ ] 3.2 Destructive action with missing params
- [ ] 3.3 Implied destructive intent

**Edge Cases:**
- [ ] 4.1 Context fetch loop prevention
- [ ] 4.2 Tool hallucination
- [ ] 4.3 Confirmation timeout
- [ ] 4.4 Confirmation mismatch
- [ ] 4.5 Low confidence tool call

**Hebrew Language:**
- [ ] 5.1 Hebrew conversation simple
- [ ] 5.2 Hebrew destructive intent
- [ ] 5.3 Hebrew confirmation

**Performance & Metrics:**
- [ ] 6.1 Response time comparison
- [ ] 6.2 Admin dashboard metrics
- [ ] 6.3 Customer dashboard

**Debug Mode:**
- [ ] 7.1 Admin conversation detail - Standard
- [ ] 7.2 Admin conversation detail - Adaptive

**Error Handling:**
- [ ] 8.1 LLM service failure
- [ ] 8.2 Redis failure
- [ ] 8.3 n8n webhook failure

---

## Notes & Tips

1. **Use Admin Debug Mode**: Always check conversation details in admin dashboard with debug mode enabled to see internal messages

2. **Check Redis Cache**: Use Redis CLI to verify pending intents:
   ```bash
   redis-cli
   KEYS pending_intent:*
   GET pending_intent:<conversationId>
   ```

3. **Monitor Backend Logs**: Watch console output for reason codes and structured logging

4. **Test Both Languages**: Hebrew is critical for your Israeli market

5. **Performance Baseline**: Standard mode should always be faster than Adaptive mode with critique

6. **Metrics Accuracy**: After testing, verify metrics match your actions in admin dashboard

---

## Success Criteria

✅ **Standard mode** processes all requests with single LLM call
✅ **Adaptive mode** skips critique for safe, high-confidence actions
✅ **Adaptive mode** triggers critique for destructive/risky actions
✅ **Confirmation flow** works reliably in both English and Hebrew
✅ **Server policies** prevent hallucinated tools and enforce confidence floors
✅ **Context fetching** stops after 2 attempts
✅ **Metrics tracking** accurately reflects reasoning activity
✅ **Error handling** is graceful with no crashes
✅ **Hebrew support** works for both UI and assessment parsing

Good luck with testing! 🚀
