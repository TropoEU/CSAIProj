# Guided Reasoning Implementation Plan

> **Status**: Planning
> **Created**: December 31, 2025
> **Priority**: High - Core feature for AI reliability and cost optimization

## Overview

Implement a two-tier AI processing system:

- **Standard Mode**: Single call with full context (fast, relies on model's built-in reasoning)
- **Adaptive Mode**: Single call with self-assessment, triggers critique only when needed

Adaptive mode is the recommended default - it provides safety when needed without wasting calls on simple queries. Standard mode still leverages the AI's internal reasoning capabilities, just without the explicit self-assessment layer.

---

## Goals

1. **Prevent AI mistakes** - Self-critique before tool calls
2. **Debug trail** - Every reasoning step stored as internal message
3. **Token optimization** - Only load context when needed (Premium mode)
4. **Billing flexibility** - Charge differently based on AI mode
5. **Escalation integration** - Trigger existing escalation when AI is uncertain

---

## Architecture

### Standard Mode (Fast & Simple)

```
User Message
    ↓
┌─────────────────────────────────┐
│  Single LLM Call                │
│  - Full system prompt           │
│  - All business info            │
│  - All tool schemas             │
│  - Conversation history         │
│  - Relies on model's internal   │
│    reasoning (GPT-4/Sonnet are  │
│    already quite capable)       │
└─────────────────────────────────┘
    ↓
Response (+ optional tool call)
    ↓
Execute tool if called
```

**Use for**: Clients using high-quality models (GPT-4, Sonnet), simple use cases, when speed matters most. The model's built-in reasoning is already quite good.

### Adaptive Mode (Smart & Efficient)

```
User Message
    ↓
┌─────────────────────────────────────────────────────┐
│  SINGLE LLM CALL (minimal context + self-assessment)│
│                                                     │
│  Minimal prompt includes:                           │
│  - Business name & basics (hours, contact)          │
│  - List of available tools (names only)             │
│  - Self-assessment instructions                     │
│  - Recent conversation context                      │
│  (~500-800 tokens instead of 2000)                  │
│                                                     │
│  Output:                                            │
│  - response (text to show user)                     │
│  - tool_call (if any)                               │
│  - confidence (1-10)                                │
│  - needs_more_context (list of what's needed)       │
│  - needs_confirmation (bool)                        │
│  - missing_params (list)                            │
│  Stored as: visible + internal (assessment)         │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  NEEDS MORE CONTEXT? (code logic)                   │
│                                                     │
│  If needs_more_context is not empty:                │
│  → Fetch requested info from DB                     │
│  → Re-prompt with additional context                │
│  → Return to assessment step                        │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  CRITIQUE TRIGGER CHECK (code logic, not LLM)       │
│                                                     │
│  Needs critique if ANY of:                          │
│  - Destructive tool (cancel, delete, refund)        │
│  - Low confidence (< 7)                             │
│  - Missing required params                          │
│  - needs_confirmation = true                        │
│                                                     │
│  Skip critique if ALL of:                           │
│  - No tool call, OR                                 │
│  - Read-only tool + high confidence                 │
└─────────────────────────────────────────────────────┘
    │
    ├── NO CRITIQUE NEEDED
    │   ↓
    │   Execute tool (if any) & return response
    │   (1 LLM call total)
    │
    └── CRITIQUE NEEDED
        ↓
┌─────────────────────────────────────────────────────┐
│  SELF-CRITIQUE (2nd LLM call)                       │
│  Checks:                                            │
│  - Tool exists in arsenal?                          │
│  - All required params provided?                    │
│  - User explicitly requested this action?           │
│  - Destructive action → needs confirmation?         │
│  Decisions: PROCEED / ASK_USER / ESCALATE           │
│  Stored as: internal message                        │
└─────────────────────────────────────────────────────┘
        ↓
   Act on critique decision
   (2 LLM calls total, or 3 if context was fetched)
```

**Use for**: Most clients. Best balance of speed, cost, and safety.

### Minimal Context (What's Always Included)

Pulled from existing `clients` table fields:

| Source | Field | Tokens |
|--------|-------|--------|
| `clients.name` | Business name | ~10 |
| `clients.business_info.about.description` | Brief description | ~50 |
| `clients.business_info.contact.hours` | Operating hours | ~30 |
| `clients.business_info.contact.phone/email` | Contact info | ~20 |
| `client_tools` (enabled) | Tool names only | ~30 |
| Self-assessment instructions | (see prompts section) | ~150 |
| Conversation history (last 5) | Recent messages | ~300 |
| **Total** | | **~500-600** |

### Context That Can Be Fetched On-Demand

From existing `clients.business_info` JSONB structure:

| Context Key | Source | When Needed |
|-------------|--------|-------------|
| `policies.returns` | `business_info.policies.returns` | Refund/return questions |
| `policies.shipping` | `business_info.policies.shipping` | Delivery questions |
| `policies.privacy` | `business_info.policies.privacy` | Privacy questions |
| `policies.terms` | `business_info.policies.terms` | Terms questions |
| `faqs` | `business_info.faqs[]` | Common questions |
| `ai_instructions` | `business_info.ai_instructions` | Custom AI behavior |
| `contact.full` | `business_info.contact.*` | Full contact details |
| `about.full` | `business_info.about.*` | Full business details |
| `tool_schema:{name}` | `tools` + `client_tools` | Before calling a tool |

All this data already exists in the database - we just need to decide what's "minimal" vs "on-demand".

---

## Self-Critique Checklist

Before any tool call, the AI must verify:

### Tool Availability

- [ ] Does this tool exist in the system?
- [ ] Is this tool enabled for this client?
- [ ] Are integrations configured for this tool?

### Parameter Validation

- [ ] Are all required parameters provided?
- [ ] Are parameter formats valid? (email, phone, date, etc.)
- [ ] Are there any ambiguous values that need clarification?

### Appropriateness

- [ ] Is this the correct tool for the user's request?
- [ ] Did the user explicitly request this action?
- [ ] Is this a destructive action (cancel, delete, refund)?
  - If yes → Require user confirmation first
- [ ] What's my confidence level? (1-10)
  - If < 6 → Escalate or ask for clarification

### Decision Tree

```
All checks pass?
├── YES → PROCEED with tool call
└── NO → What failed?
    ├── Missing info → ASK_USER for clarification
    ├── Tool unavailable → Explain limitation, offer alternative
    ├── Destructive action → ASK_USER for confirmation
    ├── Low confidence → ESCALATE to human
    └── Ambiguous request → ASK_USER to clarify
```

### Flow Diagram

```
          User Message
               │
               ▼
         ┌─────────┐
         │ ASSESS  │ ──────────────────────┐
         └────┬────┘                       │
              │                            │
              ▼                            │
         ┌─────────┐                       │
         │CRITIQUE │ (only if action tool) │
         └────┬────┘                       │
              │                            │
     ┌────────┼────────┐                   │
     ▼        ▼        ▼                   │
  PROCEED  ASK_USER  ESCALATE              │
     │        │        │                   │
     ▼        │        ▼                   │
  Execute     │    Trigger                 │
   Tool       │    Escalation              │
     │        │        │                   │
     └────────┼────────┘                   │
              ▼                            │
         ┌─────────┐ ◄─────────────────────┘
         │ RESPOND │   (no tool? skip to here)
         └────┬────┘
              │
              ▼
         Return to User
         (wait for next message)
```

---

## Multi-Turn Conversation Example

Premium mode may take multiple turns to complete a complex action. Each message goes through the full pipeline independently, with conversation context providing continuity.

### Example: Cancel Order (3 turns)

**TURN 1: User requests action without required info**

```
User: "Cancel my order"
         ↓
┌─────────────────────────────────────────────────────────┐
│ ASSESS (stored as internal)                             │
│ Intent: cancel_order                                    │
│ Tool needed: cancel_order                               │
│ Required params: order_id                               │
│ User provided: (none)                                   │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ CRITIQUE (stored as internal)                           │
│ Tool: cancel_order                                      │
│ Checks:                                                 │
│   ✓ Tool exists in arsenal                              │
│   ✗ order_id NOT PROVIDED                               │
│ Decision: ASK_USER                                      │
│ Reason: "Missing required parameter: order_id"          │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ RESPOND (stored as visible) - NO TOOL EXECUTION         │
│ "I'd be happy to help cancel your order. Could you      │
│  please provide your order number? You can find it in   │
│  your confirmation email."                              │
└─────────────────────────────────────────────────────────┘
```

**TURN 2: User provides info, but destructive action needs confirmation**

```
User: "Order 12345"
         ↓
┌─────────────────────────────────────────────────────────┐
│ ASSESS (stored as internal)                             │
│ Intent: provide_info (continuing cancel flow)           │
│ Tool needed: cancel_order                               │
│ Params from context: order_id = "12345"                 │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ CRITIQUE (stored as internal)                           │
│ Tool: cancel_order                                      │
│ Checks:                                                 │
│   ✓ Tool exists in arsenal                              │
│   ✓ order_id = "12345" PROVIDED                         │
│   ⚠ Destructive action (cancel)                         │
│   ✗ User has NOT explicitly confirmed                   │
│ Decision: ASK_USER                                      │
│ Reason: "Destructive action requires confirmation"      │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ RESPOND (stored as visible) - NO TOOL EXECUTION         │
│ "Just to confirm - you want to cancel order #12345?     │
│  This action cannot be undone."                         │
└─────────────────────────────────────────────────────────┘
```

**TURN 3: User confirms, tool executes**

```
User: "Yes, cancel it"
         ↓
┌─────────────────────────────────────────────────────────┐
│ ASSESS (stored as internal)                             │
│ Intent: confirm_action                                  │
│ Tool needed: cancel_order                               │
│ Params from context: order_id = "12345"                 │
│ Explicit confirmation: YES                              │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ CRITIQUE (stored as internal)                           │
│ Tool: cancel_order                                      │
│ Checks:                                                 │
│   ✓ Tool exists in arsenal                              │
│   ✓ order_id = "12345" PROVIDED                         │
│   ✓ User explicitly confirmed: "Yes, cancel it"         │
│ Decision: PROCEED                                       │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ EXECUTE TOOL                                            │
│ cancel_order({ order_id: "12345" })                     │
│ Result: { success: true, message: "Order cancelled" }   │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ RESPOND (stored as visible) - WITH TOOL RESULT          │
│ "Done! Order #12345 has been cancelled. You'll receive  │
│  a confirmation email shortly. Is there anything else   │
│  I can help you with?"                                  │
└─────────────────────────────────────────────────────────┘
```

### Key Points

1. **Each message = fresh pipeline** - Every user message goes through Assess → Critique → Respond
2. **Context carries forward** - Conversation history provides continuity (order_id remembered)
3. **ASK_USER = skip tool, ask question** - No special "waiting state" needed
4. **Multiple turns is normal** - Premium mode prioritizes safety over speed
5. **All steps logged** - Debug mode shows complete reasoning chain across all turns

### Comparison: Standard vs Premium for Same Scenario

| Turn | Standard Mode | Premium Mode |
|------|---------------|--------------|
| 1 | Might ask for order ID, or might guess | Always asks for missing info |
| 2 | Might cancel immediately | Asks for confirmation (destructive) |
| 3 | N/A | Executes after confirmation |
| Safety | Could cancel wrong order | Confirms before destructive action |
| Debug | Minimal visibility | Full reasoning chain visible |

---

## Database Changes

### Option A: Client-level setting

```sql
-- Add to clients table
ALTER TABLE clients ADD COLUMN ai_mode VARCHAR(20) DEFAULT 'standard';
-- Values: 'standard', 'premium'
```

### Option B: Plan-level setting (recommended)

```sql
-- Add to plans table
ALTER TABLE plans ADD COLUMN ai_mode VARCHAR(20) DEFAULT 'standard';
-- Clients inherit from their plan
```

### Migration file

```sql
-- UP
ALTER TABLE plans ADD COLUMN ai_mode VARCHAR(20) DEFAULT 'standard';
UPDATE plans SET ai_mode = 'premium' WHERE name IN ('pro', 'enterprise');

-- DOWN
-- ALTER TABLE plans DROP COLUMN ai_mode;
```

---

## Model Strategy

### Decision: Single Smart Model for Everything

After analysis, using cheap models for any step is **not worth the risk**:

- Cheap models making critical decisions = unreliable
- Cheap models generating responses = quality issues (bad grammar, especially Hebrew)
- Cost savings are minimal compared to reliability loss

**Final approach**: Use the client's configured smart model for ALL steps.

### Standard vs Adaptive Mode Difference

The difference is NOT the model quality, but the **process**:

| Mode | Calls | Safety | Cost |
|------|-------|--------|------|
| Standard | Always 1 | None | ~$0.009/msg |
| Adaptive (simple query) | 1 | Self-assessment | ~$0.009/msg |
| Adaptive (risky action) | 2 | Self-assessment + critique | ~$0.015/msg |

Both modes use the same smart model. Adaptive only costs more when critique is triggered (~20% of queries).

### Why Adaptive is the Smart Default

1. **No wasted calls** - Simple queries stay fast (1 call)
2. **Safety when needed** - Risky actions get extra validation
3. **Same model throughout** - Consistent quality, no multi-model complexity
4. **Debug visibility** - Self-assessment stored as internal message

---

## Cost Analysis

### Standard Mode (Single Call - Full Context)

```
Per message:
- Input: ~2000 tokens (full context dump)
- Output: ~200 tokens

Groq Llama-70B: $0.59/M in + $0.79/M out
Cost: (2000 × $0.59 + 200 × $0.79) / 1M = $0.00134/message

Claude Sonnet: $3/M in + $15/M out
Cost: (2000 × $3 + 200 × $15) / 1M = $0.009/message
```

### Adaptive Mode (Minimal Context + On-Demand)

```
Simple query (no extra context, no critique) - ~60% of traffic:
- Input: ~600 tokens (minimal context + self-assessment)
- Output: ~250 tokens (response + assessment)
- Calls: 1

Query needing context (e.g., policy question) - ~20% of traffic:
- Call 1: ~600 in + ~250 out (realizes it needs policy info)
- Call 2: ~800 in + ~200 out (with fetched context)
- Calls: 2

Risky action (critique triggered) - ~20% of traffic:
- Call 1: ~600 in + ~250 out (response + assessment)
- Call 2: ~500 in + ~150 out (critique)
- Calls: 2
```

### Cost Comparison Summary (Claude Sonnet)

| Scenario | Standard | Adaptive | Difference |
|----------|----------|----------|------------|
| Simple query (60%) | $0.009 | $0.0056 | **-38%** |
| Context fetch (20%) | $0.009 | $0.0095 | +5% |
| Risky action (20%) | $0.009 | $0.0085 | -5% |
| **Weighted Average** | $0.009 | **$0.0068** | **-24%** |

**Key insight**: Adaptive mode is actually CHEAPER on average because:
1. Minimal context = fewer input tokens (~600 vs ~2000)
2. Extra calls only happen when needed (~40% of queries)
3. Even with 2 calls, total tokens are often less than one full-context call

---

## Implementation Phases

### Phase 1: Adaptive Mode Core (6-8 hours)

**Goal**: Working adaptive reasoning with conditional critique

- [ ] Add `ai_mode` to plans table (migration) - values: 'standard', 'adaptive'
- [ ] Create `AdaptiveReasoningService` class
- [ ] Update system prompt to request self-assessment in response
- [ ] Parse LLM response to extract assessment metadata
- [ ] Implement critique trigger logic (code, not LLM):
  - Destructive tool? → trigger
  - Low confidence? → trigger
  - Missing params? → trigger
  - Read-only + high confidence? → skip
- [ ] Implement critique step (2nd LLM call when triggered)
- [ ] Store assessment as internal message
- [ ] Store critique as internal message (when triggered)
- [ ] Integrate critique decisions with existing escalation system
- [ ] Add mode toggle to Admin UI (Plans page)
- [ ] Test with Groq

**Deliverables**:

- Adaptive mode fully functional
- Simple queries: 1 call
- Risky actions: 2 calls with validation
- Debug view shows assessment + critique (when triggered)
- Escalation triggered on ESCALATE decision

### Phase 2: Billing & Admin (2 hours)

**Goal**: Proper billing and visibility

- [ ] Add ai_mode cost multiplier to billing service
- [ ] Track mode + critique_triggered in api_usage table
- [ ] Update usage reports to show mode breakdown
- [ ] Add mode toggle with explanation to Admin UI

**Deliverables**:

- Accurate billing per mode
- Visibility into how often critique triggers

### Phase 3: Polish & Testing (3 hours)

**Goal**: Production-ready

- [ ] Comprehensive error handling
- [ ] Retry logic (once, then escalate)
- [ ] Unit tests for trigger logic
- [ ] Integration tests for full flow
- [ ] Manual testing across scenarios

**Deliverables**:

- Robust error handling
- Test coverage
- Production confidence

### Total Estimated Time: ~11-13 hours

---

## File Changes

### New Files

```
backend/src/services/adaptiveReasoningService.js  # Orchestrates adaptive flow
backend/src/prompts/critiquePrompt.js             # Critique step prompt
```

### Modified Files

```
backend/src/services/conversationService.js      # Route to adaptive reasoning based on ai_mode
backend/src/services/llmService.js               # Parse self-assessment from response
backend/src/prompts/systemPrompt.js              # Add self-assessment instructions
backend/src/models/Plan.js                       # Add ai_mode field
backend/src/services/billingService.js           # AI mode cost multiplier
frontend/admin/src/pages/Plans.jsx               # AI mode toggle in plan editor
frontend/admin/src/components/conversations/DebugLegend.jsx  # Add assessment/critique to legend
```

### Database

```
db/migrations/YYYYMMDDHHMMSS_add_ai_mode_to_plans.sql
```

---

## Prompts

### Self-Assessment Addition (added to main system prompt for Adaptive mode)

```
## Self-Assessment (Adaptive Mode)

After generating your response, include a self-assessment block:

<assessment>
{
  "confidence": 8,           // 1-10, how confident are you in this response?
  "tool_call": "tool_name",  // or null if no tool
  "tool_params": {},         // parameters you're using
  "missing_params": [],      // required params you don't have
  "is_destructive": false,   // cancel, delete, refund = true
  "needs_confirmation": false // should user confirm before action?
}
</assessment>

Your visible response to the user should NOT include this block - it will be parsed and removed.
```

### Critique Prompt (only called when triggered)

```
You are validating a planned action before execution.

## Context
User's message: "{user_message}"
Planned tool: {tool_name}
Parameters: {params}
Available tools for this client: {tool_list}

## Your Task
Verify this action is safe and appropriate.

Checklist:
1. Does "{tool_name}" exist in the available tools list?
2. Are all required parameters provided with valid values?
3. Did the user explicitly request this action (not just implied)?
4. For destructive actions (cancel/delete/refund): Has the user confirmed?

## Decision
Based on your analysis, respond with ONE of:
- PROCEED: All checks pass, safe to execute
- ASK_USER: Need to ask for missing info or confirmation (include the question)
- ESCALATE: Cannot handle safely, need human intervention (include reason)

Respond in JSON:
{
  "decision": "PROCEED" | "ASK_USER" | "ESCALATE",
  "reasoning": "Brief explanation of your decision",
  "message": "Question for user (if ASK_USER) or reason (if ESCALATE)"
}
```

### Example: How Assessment Gets Parsed

```
LLM Response:
"I'd be happy to cancel that order for you!

<assessment>
{"confidence": 7, "tool_call": "cancel_order", "tool_params": {"order_id": "123"},
 "missing_params": [], "is_destructive": true, "needs_confirmation": true}
</assessment>"

Parsed:
- Visible response: "I'd be happy to cancel that order for you!"
- Assessment: { confidence: 7, is_destructive: true, ... }
- Trigger check: destructive=true → RUN CRITIQUE
```

---

## Testing Plan

### Unit Tests

- [ ] Self-assessment parsing from LLM response
- [ ] Critique trigger logic (when to trigger, when to skip)
- [ ] Critique response parsing
- [ ] Mode routing (standard vs adaptive)

### Integration Tests

- [ ] Adaptive: Simple query (no critique triggered)
- [ ] Adaptive: Read-only tool with high confidence (no critique)
- [ ] Adaptive: Destructive tool (critique triggered)
- [ ] Adaptive: Low confidence response (critique triggered)
- [ ] Adaptive: Critique returns ASK_USER
- [ ] Adaptive: Critique returns ESCALATE
- [ ] Standard vs Adaptive comparison

### Manual Testing

- [ ] Simple greeting (should skip critique)
- [ ] FAQ question (minimal context)
- [ ] Tool call with all params provided
- [ ] Tool call with missing params
- [ ] Destructive action (cancel order)
- [ ] Request for unavailable tool
- [ ] Ambiguous request

---

## Open Questions

1. **Default mode for new clients?**

   - Option A: Standard (cheaper, upgrade path)
   - Option B: Premium (safer, can downgrade)

   Option A default.

2. **Override at conversation level?**

   - Should there be a way to force Premium for specific conversations?

   no

3. **Retry logic for failed critique?**

   - If critique call fails, should we retry, fallback to Standard, or escalate?

   retry once, then escalate if it fails again.

4. **Step 3 for every tool call?**

   - Or only for "dangerous" tools (cancel, delete, refund)?

   only for tools that perform an action, tools that are only meant to retrieve information (get_order_status for example) we aren't that worried about.

5. **Perplexity integration priority?**

   - Worth adding as assessment model option?
   - Their Sonar model is cheap ($1/M) but search-optimized

   not yet, i'll think about it later

---

## References

- [Current conversation flow](../backend/src/services/conversationService.js)
- [LLM service](../backend/src/services/llmService.js)
- [Tool manager](../backend/src/services/toolManager.js)
- [Escalation service](../backend/src/services/escalationService.js)
- [Debug mode implementation](./CONVERSATION_DEBUG_MODE.md) (if exists)

---

## Notes

- **Current limitation**: Only Groq available for testing, single model only
- **Perplexity option**: $5/month API credit available, Sonar at $1/M tokens
- **Priority**: Phase 1 can be implemented with single model, provides immediate value
- **Future**: Multi-model support unlocks full cost optimization
