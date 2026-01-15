/**
 * System Prompts for AI Customer Service Agent
 *
 * These prompts are now database-driven via PromptService.
 * This file provides backwards-compatible exports that use cached configs.
 */

import promptService from '../services/promptService.js';
import { PlatformConfig } from '../models/PlatformConfig.js';

// Cache for synchronous access (initialized on first async call)
let cachedDefaultConfig = null;

/**
 * Initialize the prompt cache (call this at app startup)
 */
export async function initializePrompts() {
  await promptService.initialize();
  cachedDefaultConfig = await promptService.getDefaultConfig();
}

/**
 * Refresh the cached default config (call after admin updates settings)
 */
export async function refreshCachedConfig() {
  cachedDefaultConfig = await promptService.getDefaultConfig();
}

/**
 * Build system prompt from config (sync version using cache)
 * All text is configurable via the database config
 * @param {Object} client - Client configuration
 * @param {Object} config - Prompt config
 * @returns {String} System prompt
 */
function buildPromptFromConfig(client, config) {
  const language = client.language || 'en';

  // Build intro from configurable template
  const introTemplate =
    config.intro_template || 'You are a friendly customer support assistant for {client_name}.';
  let prompt = introTemplate.replace('{client_name}', client.name);

  // Add current date context - critical for interpreting "today", "tomorrow", etc.
  const now = new Date();
  // Use local date components to avoid timezone issues
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  // Simple format: 1/1/2026 1:44am
  const simpleDateTime = `${month}/${day}/${year} ${hour12}:${minutes}${ampm}`;
  // ISO format for tool calls
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Calculate tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  prompt += `\n\n## CURRENT DATE/TIME: ${simpleDateTime}
When calling tools: today=${isoDate}, tomorrow=${tomorrowIso}`;

  // Add reasoning process if enabled
  if (config.reasoning_enabled !== false && config.reasoning_steps?.length > 0) {
    prompt += '\n\n## YOUR REASONING PROCESS (follow these steps internally before responding)\n';

    config.reasoning_steps.forEach((step, index) => {
      prompt += `\n**Step ${index + 1}: ${step.title}**\n${step.instruction}\n`;
    });
  }

  // Add response style instructions (all from config)
  if (config.response_style) {
    const style = config.response_style;
    const toneInstructions = config.tone_instructions || {
      friendly: 'Be warm and approachable.',
      professional: 'Maintain a professional and polished tone.',
      casual: 'Keep it conversational and relaxed.',
    };
    const formalityInstructions = config.formality_instructions || {
      casual: 'Use everyday language.',
      neutral: 'Balance professionalism with approachability.',
      formal: 'Use formal language and proper grammar.',
    };

    prompt += '\n## RESPONSE STYLE\n';
    if (style.tone && toneInstructions[style.tone]) {
      prompt += `- ${toneInstructions[style.tone]}\n`;
    }
    if (style.max_sentences) {
      prompt += `- Keep responses to ${style.max_sentences} sentence(s) maximum.\n`;
    }
    if (style.formality && formalityInstructions[style.formality]) {
      prompt += `- ${formalityInstructions[style.formality]}\n`;
    }
  }

  // Add tool usage rules
  if (config.tool_rules?.length > 0) {
    prompt += '\n## TOOL USAGE RULES\n';
    config.tool_rules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`;
    });
  }

  // Add tool format instructions from config
  const toolFormat =
    config.tool_format_template || 'USE_TOOL: tool_name\nPARAMETERS: {"key": "value"}';
  prompt += `\n## TOOL FORMAT (for models without native function calling)\n${toolFormat}\n`;

  // Add after tool results instructions from config
  const toolResultInstruction =
    config.tool_result_instruction ||
    'Summarize the result naturally for the customer. Do not expose raw data or JSON.';
  prompt += `\n## AFTER RECEIVING TOOL RESULTS\n${toolResultInstruction}`;

  // Add custom instructions if any
  if (config.custom_instructions) {
    prompt += `\n\n## ADDITIONAL INSTRUCTIONS\n${config.custom_instructions}`;
  }

  // Add language instruction for non-English (all from config)
  if (language !== 'en') {
    const languageNames = config.language_names || {
      en: 'English',
      he: 'Hebrew (עברית)',
      es: 'Spanish (Español)',
      fr: 'French (Français)',
      de: 'German (Deutsch)',
      ar: 'Arabic (العربية)',
      ru: 'Russian (Русский)',
    };
    const langName = languageNames[language] || language;
    const langTemplate =
      config.language_instruction_template ||
      'You MUST respond in {language_name}. Use natural, conversational {language_name}. All your responses must be in this language.';
    const langInstruction = langTemplate.replace(/{language_name}/g, langName);
    prompt += `\n\n## LANGUAGE REQUIREMENT\n${langInstruction}`;
  }

  return prompt;
}

/**
 * Get effective config for a client (merges client config with defaults)
 * @param {Object} client - Client with optional prompt_config
 * @returns {Object} Merged config
 */
function getEffectiveConfig(client) {
  const defaults = cachedDefaultConfig || PlatformConfig.getHardcodedDefaults();
  const clientConfig = client.prompt_config || {};

  if (Object.keys(clientConfig).length === 0) {
    return defaults;
  }

  // Merge client config with defaults
  return mergeConfigs(defaults, clientConfig);
}

/**
 * Merge two configs - child overrides parent
 */
function mergeConfigs(parent, child) {
  const merged = { ...parent };

  for (const [key, value] of Object.entries(child)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      merged[key] = value;
    } else if (typeof value === 'object' && typeof parent[key] === 'object') {
      merged[key] = mergeConfigs(parent[key], value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Base system prompt template
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools for this client (not used here, passed to toolManager)
 * @returns {String} System prompt
 */
export function getSystemPrompt(client, tools = []) {
  void tools; // Tools handled separately by toolManager

  const config = getEffectiveConfig(client);
  return buildPromptFromConfig(client, config);
}

/**
 * Async version that ensures latest config from database
 * @param {Object} client - Client configuration
 * @returns {Promise<String>} System prompt
 */
export async function getSystemPromptAsync(client) {
  const config = await promptService.getClientConfig(client);
  return buildPromptFromConfig(client, config);
}

/**
 * Enhanced system prompt with custom client instructions
 * @param {Object} client - Client configuration with business_info
 * @param {Array} tools - Available tools
 * @returns {String} System prompt
 */
export function getEnhancedSystemPrompt(client, tools = []) {
  const basePrompt = getSystemPrompt(client, tools);

  // Add client-specific instructions from business_info if provided
  const businessInfo = client.business_info || {};
  if (businessInfo.custom_instructions) {
    return `${basePrompt}\n\n## Client-Specific Instructions\n${businessInfo.custom_instructions}`;
  }

  return basePrompt;
}

/**
 * Context-aware prompt that includes business hours, policies, etc.
 * Automatically pulls from client.business_info if available
 * @param {Object} client - Client configuration with business_info
 * @param {Array} tools - Available tools
 * @param {Object} context - Additional context (overrides business_info if provided)
 * @returns {String} System prompt
 */
export function getContextualSystemPrompt(client, tools = [], context = {}) {
  let prompt = getEnhancedSystemPrompt(client, tools);

  // Merge business_info with context (context overrides business_info)
  const businessInfo = client.business_info || {};
  const mergedContext = { ...businessInfo, ...context };

  // Add business description if provided
  if (mergedContext.about_business) {
    prompt += `\n\n## About ${client.name}\n${mergedContext.about_business}`;
  }

  // Add business hours if provided
  if (mergedContext.business_hours) {
    prompt += `\n\n## Business Hours\n${mergedContext.business_hours}`;
  }

  // Add contact information if provided
  const contactInfo = [];
  if (mergedContext.contact_phone) contactInfo.push(`Phone: ${mergedContext.contact_phone}`);
  if (mergedContext.contact_email) contactInfo.push(`Email: ${mergedContext.contact_email}`);
  if (mergedContext.contact_address) contactInfo.push(`Address: ${mergedContext.contact_address}`);
  if (contactInfo.length > 0) {
    prompt += `\n\n## Contact Information\n${contactInfo.join('\n')}`;
  }

  // Add return policy if provided
  if (mergedContext.return_policy) {
    prompt += `\n\n## Return Policy\n${mergedContext.return_policy}`;
  }

  // Add shipping policy if provided
  if (mergedContext.shipping_policy) {
    prompt += `\n\n## Shipping Policy\n${mergedContext.shipping_policy}`;
  }

  // Add payment methods if provided
  if (mergedContext.payment_methods) {
    prompt += `\n\n## Payment Methods\n${mergedContext.payment_methods}`;
  }

  // Add FAQ if provided
  if (mergedContext.faq && mergedContext.faq.length > 0) {
    prompt += `\n\n## Frequently Asked Questions\n${mergedContext.faq.map((item, i) => `${i + 1}. Q: ${item.question}\n   A: ${item.answer}`).join('\n')}`;
  }

  return prompt;
}

/**
 * Tool-specific instruction templates (now loaded from config)
 * This is kept for backwards compatibility - actual values come from database
 */
export const toolInstructions = {
  get_order_status:
    "When a customer asks about their order, always use the get_order_status tool. Ask for their order number if they haven't provided it.",
  book_appointment:
    'When a customer wants to schedule an appointment, reservation, or pickup, use the book_appointment tool immediately. Extract date and time from natural language. If customer provides name, email, phone, use them. If missing, use reasonable defaults or ask once, then proceed.',
  check_inventory:
    'When a customer asks if a product is available, use the check_inventory tool with the product name or SKU.',
  get_product_info:
    'When a customer asks about product details (price, specs, availability), use the get_product_info tool to fetch live data.',
  send_email:
    'When a customer requests to receive information via email or needs documentation sent, use the send_email tool.',
};

/**
 * Get tool instructions from config with fallback to defaults
 * @param {string} toolName - Tool name
 * @param {Object} config - Prompt config (optional)
 * @returns {string} Tool instruction
 */
export function getToolInstruction(toolName, config = null) {
  const configInstructions =
    config?.tool_instructions || cachedDefaultConfig?.tool_instructions || {};
  return configInstructions[toolName] || toolInstructions[toolName] || '';
}

/**
 * Get all tool instructions from config
 * @param {Object} config - Prompt config (optional)
 * @returns {Object} Tool instructions map
 */
export function getAllToolInstructions(config = null) {
  const defaults = toolInstructions;
  const configInstructions =
    config?.tool_instructions || cachedDefaultConfig?.tool_instructions || {};
  return { ...defaults, ...configInstructions };
}

/**
 * Get conversation starter message
 * Returns null to let the AI generate the greeting dynamically
 * based on the client's language and business context
 * @param {Object} client - Client configuration
 * @returns {String|null} Greeting message or null for AI-generated
 */
export function getGreeting(client) {
  // Let the AI generate greetings - it knows the language from the prompt
  // Return a simple English fallback only used if AI generation fails
  void client;
  return null;
}

/**
 * Fallback greeting if AI doesn't generate one
 */
export const fallbackGreeting = 'Hi! How can I help you today?';

/**
 * Default messages (used as fallbacks)
 */
const defaultMessages = {
  escalation:
    'I apologize, but this request requires human assistance. Let me connect you with a team member who can better help you.',
  error: "I'm sorry, I'm having trouble processing that request. Please try again.",
};

/**
 * Escalation message template (English only - AI will translate)
 * Used as context for the AI to know what to communicate
 * @param {Object} config - Prompt config (optional)
 * @returns {String} Escalation message
 */
export function getEscalationMessage(config = null) {
  return (
    config?.escalation_message ||
    cachedDefaultConfig?.escalation_message ||
    defaultMessages.escalation
  );
}

/**
 * Error handling message template (English only - AI will translate)
 * Used as fallback when AI fails to respond
 * @param {Object} config - Prompt config (optional)
 * @returns {String} Error message
 */
export function getErrorMessage(config = null) {
  return config?.error_message || cachedDefaultConfig?.error_message || defaultMessages.error;
}

/**
 * Get system prompt for Adaptive mode with self-assessment instructions (sync version)
 * Uses cached config or hardcoded defaults
 * Reuses the standard mode system prompt and adds adaptive-specific instructions
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools with full schemas
 * @returns {String} System prompt with self-assessment instructions
 */
export function getAdaptiveModePrompt(client, tools = []) {
  // Get defaults from PlatformConfig (sync - uses hardcoded defaults)
  const config = PlatformConfig.getAdaptiveDefaults();
  return buildAdaptivePromptFromConfig(client, tools, config);
}

/**
 * Get system prompt for Adaptive mode (async version with database config)
 * Reuses the standard mode system prompt and adds adaptive-specific instructions
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools with full schemas
 * @returns {Promise<String>} System prompt with self-assessment instructions
 */
export async function getAdaptiveModePromptAsync(client, tools = []) {
  const config = await PlatformConfig.getAdaptivePromptConfig();
  return buildAdaptivePromptFromConfig(client, tools, config);
}

/**
 * Build adaptive mode prompt from config
 * Uses a minimal base prompt and relies on contextFetcher for on-demand context loading
 * @param {Object} client - Client configuration
 * @param {Array} tools - Available tools
 * @param {Object} config - Adaptive prompt config
 * @returns {String} System prompt
 */
function buildAdaptivePromptFromConfig(client, tools, config) {
  const language = client.language || 'en';

  // Build intro from config template - minimal, without loading all business info
  let prompt = (
    config.intro_template || 'You are a customer support assistant for {client_name}.'
  ).replace('{client_name}', client.name);

  // Add custom AI instructions if available (these are always loaded)
  if (client.business_info?.ai_instructions) {
    prompt += `\n\n${client.business_info.ai_instructions}`;
  }

  // Add current date/time
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  const simpleDateTime = `${month}/${day}/${year} ${hour12}:${minutes}${ampm}`;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  prompt += `\n\nCurrent date/time: ${simpleDateTime}\nWhen calling tools: today=${isoDate}, tomorrow=${tomorrowIso}`;

  // Format tool schemas for the AI
  const toolDescriptions = tools
    .map((t) => {
      const schema = t.parameters_schema || {};
      const required = schema.required || [];
      const properties = schema.properties || {};

      let toolDesc = `- **${t.tool_name}**: ${t.description || 'No description'}`;
      if (required.length > 0) {
        toolDesc += `\n  Required parameters: ${required.join(', ')}`;
      }
      if (Object.keys(properties).length > 0) {
        toolDesc += '\n  Parameters:';
        for (const [param, details] of Object.entries(properties)) {
          const isRequired = required.includes(param) ? ' (required)' : '';
          toolDesc += `\n    - ${param}${isRequired}: ${details.description || details.type || ''}`;
        }
      }
      return toolDesc;
    })
    .join('\n\n');

  // Build reasoning section from config
  const reasoningSteps = config.reasoning_steps || [];
  let reasoningSection = '';
  if (reasoningSteps.length > 0) {
    reasoningSection = `<reasoning>
${reasoningSteps.map((s) => `${s.title}: [${s.instruction}]`).join('\n')}
</reasoning>`;
  }

  // Build context keys section from config
  const contextKeys = config.context_keys || [];
  let contextSection = '';
  if (contextKeys.length > 0) {
    contextSection = `**Context Fetching**: Use needs_more_context to request:
${contextKeys.map((c) => `- "${c.key}" - ${c.description}`).join('\n')}`;
  }

  // Build tool rules section from config
  const toolRules = config.tool_rules || [];
  let rulesSection = '';
  if (toolRules.length > 0) {
    rulesSection = `**Rules**:
${toolRules.map((r) => `- ${r}`).join('\n')}`;
  }

  // Build the self-assessment instructions section
  const selfAssessmentInstructions = `

## INSTRUCTIONS

After your response, include reasoning and assessment blocks (English only):

${reasoningSection}

<assessment>
{
  "confidence": 8,
  "tool_call": "tool_name",
  "tool_params": {},
  "missing_params": [],
  "is_destructive": false,
  "needs_confirmation": false,
  "needs_more_context": []
}
</assessment>

${contextSection}

**Tools**:
${toolDescriptions}

${rulesSection}

**Important**: When tool parameters are missing, ask the customer naturally in the target language. Do not use technical parameter names.`;

  // Add language instruction for non-English
  let languageSection = '';
  if (language !== 'en') {
    const defaultLanguageNames = {
      en: 'English',
      he: 'Hebrew (עברית)',
      es: 'Spanish (Español)',
      fr: 'French (Français)',
      de: 'German (Deutsch)',
      ar: 'Arabic (العربية)',
      ru: 'Russian (Русский)',
    };
    const languageNames = config.language_names || defaultLanguageNames;
    const langName = languageNames[language] || language;
    languageSection = `\n\n**Language**: Respond in ${langName}. Assessment must remain in English.`;
  }

  return prompt + selfAssessmentInstructions + languageSection;
}

// Legacy exports for backwards compatibility
export const escalationMessage = getEscalationMessage();
export const errorMessage = getErrorMessage();
