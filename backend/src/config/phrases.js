/**
 * Centralized configuration for detection phrases and thresholds
 *
 * This file consolidates all hard-coded phrase lists and magic numbers
 * used for conversation flow detection, escalation triggers, and AI behavior analysis.
 */

// =====================================================
// CONVERSATION ENDING DETECTION
// =====================================================

/**
 * STRONG ending phrases - these clearly signal intent to end
 * Will match if they appear at end of message or as standalone
 */
export const STRONG_ENDING_PHRASES = [
  // Goodbye variations (clear exit intent)
  'goodbye',
  'bye',
  'bye bye',
  'see you',
  'see ya',
  // Explicit completion statements
  "that's all",
  'thats all',
  'that is all',
  "i'm done",
  'im done',
  'i am done',
  "we're done",
  'were done',
  'we are done',
  "i'm finished",
  'im finished',
  'i am finished',
  "we're finished",
  'were finished',
  'we are finished',
  // Explicit ending commands
  'end conversation',
  'end the conversation',
  'close conversation',
  'close the conversation',
  // Clear completion signals
  "that's it",
  'thats it',
  'that is it',
  'all done',
  'all set',
  'no more questions',
  'no further questions',
  'nothing else',
  'nothing more',
  // Farewell wishes (clear goodbye)
  'have a good day',
  'have a nice day',
  'have a great day',
  'take care',
  'talk to you later',
  'catch you later',
  'until next time',
];

/**
 * WEAK ending phrases - only end if EXACT match (standalone message)
 * Users often say "thanks" but want to continue, so require exact match
 */
export const WEAK_ENDING_PHRASES = [
  'thank you',
  'thanks',
  'thank you very much',
  'thanks a lot',
  'thank you so much',
];

/**
 * Combined list for backwards compatibility
 */
export const ENDING_PHRASES = [...STRONG_ENDING_PHRASES, ...WEAK_ENDING_PHRASES];

// =====================================================
// HALLUCINATION DETECTION
// =====================================================

/**
 * Action words that indicate the AI claims to have done something
 */
export const ACTION_CLAIM_WORDS = [
  'booked',
  'reserved',
  'confirmed',
  'scheduled',
  'completed',
  'done',
  'finished',
];

/**
 * Phrases that indicate AI is pretending to use tools (hallucination)
 */
export const TOOL_SIMULATION_PHRASES = [
  'waits',
  'waiting',
  'checking',
  'loading',
  'processing',
  'status from the system',
  'information you asked for',
  'hold for a moment',
  'may take a moment',
  'please hold',
];

/**
 * Pattern to detect user requesting an action
 */
export const USER_ACTION_REQUEST_PATTERN =
  /(book|reserve|schedule|check|get.*status|what.*status|order.*status)/i;

// =====================================================
// ESCALATION DETECTION
// =====================================================

/**
 * Phrases that indicate AI is stuck asking for clarification
 */
export const CLARIFICATION_PHRASES = {
  en: [
    'could you clarify',
    'can you provide more',
    'need more information',
    'could you tell me more',
    'what do you mean',
    "i'm not sure what you mean",
    'could you be more specific',
    'can you explain',
  ],
  he: [
    'לתת פרטים נוספים',
    'אפשר להבהיר',
    'צריך יותר מידע',
    'אפשר לפרט',
    'מה הכוונה',
    'לא הבנתי',
    'אפשר להסביר',
  ],
};

/**
 * Phrases that indicate user explicitly wants human help
 */
export const ESCALATION_TRIGGERS = {
  en: [
    'talk to a human',
    'talk to human',
    'speak to a person',
    'speak to a human',
    'speak with a human',
    'speak with a person',
    'talk with a human',
    'talk with a person',
    'human agent',
    'real person',
    'customer service',
    'speak to someone',
    'talk to someone',
    'speak with someone',
    'talk with someone',
    'human support',
    'human help',
    'contact support',
    'need a human',
    'want a human',
    'get a human',
    'connect me to',
    'transfer me to',
  ],
  he: [
    'דבר עם אדם',
    'דבר לאדם',
    'דבר עם נציג',
    'לדבר עם אדם',
    'לדבר לאדם',
    'נציג אנושי',
    'אדם אמיתי',
    'שירות לקוחות',
    'לדבר עם מישהו',
    'דבר עם מישהו',
    'לדבר למישהו',
    'צור קשר',
    'צריך אדם',
    'רוצה אדם',
    'רוצה לדבר עם',
    'צריך לדבר עם',
    'העבר אותי ל',
    'חבר אותי ל',
    'תעביר אותי',
    'אדם בבקשה',
    'עזרה מאדם',
    'תמיכה אנושית',
  ],
};

// =====================================================
// THRESHOLDS AND MAGIC NUMBERS
// =====================================================

export const THRESHOLDS = {
  // Escalation detection
  MIN_MESSAGES_FOR_STUCK_DETECTION: 4,
  RECENT_MESSAGES_WINDOW: 6, // Look at last 6 messages (3 exchanges)
  MIN_AI_MESSAGES_FOR_STUCK: 3,
  CLARIFICATION_COUNT_THRESHOLD: 2, // 2+ clarifications = stuck

  // Conversation ending
  MAX_MESSAGE_LENGTH_FOR_ENDING: 100, // Don't match ending phrases in long messages

  // Usage alerts
  DEFAULT_USAGE_ALERT_THRESHOLD: 0.8, // 80% of limit triggers alert

  // Rate limiting (defaults - can be overridden per client)
  DEFAULT_RATE_LIMIT_PER_MINUTE: 60,

  // Context window
  MAX_CONTEXT_MESSAGES: 20, // Maximum messages to include in context

  // Tool execution
  TOOL_EXECUTION_TIMEOUT_MS: 30000, // 30 seconds
  MAX_TOOL_ITERATIONS: 5, // Maximum tool call iterations per message

  // Conversation auto-end
  AUTO_END_INACTIVE_MINUTES: 15,
  AUTO_END_CHECK_INTERVAL_SECONDS: 300,

  // Cache TTLs (in seconds)
  CONVERSATION_CACHE_TTL: 3600, // 1 hour
  RATE_LIMIT_TTL: 60, // 1 minute
  RESPONSE_CACHE_TTL: 300, // 5 minutes
  SESSION_LOCK_TTL: 30,

  // Plan cache
  PLAN_CACHE_TTL_MS: 60000, // 1 minute
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get escalation triggers for a specific language
 * Falls back to English if language not supported
 */
export function getEscalationTriggers(language = 'en') {
  return ESCALATION_TRIGGERS[language] || ESCALATION_TRIGGERS.en;
}

/**
 * Get clarification phrases for a specific language
 * Falls back to English if language not supported
 */
export function getClarificationPhrases(language = 'en') {
  return CLARIFICATION_PHRASES[language] || CLARIFICATION_PHRASES.en;
}

/**
 * Get all escalation triggers (both languages combined)
 */
export function getAllEscalationTriggers() {
  return [...ESCALATION_TRIGGERS.en, ...ESCALATION_TRIGGERS.he];
}

/**
 * Get all clarification phrases (both languages combined)
 */
export function getAllClarificationPhrases() {
  return [...CLARIFICATION_PHRASES.en, ...CLARIFICATION_PHRASES.he];
}
