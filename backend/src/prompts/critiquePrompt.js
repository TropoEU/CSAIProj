/**
 * Critique Prompt for Adaptive Reasoning Mode
 *
 * This prompt validates the AI's reasoning and planned actions
 * before they are executed. It verifies understanding, tool choice,
 * and parameters.
 */

/**
 * Generate critique prompt
 * @param {string} userMessage - The original user message
 * @param {Object} assessment - The AI's self-assessment
 * @param {Array} availableTools - List of available tool names
 * @param {Object} conversationContext - Recent conversation history
 * @returns {string} Critique prompt
 */
export function getCritiquePrompt(userMessage, assessment, availableTools, conversationContext = []) {
    const toolList = availableTools.map(t => {
        const name = t.tool_name || t.name || t;
        const desc = t.description || '';
        return desc ? `- ${name}: ${desc}` : `- ${name}`;
    }).join('\n');

    // Build conversation context if provided
    let contextSection = '';
    if (conversationContext && conversationContext.length > 0) {
        contextSection = '\n## Recent Conversation\n' +
            conversationContext.map(msg => `${msg.role}: ${msg.content}`).slice(-5).join('\n') +
            '\n';
    }

    return `You are a second-opinion validator. Review the AI's understanding and planned action.

## User's Message
"${userMessage}"
${contextSection}
## AI's Planned Action
Tool: ${assessment.tool_call || 'none'}
Parameters: ${JSON.stringify(assessment.tool_params || {})}
Confidence: ${assessment.confidence}/10
**DESTRUCTIVE ACTION: ${assessment.is_destructive ? 'YES - requires explicit user confirmation before executing' : 'No'}**
${assessment.needs_confirmation ? '⚠️ This action REQUIRES user confirmation. Do NOT proceed without it.' : ''}

## Available Tools
${toolList}

## Your Task - Verify THREE things:

**1. UNDERSTANDING** - Did the AI correctly understand what the user wants?
- What is the user actually asking for?
- Did the AI interpret it correctly?
- Any misunderstanding or assumption errors?

**2. TOOL CHOICE** - Is this the right tool (or should no tool be used)?
- Does "${assessment.tool_call}" exist in the available tools?
- Is it the CORRECT tool for what the user wants?
- Should a different tool be used instead?
- Should NO tool be used (just a text response)?

**3. EXECUTION READINESS** - Can we proceed safely?
- Are all required parameters provided and correct?
- For destructive actions: Has user confirmed?
- Is confidence level appropriate?

## Decision Options

**PROCEED** - ONLY if ALL conditions met:
- Understanding is correct
- Right tool selected
- All parameters valid
- If DESTRUCTIVE: User has EXPLICITLY confirmed (said "yes", "confirm", etc.)

**RETRY** - AI misunderstood or picked wrong tool
- AI's interpretation is wrong
- A different tool should be used
- No tool should be used but AI picked one

**ASK_USER** - Need confirmation or clarification
- Missing required parameters
- Ambiguous values need clarification
- **DESTRUCTIVE action without explicit user confirmation** ← IMPORTANT!
  (User saying "book a table" is a REQUEST, not a CONFIRMATION.
   You must ASK_USER to confirm before proceeding with destructive actions.)

**ESCALATE** - Cannot handle safely
- Request seems harmful
- Confidence too low
- Unable to determine correct action

## Response Format (JSON only)

{
  "decision": "PROCEED" | "RETRY" | "ASK_USER" | "ESCALATE",
  "understanding": {
    "what_user_wants": "brief description of user's actual intent",
    "ai_understood_correctly": true/false,
    "misunderstanding": "if false, what did AI get wrong"
  },
  "tool_choice": {
    "correct_tool": true/false,
    "reason": "why this tool is right/wrong",
    "suggested_tool": "if wrong, which tool should be used (or 'none')"
  },
  "execution": {
    "ready": true/false,
    "needs_confirmation": true/false,
    "has_user_confirmed": true/false,
    "issues": ["list any issues blocking execution, e.g. 'needs user confirmation'"]
  },
  "reasoning": "1-2 sentence summary of your decision"
}`;
}

export default getCritiquePrompt;
