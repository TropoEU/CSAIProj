# Debug View - Complete Flow Guide

## What You'll See in the Admin Dashboard (Debug Mode ON)

When you view a conversation in debug mode, you'll now see a **clear, step-by-step flow** of exactly what happens:

---

### 1. 🤖 SYSTEM PROMPT
**What it shows**: The complete prompt sent to the AI, including:
- Business instructions
- Tool schemas with required parameters
- Reasoning process steps
- Response style rules

**Why it matters**: You can verify the AI is getting the right instructions and tool information.

---

### 2. 📜 CONVERSATION CONTEXT
**What it shows**: Recent messages loaded for context
- Shows last 5 messages
- Previews each message (first 100 chars)

**Why it matters**: You can see what context the AI is working with.

---

### 3. 🔄 CALLING LLM
**What it shows**:
- Provider (groq)
- Model (llama-3.3-70b-versatile)
- Number of messages being sent
- Temperature and max tokens

**Why it matters**: Confirms the AI is being called with correct settings.

---

### 4. 🧠 AI REASONING
**What it shows**: The AI's step-by-step thinking process:
```
UNDERSTAND: [What is the user asking for?]
CHECK CONTEXT: [Can I answer from history/business info?]
DECIDE: [Do I need a tool? Which one? Do I have all params?]
RESPOND: [What will I tell the user?]
```

**Why it matters**: **THIS IS THE KEY!** You can see HOW the AI is thinking through the problem.

---

### 5. 📊 AI ASSESSMENT
**What it shows**: The AI's decision:
- **Confidence**: 1-10 scale
- **Tool**: Which tool to call (or null)
- **Parameters**: What params the AI is sending
- **Missing**: What required params the AI doesn't have
- **Is Destructive**: Yes/No
- **Needs Confirmation**: Yes/No

**Why it matters**: You can see the AI's final decision before execution.

---

### 6. 🛡️ SERVER-SIDE POLICY CHECK
**What it shows**:
- ✅ **POLICY CHECK PASSED** - All validations OK
- ❌ **POLICY CHECK FAILED** - Missing params or invalid tool

**Why it matters**: Server catches mistakes the AI might make.

---

### 7. 🔧 EXECUTING TOOL (if applicable)
**What it shows**:
- Tool name
- Parameters being sent to n8n
- "Calling n8n workflow..."

**Why it matters**: You can see exactly what's being sent to the tool.

---

### 8. ✅ TOOL RESULT (if tool executed)
**What it shows**:
- ✅ **SUCCESS** - Result from n8n
- ❌ **FAILED** - Error message

**Why it matters**: You can see if the tool worked and what it returned.

---

### 9. 💬 USER SEES
**What it shows**: The final response shown to the user

**Why it matters**: This is what actually matters to the customer.

---

## Example Debug Flow for "Book a table for 4 at 7pm"

```
1. 🤖 SYSTEM PROMPT
   └─ Full prompt with book_appointment tool schema

2. 📜 CONVERSATION CONTEXT
   └─ [USER]: hi
   └─ [ASSISTANT]: Welcome to Bob's Pizza Shop...
   └─ [USER]: book a table for 4 at 7pm

3. 🔄 CALLING LLM
   └─ groq / llama-3.3-70b-versatile

4. 🧠 AI REASONING
   └─ UNDERSTAND: User wants to book a table
   └─ CHECK CONTEXT: I have business hours, I know we take reservations
   └─ DECIDE: Need book_appointment tool. Have: party_size, time. Missing: date, serviceType, customerName
   └─ RESPOND: I'll ask for the missing information

5. 📊 AI ASSESSMENT
   └─ Confidence: 8/10
   └─ Tool: book_appointment
   └─ Parameters: { party_size: 4, time: "7pm" }
   └─ Missing: date, serviceType, customerName

6. 🛡️ SERVER-SIDE POLICY CHECK
   └─ ❌ POLICY CHECK FAILED
   └─ Reason: MISSING_PARAM
   └─ Message: "I need some more information to proceed. Could you provide: date, serviceType, customerName?"

7. 💬 USER SEES
   └─ "I need some more information to proceed. Could you provide: date, serviceType, customerName?"
```

---

## The Complete Chain of Thought

Now you can follow the **EXACT reasoning chain**:
1. What instructions did the AI get? ✅
2. What context did it have? ✅
3. How did it think through the problem? ✅
4. What decision did it make? ✅
5. Did the server approve it? ✅
6. What tool was called? ✅
7. What was the result? ✅
8. What did the user see? ✅

**Every step is visible and labeled!**

---

## How to Test

1. Start the backend: `npm start`
2. Go to Admin Dashboard → Conversations
3. Click on a conversation
4. Toggle "Debug Mode" ON
5. You'll see the complete flow with all these sections

The debug view will now make COMPLETE SENSE and you can follow the AI's train of thought from start to finish!
