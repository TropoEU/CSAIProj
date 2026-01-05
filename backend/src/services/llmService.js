import { Anthropic } from '@anthropic-ai/sdk';
import { OLLAMA_CONFIG } from '../config.js';

/**
 * LLM Service - Multi-Provider Architecture
 * Supports Ollama (dev), Groq (dev/prod), OpenAI (prod), and Claude (prod)
 *
 * Features:
 * - Provider abstraction
 * - Token counting and cost tracking
 * - Streaming support
 * - Tool/function calling
 * - Error handling and retries
 */

class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'ollama'; // ollama | groq | openai | claude
    this.model = this.getModelForProvider();
    this.client = this.initializeClient();

    // Log available providers (provider is set per-client, not globally)
    const providers = ['ollama', 'groq', 'claude', 'openai'];
    const defaultProvider = this.provider;
    console.log(`🤖 LLM Service ready - Supports: ${providers.join(', ')} (default: ${defaultProvider})`);
    
    // Log Ollama URL if available (since it's commonly used for development)
    // Keep model name very short to prevent console formatting issues
    if (OLLAMA_CONFIG.url) {
      const modelName = OLLAMA_CONFIG.model;
      // Extract just the base model name (before first dot) to keep it short
      const shortModel = modelName.includes('.') 
        ? modelName.split('.')[0] 
        : modelName.length > 20
        ? modelName.substring(0, 17) + '...'
        : modelName;
      console.log(`   🦙 Ollama: ${OLLAMA_CONFIG.url} (${shortModel})`);
    }
  }

  /**
   * Get the appropriate model based on provider
   */
  getModelForProvider() {
    const models = {
      ollama: process.env.OLLAMA_MODEL || 'llama2',
      groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      openai: process.env.OPENAI_MODEL || 'gpt-4o',
      claude: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
    };
    return models[this.provider];
  }

  /**
   * Initialize the client based on provider
   */
  initializeClient() {
    switch (this.provider) {
      case 'ollama':
        return null; // Ollama uses direct HTTP requests

      case 'groq':
        return null; // Groq uses direct HTTP requests

      case 'openai':
        // Will implement OpenAI SDK
        return null;

      case 'claude':
        return new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });

      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  /**
   * Generate a chat completion
   *
   * @param {Array} messages - Array of message objects [{role, content}]
   * @param {Object} options - Optional parameters
   * @param {Array} options.tools - Tool definitions for function calling
   * @param {Boolean} options.stream - Enable streaming
   * @param {Number} options.maxTokens - Max tokens to generate
   * @param {Number} options.temperature - Sampling temperature
   * @param {String} options.model - Override model for this request (per-client)
   * @param {String} options.provider - Override provider for this request (per-client)
   * @returns {Object} Response with content, tokens, and tool calls
   */
  async chat(messages, options = {}) {
    const {
      tools = null,
      stream = false,
      maxTokens = 4096,
      temperature = 0.7,
      model = null,      // Per-client model override
      provider = null    // Per-client provider override
    } = options;
    
    // Use per-request overrides or fall back to default
    const activeProvider = provider || this.provider;
    const activeModel = model || this.model;

    console.log(`[LLMService] Calling ${activeProvider.toUpperCase()} API with model: ${activeModel || 'default'}`);

    try {
      switch (activeProvider) {
        case 'ollama':
          return await this.ollamaChat(messages, { tools, stream, maxTokens, temperature, model: activeModel });

        case 'groq':
          return await this.groqChat(messages, { tools, stream, maxTokens, temperature, model: activeModel });

        case 'openai':
          return await this.openaiChat(messages, { tools, stream, maxTokens, temperature, model: activeModel });

        case 'claude':
          return await this.claudeChat(messages, { tools, stream, maxTokens, temperature, model: activeModel });

        default:
          throw new Error(`Unsupported provider: ${activeProvider}`);
      }
    } catch (error) {
      console.error('LLM Service Error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Ollama Implementation
   */
  async ollamaChat(messages, options) {
    const ollamaUrl = OLLAMA_CONFIG.url;
    const modelToUse = options.model || OLLAMA_CONFIG.model;

    const requestBody = {
      model: modelToUse,
      messages: this.formatMessagesForOllama(messages),
      stream: options.stream,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens
      }
    };

    // Note: Function calling support in Ollama is experimental and model-dependent
    // Only add tools if explicitly supported by the model
    // For now, we skip tool definitions for Ollama to avoid errors
    // Tools will be handled via prompt engineering instead
    if (options.tools && this.supportsNativeFunctionCalling()) {
      requestBody.tools = this.formatToolsForOllama(options.tools);
    }

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Ollama token counting:
    // - prompt_eval_count: tokens in prompt that were actually evaluated (excludes cached tokens)
    // - eval_count: tokens generated in the response
    // For accurate billing, we need to count ALL tokens sent, not just newly evaluated ones
    // However, Ollama doesn't provide the full prompt token count directly
    // We'll use prompt_eval_count + eval_count, but note that this may undercount if caching is used
    
    // Ollama token counting:
    // - prompt_eval_count: tokens in prompt that were actually evaluated (excludes cached tokens)
    // - eval_count: tokens generated in the response
    // For billing, we want to count ALL tokens sent, but Ollama's prompt_eval_count only counts newly evaluated tokens
    // If prompt_eval_count is 0, it means the entire prompt was cached (common for system prompts)
    // In this case, we should NOT count the cached tokens again - they were already counted in the first request
    
    const promptEvalCount = data.prompt_eval_count || 0;
    const evalCount = data.eval_count || 0;
    
    // Use prompt_eval_count as-is (even if 0 due to caching)
    // This is correct because:
    // 1. First request: prompt_eval_count includes all tokens (system prompt + messages)
    // 2. Subsequent requests: prompt_eval_count is 0 if cached, or only counts new tokens
    // 3. We should only count tokens that were actually processed, not cached ones
    // 
    // However, if prompt_eval_count is 0 AND we have a substantial response, it's likely
    // that the prompt was cached. In this case, we should estimate based on the NEW content only.
    let estimatedInputTokens = promptEvalCount;
    
    // If prompt_eval_count is 0, it means the entire prompt was cached
    // In this case, we should NOT count input tokens (they were already counted in the first request)
    // Only count the output tokens (eval_count)
    // This is correct because:
    // - First request: prompt_eval_count includes all tokens (system prompt + messages)
    // - Subsequent requests: prompt_eval_count is 0 if cached, so we don't count them again
    // - We only count tokens that were actually processed in this request
    if (promptEvalCount === 0) {
      // Prompt was cached - don't count input tokens again
      estimatedInputTokens = 0;
    }

    return {
      content: data.message.content,
      role: data.message.role,
      toolCalls: data.message.tool_calls || null,
      tokens: {
        input: estimatedInputTokens || promptEvalCount,
        output: evalCount,
        total: (estimatedInputTokens || promptEvalCount) + evalCount
      },
      cost: 0, // Ollama is free
      model: modelToUse,
      provider: 'ollama'
    };
  }

  /**
   * Groq Implementation (OpenAI-compatible)
   */
  async groqChat(messages, options) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }

    const modelToUse = options.model || this.model;

    const requestBody = {
      model: modelToUse,
      messages: this.formatMessagesForGroq(messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream || false
    };

    // Add tools if provided (Groq supports OpenAI-style function calling)
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      requestBody.tools = this.formatToolsForGroq(options.tools);
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Extract tool calls if present
    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    })) || null;

    return {
      content: message.content || '',
      role: message.role,
      toolCalls: toolCalls,
      tokens: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens
      },
      cost: this.calculateGroqCost(data.usage),
      model: modelToUse,
      provider: 'groq',
      stopReason: choice.finish_reason
    };
  }

  /**
   * OpenAI Implementation
   */
  async openaiChat(_messages, _options) {
    // TODO: Implement OpenAI API integration
    // Will use official OpenAI SDK
    throw new Error('OpenAI provider not yet implemented');
  }

  /**
   * Claude Implementation (Anthropic API)
   */
  async claudeChat(messages, options) {
    const modelToUse = options.model || this.model;
    
    // Separate system message from other messages
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const requestParams = {
      model: modelToUse,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: this.formatMessagesForClaude(conversationMessages)
    };

    // Add system message if present
    if (systemMessage) {
      requestParams.system = systemMessage.content;
    }

    // Add tools if provided
    if (options.tools) {
      requestParams.tools = this.formatToolsForClaude(options.tools);
    }

    const response = await this.client.messages.create(requestParams);

    // Extract text content and tool calls
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const toolCalls = response.content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name,
        arguments: block.input
      }));

    return {
      content: textContent,
      role: response.role,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens
      },
      cost: this.calculateClaudeCost(response.usage),
      model: this.model,
      provider: 'claude',
      stopReason: response.stop_reason
    };
  }

  /**
   * Check if current model/provider supports native function calling
   * @param {String} provider - Optional provider to check (defaults to this.provider)
   */
  supportsNativeFunctionCalling(provider = null) {
    const providerToCheck = provider || this.provider;
    
    // Claude supports function calling
    if (providerToCheck === 'claude') return true;

    // Groq supports OpenAI-style function calling
    if (providerToCheck === 'groq') return true;

    // OpenAI supports function calling
    if (providerToCheck === 'openai') return true;

    // Ollama function calling is experimental and inconsistent
    // Return false for now - we'll use prompt engineering instead
    if (providerToCheck === 'ollama') return false;

    return false;
  }

  /**
   * Format messages for Ollama
   * Ollama doesn't support 'tool' role natively, so we format tool results
   * as clear assistant messages that the model can understand
   */
  formatMessagesForOllama(messages) {
    const formatted = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === 'tool') {
        // Convert tool result to a clear format the model understands
        // Make it look like a system notification about the tool result
        formatted.push({
          role: 'assistant',
          content: `[TOOL RESULT - USE THIS IN YOUR RESPONSE]\n${msg.content}\n[END TOOL RESULT - Now respond to the user using this information. Be brief and friendly.]`
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        // Skip assistant messages that just contain tool calls
        // The tool result will follow
        continue;
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return formatted;
  }

  /**
   * Format messages for Claude
   * Claude requires alternating user/assistant messages
   */
  formatMessagesForClaude(messages) {
    const formatted = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // System handled separately

      // Handle tool results
      if (msg.role === 'tool') {
        formatted.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content
          }]
        });
      }
      // Handle regular messages
      else {
        formatted.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    return formatted;
  }

  /**
   * Format messages for Groq (OpenAI-compatible)
   */
  formatMessagesForGroq(messages) {
    return messages.map(msg => {
      const formatted = {
        role: msg.role,
        content: msg.content || ''
      };

      // Handle tool calls in assistant messages
      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls.map(tc => {
          // If already in Groq format (has function.name), use as-is
          if (tc.function && tc.function.name) {
            return {
              id: tc.id,
              type: tc.type || 'function',
              function: {
                name: tc.function.name,
                arguments: typeof tc.function.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments)
              }
            };
          }
          // Otherwise, format from our internal format (tc.name)
          return {
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === 'string'
                ? tc.arguments
                : JSON.stringify(tc.arguments)
            }
          };
        });
      }

      // Handle tool results
      if (msg.role === 'tool') {
        formatted.role = 'tool';
        formatted.tool_call_id = msg.tool_call_id;
      }

      return formatted;
    });
  }

  /**
   * Format tools for Ollama
   */
  formatToolsForOllama(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Format tools for Groq (OpenAI-compatible)
   * Tool guidance is now configurable via prompt config
   * @param {Array} tools - Tool definitions
   * @param {String} toolGuidance - Optional guidance text from config
   */
  formatToolsForGroq(tools, toolGuidance = null) {
    if (!tools || !Array.isArray(tools)) {
      console.warn('[LLMService] formatToolsForGroq: tools is not an array', typeof tools, tools);
      return [];
    }

    const guidance = toolGuidance ? ` ${toolGuidance}` : '';

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: (tool.description || '') + guidance,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Format tools for Claude
   * Tool guidance is now configurable via prompt config
   * @param {Array} tools - Tool definitions
   * @param {String} toolGuidance - Optional guidance text from config
   */
  formatToolsForClaude(tools, toolGuidance = null) {
    const guidance = toolGuidance ? ` ${toolGuidance}` : '';

    return tools.map(tool => ({
      name: tool.name,
      description: (tool.description || '') + guidance,
      input_schema: tool.parameters
    }));
  }

  /**
   * Calculate cost for Claude API
   * Pricing as of 2024:
   * - Input: $3 per million tokens
   * - Output: $15 per million tokens
   */
  calculateClaudeCost(usage) {
    const inputCost = (usage.input_tokens / 1_000_000) * 3;
    const outputCost = (usage.output_tokens / 1_000_000) * 15;
    return inputCost + outputCost;
  }

  /**
   * Calculate cost for Groq API
   * Groq pricing (as of 2024):
   * - Most models are FREE during beta
   * - Future pricing TBD
   */
  calculateGroqCost(_usage) {
    // Currently free during beta
    // TODO: Update when Groq announces pricing
    return 0;
  }

  /**
   * Calculate cost for OpenAI API
   * TODO: Implement when OpenAI is added
   */
  calculateOpenAICost(usage) {
    // GPT-4o pricing (as of 2024):
    // - Input: $2.50 per million tokens
    // - Output: $10 per million tokens
    const inputCost = (usage.prompt_tokens / 1_000_000) * 2.5;
    const outputCost = (usage.completion_tokens / 1_000_000) * 10;
    return inputCost + outputCost;
  }

  /**
   * Parse self-assessment block from LLM response (Adaptive mode)
   * @param {string} response - Full LLM response with assessment block
   * @returns {Object} { visible_response, assessment } or { visible_response, assessment: null } if no assessment found
   */
  parseAssessment(response) {
    try {
      // Extract reasoning block (if present)
      const reasoningMatch = response.match(/<reasoning>\s*([\s\S]*?)\s*<\/reasoning>/i);
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;

      // Extract assessment block
      const assessmentMatch = response.match(/<assessment>\s*([\s\S]*?)\s*<\/assessment>/i);

      if (!assessmentMatch) {
        // No assessment block found - this is fine for standard mode or when critique is skipped
        return {
          visible_response: response.trim(),
          assessment: null,
          reasoning: null
        };
      }

      // Remove both reasoning and assessment blocks from visible response
      const visible_response = response
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/<assessment>[\s\S]*?<\/assessment>/gi, '')
        .trim();

      // Parse JSON assessment
      const assessmentJson = assessmentMatch[1].trim();

      // Remove JavaScript-style comments if present
      const cleanedJson = assessmentJson
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      const assessment = JSON.parse(cleanedJson);

      // Validate required fields
      const requiredFields = ['confidence', 'tool_call', 'tool_params', 'missing_params', 'is_destructive', 'needs_confirmation'];
      const missingFields = requiredFields.filter(field => !(field in assessment));

      if (missingFields.length > 0) {
        console.warn('[LLMService] Assessment missing fields:', missingFields);
        // Fill in defaults for missing fields
        if (!('confidence' in assessment)) assessment.confidence = 5;
        if (!('tool_call' in assessment)) assessment.tool_call = null;
        if (!('tool_params' in assessment)) assessment.tool_params = {};
        if (!('missing_params' in assessment)) assessment.missing_params = [];
        if (!('is_destructive' in assessment)) assessment.is_destructive = false;
        if (!('needs_confirmation' in assessment)) assessment.needs_confirmation = false;
        if (!('needs_more_context' in assessment)) assessment.needs_more_context = [];
      }

      // Validate types
      assessment.confidence = Math.min(10, Math.max(1, parseInt(assessment.confidence) || 5));
      assessment.tool_call = assessment.tool_call || null;
      assessment.tool_params = assessment.tool_params || {};
      assessment.missing_params = Array.isArray(assessment.missing_params) ? assessment.missing_params : [];
      assessment.is_destructive = Boolean(assessment.is_destructive);
      assessment.needs_confirmation = Boolean(assessment.needs_confirmation);
      assessment.needs_more_context = Array.isArray(assessment.needs_more_context) ? assessment.needs_more_context : [];

      return {
        visible_response,
        assessment,
        reasoning
      };
    } catch (error) {
      console.error('[LLMService] Failed to parse assessment:', error.message);
      // Return full response as visible if parsing fails
      return {
        visible_response: response.trim(),
        assessment: null,
        reasoning: null,
        parse_error: error.message
      };
    }
  }

  /**
   * Handle errors with retry logic
   */
  handleError(error) {
    if (error.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.status === 401) {
      return new Error('Invalid API key. Check your credentials.');
    }
    if (error.status === 500 || error.status === 503) {
      return new Error('LLM provider is temporarily unavailable. Please try again.');
    }
    return error;
  }

  /**
   * Retry wrapper for API calls
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;

        // Only retry on specific errors
        if (error.status === 429 || error.status === 503) {
          console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        } else {
          throw error;
        }
      }
    }
  }
}

// Export singleton instance
const llmService = new LLMService();
export default llmService;
