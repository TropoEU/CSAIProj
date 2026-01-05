/**
 * Critique Prompt for Adaptive Reasoning Mode
 *
 * This prompt is used in the critique step to validate planned actions
 * before they are executed. It's only called when critique is triggered.
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
    const toolList = availableTools.map(t => t.tool_name || t.name || t).join(', ');

    // Build conversation context if provided
    let contextSection = '';
    if (conversationContext && conversationContext.length > 0) {
        contextSection = '\n## Recent Conversation Context\n' +
            conversationContext.map(msg => `${msg.role}: ${msg.content}`).slice(-5).join('\n') +
            '\n';
    }

    return `You are validating a planned action before execution to ensure safety and correctness.

## Context
User's latest message: "${userMessage}"
${contextSection}
Planned tool: ${assessment.tool_call || 'none'}
Parameters: ${JSON.stringify(assessment.tool_params || {})}
AI's confidence: ${assessment.confidence}/10
AI thinks is destructive: ${assessment.is_destructive}
AI thinks needs confirmation: ${assessment.needs_confirmation}

## Available Tools for This Client
${toolList}

## Your Task
Verify this action is safe and appropriate before allowing execution.

**Checklist:**

1. **Tool Availability**
   - Does "${assessment.tool_call}" exist in the available tools list above?
   - Is the tool name an EXACT match (not a similar name or guess)?

2. **Parameter Validation**
   - Are all required parameters provided with valid values?
   - Missing params identified: ${JSON.stringify(assessment.missing_params || [])}
   - Are there any ambiguous values that need clarification?

3. **User Intent**
   - Did the user explicitly request this action?
   - Or is this inferred from vague language?
   - For destructive actions: Is there clear confirmation from the user?

4. **Confidence Check**
   - Is the confidence level (${assessment.confidence}/10) appropriate for this action?
   - For destructive actions, should we require higher confidence?

5. **Context Check**
   - Given the recent conversation, does this action make sense?
   - Is the user continuing a previous flow or starting something new?

## Decision Rules

**PROCEED** if ALL of:
- Tool exists in available tools (exact match)
- All required parameters are provided
- User explicitly requested this action
- If destructive: User has confirmed the action
- Confidence level is acceptable for the risk level

**ASK_USER** if ANY of:
- Missing required parameters
- Ambiguous parameter values
- Destructive action without confirmation
- User intent is unclear

**ESCALATE** if ANY of:
- Confidence too low (< 4) for the requested action
- Tool doesn't exist (hallucinated tool name)
- Action seems harmful or inappropriate
- Unable to safely handle this request

## Response Format

Respond with ONLY a JSON object (no other text):

{
  "decision": "PROCEED" | "ASK_USER" | "ESCALATE",
  "reasoning": "Brief explanation of your decision (1-2 sentences)",
  "message": "Question for user (if ASK_USER) or reason for escalation (if ESCALATE), or empty string (if PROCEED)"
}

IMPORTANT: Your entire response must be valid JSON. Do not include any text before or after the JSON object.`;
}

/**
 * Simplified critique prompt for quick validation
 * Used when we just need to verify tool existence and params
 */
export function getQuickCritiquePrompt(toolName, params, availableTools) {
    const toolList = availableTools.map(t => t.tool_name || t.name || t).join(', ');

    return `Quick validation check.

Tool being called: "${toolName}"
Parameters: ${JSON.stringify(params)}
Available tools: ${toolList}

Respond with JSON only:
{
  "tool_exists": true/false,
  "all_params_provided": true/false,
  "decision": "PROCEED" | "ASK_USER" | "ESCALATE"
}`;
}

export default getCritiquePrompt;
