/**
 * Groups consecutive reasoning/internal messages into combined reasoning blocks.
 *
 * Collects ALL debug messages between user/visible messages and summarizes them.
 */

/**
 * Parse JSON from content (handles embedded JSON or pure JSON)
 */
function parseJsonFromContent(content) {
  try {
    return JSON.parse(content.trim());
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Check if message is a debug type (not user-visible)
 */
function _isDebugMessage(msg) {
  const type = msg.message_type || 'visible';
  return ['system', 'assessment', 'internal', 'critique', 'tool_call', 'tool_result'].includes(
    type
  );
}

/**
 * Check if message is part of the reasoning flow (assessment or internal, but not tool/system)
 */
function isReasoningMessage(msg) {
  const type = msg.message_type || 'visible';
  return ['assessment', 'internal'].includes(type);
}

/**
 * Extract UNDERSTAND/DECIDE from content
 */
function extractUnderstandDecide(content) {
  const understand = content.match(/UNDERSTAND:\s*([^\n]+)/);
  const decide = content.match(/DECIDE:\s*([^\n]+)/);
  return {
    understand: understand ? understand[1].trim() : null,
    decide: decide ? decide[1].trim() : null,
  };
}

/**
 * Groups messages for cleaner debug display.
 * Collects all consecutive reasoning messages into a single summary.
 */
export function groupReasoningMessages(messages) {
  if (!messages || messages.length === 0) return [];

  const result = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    const msgType = msg.message_type || 'visible';

    // Skip system prompts - render separately
    if (msgType === 'system') {
      result.push({ type: 'regular', message: msg });
      i++;
      continue;
    }

    // Tool calls and results - render separately
    if (msgType === 'tool_call' || msgType === 'tool_result') {
      result.push({ type: 'regular', message: msg });
      i++;
      continue;
    }

    // Check if this starts a reasoning sequence (any assessment or internal message)
    if (isReasoningMessage(msg)) {
      // Collect ALL consecutive reasoning messages
      const reasoningMessages = [];
      let j = i;

      while (j < messages.length && isReasoningMessage(messages[j])) {
        reasoningMessages.push(messages[j]);
        j++;
      }

      // Check if there's an actual critique following
      let critiqueMessage = null;
      if (j < messages.length && messages[j].message_type === 'critique') {
        critiqueMessage = messages[j];
        j++;
      }

      // Build the grouped reasoning
      const group = buildReasoningGroup(reasoningMessages, critiqueMessage);
      result.push(group);

      // If there was an actual critique, add it as a separate item
      if (critiqueMessage) {
        result.push({
          type: 'standalone_critique',
          message: critiqueMessage,
          timestamp: critiqueMessage.timestamp,
          tokens: critiqueMessage.tokens || 0,
          tokens_cumulative: critiqueMessage.tokens_cumulative || 0,
        });
      }

      i = j;
      continue;
    }

    // Regular visible message - pass through
    result.push({ type: 'regular', message: msg });
    i++;
  }

  return result;
}

/**
 * Build a reasoning group from collected messages
 */
function buildReasoningGroup(messages, critiqueMessage) {
  const group = {
    type: 'reasoning_group',
    messages: messages,
    summary: [],
    timestamp: messages[0]?.timestamp,
    tokens: 0,
    tokens_cumulative: 0,
    hasCritique: !!critiqueMessage,
    critiqueSkipped: false,
  };

  let lastAssessment = null;
  const contextFetches = [];
  let initialReasoning = null;

  for (const msg of messages) {
    group.tokens += msg.tokens || 0;
    group.tokens_cumulative = msg.tokens_cumulative || group.tokens_cumulative;

    if (msg.message_type === 'assessment') {
      const content = msg.content || '';

      // Check if this has UNDERSTAND/DECIDE (initial reasoning)
      const ud = extractUnderstandDecide(content);
      if (ud.understand || ud.decide) {
        initialReasoning = ud;
      }

      // Try to parse as JSON assessment
      const parsed = parseJsonFromContent(content);
      if (parsed && parsed.confidence !== undefined) {
        lastAssessment = parsed;
      }
    }

    if (msg.message_type === 'internal') {
      const content = msg.content || '';

      if (content.includes('Context fetched')) {
        // Extract attempt number and what was found/missing
        const attemptMatch = content.match(/attempt (\d+)/);
        const foundMatch = content.match(/found=([^,\n]+)/);
        const missingMatch = content.match(/missing=([^\n]+)/);

        contextFetches.push({
          attempt: attemptMatch ? attemptMatch[1] : contextFetches.length + 1,
          found: foundMatch ? foundMatch[1].trim() : '',
          missing: missingMatch ? missingMatch[1].trim() : '',
        });
      } else if (content.includes('Context fetch limit')) {
        contextFetches.push({ limitReached: true });
      } else if (content.includes('Critique skipped')) {
        group.critiqueSkipped = true;
      }
    }
  }

  // Build summary lines
  if (initialReasoning) {
    if (initialReasoning.understand) {
      group.summary.push(`UNDERSTAND: ${initialReasoning.understand}`);
    }
    if (initialReasoning.decide) {
      group.summary.push(`DECIDE: ${initialReasoning.decide}`);
    }
  }

  // Summarize context fetches
  if (contextFetches.length > 0) {
    const limitReached = contextFetches.some((cf) => cf.limitReached);
    const regularFetches = contextFetches.filter((cf) => !cf.limitReached);

    if (regularFetches.length === 1) {
      const cf = regularFetches[0];
      if (cf.found && cf.found !== 'none') {
        group.summary.push(`CONTEXT: Fetched ${cf.found}`);
      }
      if (cf.missing && cf.missing !== 'none') {
        group.summary.push(`CONTEXT: Missing ${cf.missing}`);
      }
    } else if (regularFetches.length > 1) {
      group.summary.push(`CONTEXT: ${regularFetches.length} fetch attempts`);
      if (limitReached) {
        group.summary.push(`CONTEXT: Limit reached, full context loaded`);
      }
    }
  }

  // Summarize final assessment
  if (lastAssessment) {
    const parts = [`confidence: ${lastAssessment.confidence}`];

    if (lastAssessment.tool_call) {
      parts.push(`tool: ${lastAssessment.tool_call}`);
      if (lastAssessment.tool_params && Object.keys(lastAssessment.tool_params).length > 0) {
        parts.push(`params: ${JSON.stringify(lastAssessment.tool_params)}`);
      }
    }

    if (lastAssessment.missing_params?.length > 0) {
      parts.push(`missing: ${lastAssessment.missing_params.join(', ')}`);
    }

    group.summary.push(`RESULT: ${parts.join(', ')}`);
  }

  // Critique status
  if (group.critiqueSkipped) {
    group.summary.push(`CRITIQUE: skipped`);
  } else if (group.hasCritique) {
    group.summary.push(`CRITIQUE: triggered (see below)`);
  }

  return group;
}

/**
 * Format the grouped reasoning for display
 */
export function formatGroupedReasoning(group) {
  return group.summary.join('\n');
}
