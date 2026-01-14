/**
 * Application Constants
 *
 * Centralized location for all magic numbers and configuration values.
 *
 * Usage:
 *   import { TIMEOUTS, LIMITS, CACHE } from '../config/constants.js';
 *   setTimeout(callback, TIMEOUTS.N8N_WEBHOOK);
 */

// ==================== Timeouts (milliseconds) ====================

export const TIMEOUTS = {
  // n8n Service
  N8N_WEBHOOK: 30000,           // 30 seconds - main webhook execution timeout
  N8N_HEALTH_CHECK: 5000,       // 5 seconds - health check timeout
  N8N_WEBHOOK_TEST: 5000,       // 5 seconds - webhook connectivity test timeout

  // Integration Service
  INTEGRATION_TEST: 10000,      // 10 seconds - integration test timeout

  // LLM Service
  LLM_RETRY_DELAY: 1000,        // 1 second - initial retry delay

  // Gmail Service
  TOKEN_REFRESH_BUFFER: 5 * 60 * 1000,  // 5 minutes - refresh tokens before expiry

  // Email Monitor
  EMAIL_MONITOR_INTERVAL: 60000,        // 60 seconds - email check interval

  // Transactional Email
  EMAIL_CONFIG_CHECK_INTERVAL: 60000,   // 60 seconds - config recheck interval

  // Redis Session Lock
  SESSION_LOCK_TTL: 60,         // 60 seconds - conversation lock TTL

  // Rate Limiting
  RATE_LIMIT_WINDOW: 60,        // 60 seconds - rate limit window
};

// ==================== Size Limits (bytes/characters) ====================

export const LIMITS = {
  // JSONB Validation
  JSONB_MAX_SIZE: 1024 * 1024,  // 1MB - maximum JSONB field size
  JSONB_MAX_DEPTH: 10,          // Maximum nesting depth for JSONB objects

  // Payload Validation
  MAX_PAYLOAD_SIZE: 100 * 1024, // 100KB - maximum request payload size

  // Response Truncation
  TOOL_RESULT_MAX: 5000,        // 5000 chars - maximum tool result size before truncation
  TOOL_RESULT_PREVIEW: 2000,    // 2000 chars - preview size for truncated results

  // Log Truncation
  MAX_LOG_LENGTH: 500,          // 500 chars - maximum log entry length
  MAX_LOG_EXCERPT: 200,         // 200 chars - excerpt length for logs

  // Error Details
  MAX_ERROR_DETAILS: 500,       // 500 chars - maximum error detail length

  // Sample Data
  SAMPLE_RESPONSE_SIZE: 1000,   // 1000 chars - sanitized sample response size

  // n8n Response Formatting
  N8N_RESPONSE_DATA_MAX: 500,   // 500 chars - max data size to include in formatted response
};

// ==================== Rate Limits (requests per minute) ====================

export const RATE_LIMITS = {
  CHAT_API: 60,                 // 60 requests/minute - end-user chat widget (public-facing)
  CUSTOMER_DASHBOARD: 120,      // 120 requests/minute - authenticated customer portal
  ADMIN_DASHBOARD: 300,         // 300 requests/minute - admin operations (higher limit for management tasks)
};

// ==================== Cache Configuration ====================

export const CACHE = {
  // TTLs (seconds)
  CONVERSATION_CONTEXT_TTL: 3600,       // 1 hour - active conversation cache
  RESPONSE_CACHE_TTL: 300,              // 5 minutes - response cache
  PROMPT_CONFIG_CACHE_TTL: 60,          // 1 minute - prompt config cache
  TOOL_LIST_CACHE_TTL: 300,             // 5 minutes - client tool list cache
  INTEGRATION_CACHE_TTL: 300,           // 5 minutes - integration credentials cache

  // Cache key prefixes (for Redis)
  PREFIX_CONVERSATION: 'conversation:',
  PREFIX_CACHE: 'cache:',
  PREFIX_RATE_LIMIT: 'rate_limit:',
  PREFIX_LOCK: 'lock:conversation:',
  PREFIX_TOOL_LOCK: 'tool:',
  PREFIX_TOOLS: 'tools:',
  PREFIX_INTEGRATIONS: 'integrations:',
};

// ==================== Billing & Usage ====================

export const BILLING = {
  TOKENS_PER_THOUSAND: 1000,    // Token calculation divisor
  DEFAULT_INPUT_TOKENS: 500,    // Default avg input tokens per message
  DEFAULT_OUTPUT_TOKENS: 200,   // Default avg output tokens per message
  MAX_CLIENTS_PER_BATCH: 1000,  // Max clients to fetch for bulk operations
};

// ==================== Retry Configuration ====================

export const RETRY = {
  MAX_ATTEMPTS: 3,              // Maximum retry attempts
  INITIAL_DELAY: 1000,          // 1 second - initial delay before retry
  BACKOFF_MULTIPLIER: 2,        // Exponential backoff multiplier (2^attempt)
};

// ==================== Response Thresholds ====================

export const THRESHOLDS = {
  SLOW_API_RESPONSE: 5000,      // 5 seconds - threshold for slow API warning
};

// ==================== Conversation Settings ====================

export const CONVERSATION = {
  MAX_CONTEXT_MESSAGES: 20,     // Maximum messages to include in LLM context
  MAX_ITERATIONS: 10,           // Maximum LLM iterations per conversation turn
};

// ==================== Adaptive Reasoning ====================

export const ADAPTIVE_REASONING = {
  // Context fetching
  MAX_CONTEXT_FETCHES: 2,       // Maximum context fetch attempts before loading full context

  // Confidence thresholds
  MIN_CONFIDENCE_FOR_ACTION: 7, // Minimum confidence to proceed without critique

  // LLM settings for adaptive mode
  DEFAULT_MAX_TOKENS: 2048,     // Default max tokens for main LLM calls
  REPROMPT_MAX_TOKENS: 512,     // Max tokens for re-prompt (missing params, tool results)
  CRITIQUE_MAX_TOKENS: 1024,    // Max tokens for critique step
  DEFAULT_TEMPERATURE: 0.3,     // Temperature for consistent responses
  CRITIQUE_TEMPERATURE: 0.2,    // Lower temperature for critique (more deterministic)

  // Error message generation
  ERROR_MESSAGE_MAX_TOKENS: 100, // Max tokens for friendly error messages
  ERROR_MESSAGE_TEMPERATURE: 0.7, // Temperature for error messages (slightly creative)

  // Retry settings
  CRITIQUE_MAX_RETRIES: 1,      // Max retry attempts for critique step
  CRITIQUE_RETRY_DELAY: 1000,   // Delay between critique retries (ms)

  // Recent message context
  CONTEXT_MESSAGE_COUNT: 5,     // Number of recent messages to include for context
};

// ==================== HTTP Status Codes ====================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ==================== Environment Detection ====================

export const ENV = {
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  isDocker: process.env.DOCKER_CONTAINER === 'true',
};
