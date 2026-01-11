import { PlatformConfig } from '../models/PlatformConfig.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('PromptService');

/**
 * Prompt Service
 *
 * Manages AI prompt configuration with caching.
 * Loads prompt configs from database and caches them for performance.
 */
class PromptService {
  constructor() {
    this.defaultConfig = null;
    this.clientConfigCache = new Map();
    this.cacheMaxAge = 60 * 1000; // 1 minute cache
  }

  /**
   * Initialize the service - load default config from database
   */
  async initialize() {
    try {
      this.defaultConfig = await PlatformConfig.getDefaultPromptConfig();
      log.info('Prompt service initialized with default config');
    } catch (error) {
      log.warn('Failed to load prompt config from database, using hardcoded defaults', error.message);
      this.defaultConfig = PlatformConfig.getHardcodedDefaults();
    }
  }

  /**
   * Get the default platform-wide prompt config
   * @returns {Object} Default prompt config
   */
  async getDefaultConfig() {
    if (!this.defaultConfig) {
      await this.initialize();
    }
    return this.defaultConfig;
  }

  /**
   * Get prompt config for a specific client
   * Merges client config with platform defaults
   * @param {Object} client - Client object with prompt_config field
   * @returns {Object} Merged prompt config
   */
  async getClientConfig(client) {
    if (!this.defaultConfig) {
      await this.initialize();
    }

    // If client has no custom config, return defaults
    const clientConfig = client.prompt_config || {};
    if (Object.keys(clientConfig).length === 0) {
      return this.defaultConfig;
    }

    // Merge client config with defaults (client overrides defaults)
    return this.mergeConfigs(this.defaultConfig, clientConfig);
  }

  /**
   * Merge two configs - child overrides parent
   * @param {Object} parent - Default/parent config
   * @param {Object} child - Override/child config
   * @returns {Object} Merged config
   */
  mergeConfigs(parent, child) {
    const merged = { ...parent };

    for (const [key, value] of Object.entries(child)) {
      if (value === null || value === undefined) {
        continue; // Skip null/undefined - keep parent value
      }

      if (Array.isArray(value)) {
        // Arrays are replaced entirely (not merged)
        merged[key] = value;
      } else if (typeof value === 'object' && typeof parent[key] === 'object') {
        // Recursively merge objects
        merged[key] = this.mergeConfigs(parent[key], value);
      } else {
        // Primitive values are replaced
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Build the system prompt from config
   * All text is now configurable - no hardcoded strings
   * @param {Object} client - Client object
   * @param {Object} config - Prompt config (optional, will be fetched if not provided)
   * @returns {String} Generated system prompt
   */
  async buildSystemPrompt(client, config = null) {
    const promptConfig = config || await this.getClientConfig(client);
    const language = client.language || 'en';

    // Build intro from configurable template
    const introTemplate = promptConfig.intro_template || 'You are a friendly customer support assistant for {client_name}.';
    let prompt = introTemplate.replace('{client_name}', client.name);

    // Add reasoning process if enabled
    if (promptConfig.reasoning_enabled !== false && promptConfig.reasoning_steps?.length > 0) {
      prompt += '\n\n## YOUR REASONING PROCESS (follow these steps internally before responding)\n';

      promptConfig.reasoning_steps.forEach((step, index) => {
        prompt += `\n**Step ${index + 1}: ${step.title}**\n${step.instruction}\n`;
      });
    }

    // Add response style instructions (all from config)
    if (promptConfig.response_style) {
      const style = promptConfig.response_style;
      const toneInstructions = promptConfig.tone_instructions || {};
      const formalityInstructions = promptConfig.formality_instructions || {};

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
    if (promptConfig.tool_rules?.length > 0) {
      prompt += '\n## TOOL USAGE RULES\n';
      promptConfig.tool_rules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`;
      });
    }

    // Add tool format instructions from config
    const toolFormat = promptConfig.tool_format_template || 'USE_TOOL: tool_name\nPARAMETERS: {"key": "value"}';
    prompt += `\n## TOOL FORMAT (for models without native function calling)\n${toolFormat}\n`;

    // Add after tool results instructions from config
    const toolResultInstruction = promptConfig.tool_result_instruction || 'Summarize the result naturally for the customer. Do not expose raw data or JSON.';
    prompt += `\n## AFTER RECEIVING TOOL RESULTS\n${toolResultInstruction}`;

    // Add custom instructions if any
    if (promptConfig.custom_instructions) {
      prompt += `\n\n## ADDITIONAL INSTRUCTIONS\n${promptConfig.custom_instructions}`;
    }

    // Add language instruction for non-English (all from config)
    if (language !== 'en') {
      const languageNames = promptConfig.language_names || {};
      const langName = languageNames[language] || language;
      const langTemplate = promptConfig.language_instruction_template ||
        'You MUST respond in {language_name}. Use natural, conversational {language_name}. All your responses must be in this language.';
      const langInstruction = langTemplate.replace(/{language_name}/g, langName);
      prompt += `\n\n## LANGUAGE REQUIREMENT\n${langInstruction}`;
    }

    return prompt;
  }

  /**
   * Get tool guidance text for native function calling providers
   * @returns {String} Tool guidance to append to tool descriptions
   */
  async getToolGuidance() {
    const config = await this.getDefaultConfig();
    return config.tool_guidance || 'BEFORE CALLING: (1) Verify the user actually needs this external data, (2) Confirm you have ALL required parameters from user input - not placeholders, (3) Check you have not already called this with the same parameters.';
  }

  /**
   * Refresh the default config from database
   */
  async refreshDefaultConfig() {
    try {
      this.defaultConfig = await PlatformConfig.getDefaultPromptConfig();
      log.info('Default prompt config refreshed');
    } catch (error) {
      log.error('Failed to refresh prompt config', error);
    }
  }

  /**
   * Update the default platform config
   * @param {Object} config - New config
   */
  async updateDefaultConfig(config) {
    await PlatformConfig.setDefaultPromptConfig(config);
    this.defaultConfig = config;
    log.info('Default prompt config updated');
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.clientConfigCache.clear();
    this.adaptiveConfig = null;
  }

  /**
   * Get adaptive mode prompt configuration
   * @returns {Object} Adaptive mode config
   */
  async getAdaptiveConfig() {
    if (!this.adaptiveConfig) {
      try {
        this.adaptiveConfig = await PlatformConfig.getAdaptivePromptConfig();
      } catch (error) {
        log.warn('Failed to load adaptive config, using defaults', error.message);
        this.adaptiveConfig = PlatformConfig.getAdaptiveDefaults();
      }
    }
    return this.adaptiveConfig;
  }

  /**
   * Update adaptive mode prompt configuration
   * @param {Object} config - New config
   */
  async updateAdaptiveConfig(config) {
    await PlatformConfig.setAdaptivePromptConfig(config);
    this.adaptiveConfig = config;
    log.info('Adaptive prompt config updated');
  }

  /**
   * Build adaptive mode system prompt from config
   * @param {Object} client - Client object
   * @param {Array} tools - Available tools with schemas
   * @returns {String} Generated system prompt
   */
  async buildAdaptivePrompt(client, tools = []) {
    const config = await this.getAdaptiveConfig();
    const language = client.language || 'en';

    // Build intro from configurable template
    let prompt = (config.intro_template || 'You are a customer support assistant for {client_name}.')
      .replace('{client_name}', client.name);

    // Add custom AI instructions if available
    if (client.business_info?.ai_instructions) {
      prompt += `\n\n${client.business_info.ai_instructions}`;
    }

    // Add current date/time
    const now = new Date();
    prompt += `\n\nCurrent date/time: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    // Format tool descriptions
    const toolDescriptions = tools.map(t => {
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
    }).join('\n\n');

    // Build reasoning section
    const reasoningSteps = config.reasoning_steps || [];
    let reasoningSection = '';
    if (reasoningSteps.length > 0) {
      reasoningSection = `\n<reasoning>
${reasoningSteps.map(s => `${s.title}: [${s.instruction}]`).join('\n')}
</reasoning>`;
    }

    // Build context keys section
    const contextKeys = config.context_keys || [];
    let contextSection = '';
    if (contextKeys.length > 0) {
      contextSection = `\n**Context Fetching**: Use needs_more_context to request:
${contextKeys.map(c => `- "${c.key}" - ${c.description}`).join('\n')}`;
    }

    // Build tool rules section
    const toolRules = config.tool_rules || [];
    let rulesSection = '';
    if (toolRules.length > 0) {
      rulesSection = `\n\n**Rules**:
${toolRules.map(r => `- ${r}`).join('\n')}`;
    }

    // Build assessment section
    const assessmentExample = `{
  "confidence": 8,
  "tool_call": "tool_name",
  "tool_params": {},
  "missing_params": [],
  "is_destructive": false,
  "needs_confirmation": false,
  "needs_more_context": []
}`;

    // Assemble the full prompt
    prompt += `

## INSTRUCTIONS

After your response, include reasoning and assessment blocks (English only):
${reasoningSection}

<assessment>
${assessmentExample}
</assessment>
${contextSection}

**Tools**:
${toolDescriptions}
${rulesSection}`;

    // Add language instruction for non-English
    if (language !== 'en') {
      const languageNames = {
        'he': 'Hebrew (עברית)',
        'es': 'Spanish (Español)',
        'fr': 'French (Français)',
        'de': 'German (Deutsch)',
        'ar': 'Arabic (العربية)',
        'ru': 'Russian (Русский)'
      };
      const langName = languageNames[language] || language;
      prompt += `\n\n**Language**: Respond in ${langName}. Assessment must remain in English.`;
    }

    return prompt;
  }
}

// Export singleton instance
const promptService = new PromptService();
export default promptService;
