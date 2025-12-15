# Conversation Auto-End and Widget Detection Implementation

**Date**: December 12-15, 2025  
**Status**: ✅ Complete

## Overview

This document summarizes the implementation of conversation management features:

1. **Auto-end inactive conversations** - Automatically ends conversations after inactivity
2. **Widget conversation end detection** - Widget detects ended conversations and starts new sessions
3. **Manual end conversation button** - Users can manually end conversations
4. **AI-driven conversation end detection** - Automatically detects when users want to end
5. **Groq tool calling fixes** - Fixed tool execution issues with Groq provider

---

## Recent Fixes (December 15, 2025)

### Tool Execution Improvements

**Problem**: LLM was calling the same tool multiple times, then returning generic error messages even after successful tool execution.

**Solutions**:

1. **Duplicate tool call prevention**: Added `lastExecutedToolKeys` tracking to prevent infinite loops when LLM tries to call the same tools repeatedly
2. **Tool result simplification (REVERTED)**: ~~Simplified tool results to send only message~~ - **This was causing Groq to retry the same tool!** Tool result simplification removed completely. LLMs need to see structured data to understand the tool actually returned useful information. The `formatResponseForLLM` already handles truncation appropriately.
3. **System prompt improvement**: Added explicit instructions in system prompt to ALWAYS use tool results when tools execute successfully, removing the need for hardcoded error detection
4. **Widget UX fix**: Fixed widget clearing instantly after AI-detected conversation end - now grays out the conversation and preserves the AI's final response

### Root Cause Analysis (Groq Tool Calling Bug)

**Issue**: When using Groq, tools executed successfully but LLM returned "I apologize, but I encountered an issue processing your request" instead of using the tool result.

**Root Cause**: The tool result simplification code (lines 878-894 in conversationService.js) was stripping out the "Details:" section from formatted tool results, leaving only the message text. Example:

- **Before simplification**: "Order #12345 is out for delivery\n\nDetails:\n{ orderId, status, driver... }"
- **After simplification**: "Order #12345 is out for delivery"

When Groq received only the plain text message without structured data, it didn't recognize it as a valid tool result and attempted to call the tool again. The duplicate tool call prevention then kicked in and returned the generic error message.

**Fix**: Removed the tool result simplification entirely (December 15, 2025). The `n8nService.formatResponseForLLM()` already handles formatting appropriately with reasonable truncation (500 char limit for details). LLMs work better when they can see the structured data alongside the message.

**Files Modified**:

- `backend/src/services/conversationService.js` - Tool execution loop improvements, REMOVED tool result simplification (was causing Groq to retry)
- `backend/src/prompts/systemPrompt.js` - Added "CRITICAL: TOOL RESULTS" section
- `frontend/widget/src/widget.js` - Fixed conversation end visual handling

### LLM Provider Logging

Added single entry-point log in `llmService.chat()` to track which LLM provider and model is being called for each request, ensuring correct provider is used.

---

## Feature 1: Auto-End Inactive Conversations

### Problem

Conversations that were started but abandoned remained in "active" status indefinitely, cluttering the system.

### Solution

Implemented a scheduled background task that automatically ends conversations after a period of inactivity (default: 15 minutes).

### Implementation

#### Database Model

**File**: `backend/src/models/Conversation.js`

```javascript
static async findInactive(inactivityMinutes = 15) {
    const cutoffTime = new Date(Date.now() - inactivityMinutes * 60 * 1000);
    const result = await db.query(
        `SELECT c.*, COALESCE(MAX(m.timestamp), c.started_at) as last_activity
         FROM conversations c
         LEFT JOIN messages m ON c.id = m.conversation_id
         WHERE c.ended_at IS NULL
         GROUP BY c.id
         HAVING COALESCE(MAX(m.timestamp), c.started_at) < $1
         ORDER BY last_activity ASC`,
        [cutoffTime]
    );
    return result.rows;
}
```

#### Service Layer

**File**: `backend/src/services/conversationService.js`

```javascript
async autoEndInactiveConversations(inactivityMinutes = 15) {
    const inactiveConversations = await Conversation.findInactive(inactivityMinutes);
    for (const conv of inactiveConversations) {
        await Conversation.end(conv.id);
        await RedisCache.deleteConversationContext(conv.session_id);
    }
    return { ended: inactiveConversations.length };
}
```

#### Scheduled Task

**File**: `backend/src/index.js`

```javascript
function startScheduledTasks() {
  const INACTIVITY_TIMEOUT_MINUTES = parseInt(
    process.env.CONVERSATION_INACTIVITY_TIMEOUT_MINUTES || "15"
  );
  const CHECK_INTERVAL_MS = parseInt(
    process.env.CONVERSATION_AUTO_END_CHECK_INTERVAL_MS || "300000" // 5 minutes
  );

  runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES);
  setInterval(() => {
    runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES);
  }, CHECK_INTERVAL_MS);
}
```

**Configuration** (`backend/.env`):

```env
CONVERSATION_INACTIVITY_TIMEOUT_MINUTES=15
CONVERSATION_AUTO_END_CHECK_INTERVAL_MS=300000
```

### Benefits

- ✅ Prevents stale "active" conversations
- ✅ Automatic cleanup without manual intervention
- ✅ Configurable timeout and check interval
- ✅ Clears Redis cache automatically

---

## Feature 2: Widget Conversation End Detection

### Problem

When a conversation was auto-ended or manually ended, the widget continued using the old session ID, leading to errors when users tried to continue chatting.

### Solution

Implemented detection and handling of ended conversations in the widget, automatically starting new sessions when needed.

### Implementation

#### Backend Updates

**File**: `backend/src/services/conversationService.js`

```javascript
async getOrCreateConversation(clientId, sessionId, userIdentifier = null) {
    let conversation = await Conversation.findBySession(sessionId);
    // If conversation exists but has ended, create a new one
    if (conversation && conversation.ended_at) {
        conversation = await this.createConversation(clientId, sessionId, userIdentifier);
    } else if (!conversation) {
        conversation = await this.createConversation(clientId, sessionId, userIdentifier);
    }
    return conversation;
}
```

**File**: `backend/src/controllers/chatController.js`

```javascript
// Returns conversationEnded flag
return res.json({
  sessionId,
  messages: displayMessages,
  conversationEnded: !!conversation.ended_at,
});
```

#### Widget Updates

**File**: `frontend/widget/src/widget.js`

```javascript
startNewSession() {
    this.sessionId = this.storage.generateSessionId();
    this.storage.set('sessionId', this.sessionId);
    this.storage.saveMessages([]);
    this.window.loadMessages([]);
}

async loadHistory() {
    const historyData = await this.api.getHistory(this.sessionId);
    if (historyData.conversationEnded) {
        this.startNewSession();
        this.window.loadMessages([]);
        return;
    }
    // ... load messages ...
}
```

### Benefits

- ✅ Seamless user experience - no errors when continuing after conversation ended
- ✅ Automatic session management
- ✅ Proper cache invalidation
- ✅ Error recovery with automatic retry

---

## Feature 3: Manual End Conversation Button

### Problem

Customers had no way to manually end a conversation in the widget.

### Solution

Added an "End Conversation" button in the widget header.

### Implementation

**File**: `frontend/widget/src/components/window.js`

Added button in header with `onEndConversation` callback.

**File**: `frontend/widget/src/widget.js`

```javascript
async handleEndConversation() {
  try {
    await this.api.endSession(this.sessionId);
    this.startNewSession();
    // Show confirmation message
    const endMessage = {
      role: 'assistant',
      content: 'Conversation ended. How can I help you today?',
      timestamp: new Date(),
    };
    this.window.addMessage(endMessage);
  } catch (error) {
    // Still start new session even if API call fails
    this.startNewSession();
  }
}
```

### Benefits

- ✅ Customer control - users can end conversations when ready
- ✅ Immediate action - no waiting for auto-end
- ✅ Seamless transition - automatically starts new session

---

## Feature 4: Automatic Conversation End Detection

### Problem

Users often signal they're done with phrases like "thank you" or "goodbye", but the system didn't recognize these signals.

### Solution

Implemented intelligent detection of conversation-ending phrases that automatically ends conversations.

### Implementation

**File**: `backend/src/services/conversationService.js`

```javascript
detectConversationEnd(message) {
  if (!message || typeof message !== 'string') return false;

  const normalizedMessage = message.toLowerCase().trim();
  const endingPhrases = [
    'thank you', 'thanks', 'goodbye', 'bye',
    'that\'s all', 'i\'m done', 'we\'re done',
    'end conversation', 'close conversation',
    'have a good day', 'take care',
    // ... 30+ variations
  ];

  for (const phrase of endingPhrases) {
    if (normalizedMessage === phrase) return true;
    const regex = new RegExp(`^.*${phrase}[.!?,;]*$`, 'i');
    if (regex.test(normalizedMessage)) return true;
    const wordBoundaryRegex = new RegExp(`\\b${phrase}\\b`, 'i');
    if (wordBoundaryRegex.test(normalizedMessage) && normalizedMessage.length < 100) {
      return true;
    }
  }
  return false;
}
```

**Integration in `processMessage()`**:

```javascript
const shouldEndConversation = this.detectConversationEnd(userMessage);
if (shouldEndConversation) {
  await this.addMessage(conversation.id, "user", userMessage);
  await Conversation.end(conversation.id);
  await RedisCache.deleteConversationContext(sessionId);

  const goodbyeResponse = "Thank you for chatting with us! Have a great day!";
  await this.addMessage(conversation.id, "assistant", goodbyeResponse, 0);

  return {
    response: goodbyeResponse,
    conversationEnded: true,
    // ...
  };
}
```

### Supported Ending Phrases

30+ variations including:

- **Gratitude**: "thank you", "thanks", "thank you very much"
- **Goodbyes**: "goodbye", "bye", "see you"
- **Completion**: "that's all", "I'm done", "we're done"
- **Explicit**: "end conversation", "close conversation"
- **Polite closings**: "have a good day", "take care"

### Benefits

- ✅ Token savings - No LLM call needed for ending messages
- ✅ Better UX - Natural conversation flow
- ✅ Intelligent detection - Recognizes natural language patterns

---

## Feature 5: Groq Tool Calling Fix

### Problem

When using Groq as the LLM provider (with per-client provider override), tools were not being called because the system checked the default provider instead of the actual provider being used.

### Solution

Updated `supportsNativeFunctionCalling()` to accept a provider parameter and pass the effective provider when checking for native function calling support.

### Implementation

**File**: `backend/src/services/llmService.js`

```javascript
supportsNativeFunctionCalling(provider = null) {
  const providerToCheck = provider || this.provider;
  if (providerToCheck === 'claude') return true;
  if (providerToCheck === 'groq') return true;
  if (providerToCheck === 'openai') return true;
  if (providerToCheck === 'ollama') return false;
  return false;
}
```

**File**: `backend/src/services/conversationService.js`

```javascript
const effectiveProvider = client.llm_provider || llmService.provider;
const llmResponse = await llmService.chat(messages, {
  tools: llmService.supportsNativeFunctionCalling(effectiveProvider)
    ? formattedTools
    : null,
  // ...
});
```

**File**: `backend/src/services/toolManager.js`

```javascript
formatToolsForLLM(tools, provider = llmService.provider) {
  if (llmService.supportsNativeFunctionCalling(provider)) {
    return this.formatForNativeFunctionCalling(tools, provider);
  }
  return this.formatForPromptEngineering(tools);
}
```

### Additional Fixes

1. **Groq message formatting**: Fixed `formatMessagesForGroq()` to handle tool_calls that are already in Groq format
2. **Tool result simplification**: For native function calling, simplified tool results to send only clean messages
3. **System prompt**: Added explicit instructions to use tool results correctly

### Benefits

- ✅ Correct tool detection with per-client provider overrides
- ✅ Groq support - Tools now work correctly with Groq
- ✅ Backward compatible - Still works with default provider

---

## Files Modified

### Backend

1. `backend/src/models/Conversation.js` - Added `findInactive()` method
2. `backend/src/services/conversationService.js` - Auto-end, detection, tool execution improvements
3. `backend/src/services/llmService.js` - Provider parameter support, logging
4. `backend/src/services/toolManager.js` - Provider-aware tool formatting
5. `backend/src/controllers/chatController.js` - Conversation end status
6. `backend/src/routes/admin.js` - Status field in responses
7. `backend/src/index.js` - Scheduled task for auto-ending
8. `backend/src/prompts/systemPrompt.js` - Tool result usage instructions
9. `backend/.env` - Configuration variables

### Frontend (Widget)

1. `frontend/widget/src/api.js` - Conversation status in responses
2. `frontend/widget/src/widget.js` - Session management, end detection, visual handling
3. `frontend/widget/src/components/window.js` - End conversation button
4. `frontend/widget/src/components/messages.js` - Visual ended state
5. `frontend/widget/src/styles.css` - Ended conversation styles

---

## Configuration

### Environment Variables

| Variable                                  | Default  | Description                                               |
| ----------------------------------------- | -------- | --------------------------------------------------------- |
| `CONVERSATION_INACTIVITY_TIMEOUT_MINUTES` | `15`     | Minutes of inactivity before auto-ending a conversation   |
| `CONVERSATION_AUTO_END_CHECK_INTERVAL_MS` | `300000` | How often to check for inactive conversations (5 minutes) |

### Example Configuration

```env
# End conversations after 30 minutes of inactivity
CONVERSATION_INACTIVITY_TIMEOUT_MINUTES=30

# Check every 10 minutes
CONVERSATION_AUTO_END_CHECK_INTERVAL_MS=600000
```

---

## Testing Recommendations

### Auto-End Feature

1. Start a conversation, wait for timeout, verify conversation is ended
2. Verify task runs on server startup and on interval
3. Test custom configuration values

### Widget Detection

1. End a conversation, reload widget, verify new session starts
2. Send message after end, verify automatic retry with new session
3. Test cached messages are cleared when conversation ended

### Manual End

1. Click "End Conversation" button, verify confirmation and new session
2. Verify button appears and styling matches theme

### Automatic End Detection

1. Send "thank you", verify conversation ends automatically
2. Test various phrases ("goodbye", "that's all", etc.)
3. Test false positives (long messages with "thank you" in middle should NOT end)

### Groq Tool Calling

1. Set client to Groq, send message requiring tool, verify tool is called
2. Test per-client override (default Ollama, specific client Groq)

---

## Future Enhancements

1. **Per-client configuration**: Different inactivity timeouts per client
2. **Notification system**: Warn users before auto-ending
3. **Analytics**: Track auto-end statistics and patterns
4. **Widget enhancements**: Show conversation status in UI
5. **Advanced detection**: Detect user activity, extend timeout if active
6. **Ending phrase customization**: Allow clients to customize ending phrases

---

## Notes

- Auto-end runs as background task, doesn't block main server
- Conversations ended gracefully - no data lost, just marked as ended
- Widget detection is transparent to users
- Automatic end detection saves tokens by skipping LLM calls
- Manual end button provides immediate control
- All changes are backward compatible
- Groq tool calling works correctly with per-client provider overrides
- Tool execution improvements prevent duplicate calls and error messages

---

## Related Documentation

- `IMPLEMENTATION_PLAN.md` - Overall project implementation plan
- `INTEGRATION_SYSTEM_GUIDE.md` - Integration and tool system documentation
- `CLAUDE.md` - Architecture and technical documentation

---

**Implementation Status**: ✅ Complete and tested  
**Last Updated**: December 15, 2025
