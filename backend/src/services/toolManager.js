import { ClientTool } from '../models/ClientTool.js';
import llmService from './llmService.js';
import { redisClient } from '../redis.js';
import { CACHE } from '../config/constants.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ToolManager');

/**
 * Tool Manager Service
 *
 * Responsibilities:
 * - Load tool definitions from database
 * - Format tools for LLM function calling (Claude/OpenAI native, Ollama via prompts)
 * - Validate tool schemas
 * - Parse tool calls from LLM responses
 * - Cache tool lists for performance
 */

class ToolManager {
  /**
   * Get all enabled tools for a client (with Redis caching)
   * @param {Number} clientId - Client ID
   * @returns {Array} Tools with full definitions
   */
  async getClientTools(clientId) {
    try {
      // Try to get from cache first
      const cacheKey = `${CACHE.PREFIX_TOOLS}${clientId}`;
      const cachedTools = await redisClient.get(cacheKey);

      if (cachedTools) {
        log.debug('Tool list loaded from cache', { clientId });
        return JSON.parse(cachedTools);
      }

      // Cache miss - fetch from database
      log.debug('Tool list cache miss - fetching from database', { clientId });
      const tools = await ClientTool.getEnabledTools(clientId);

      // Store in cache for 5 minutes
      await redisClient.setex(cacheKey, CACHE.TOOL_LIST_CACHE_TTL, JSON.stringify(tools));

      return tools;
    } catch (error) {
      log.error('Error loading client tools', error);
      throw new Error('Failed to load tools for client');
    }
  }

  /**
   * Clear tool cache for a specific client (call when tools are updated)
   * @param {Number} clientId - Client ID
   */
  async clearToolCache(clientId) {
    try {
      const cacheKey = `${CACHE.PREFIX_TOOLS}${clientId}`;
      await redisClient.del(cacheKey);
      log.info('Tool cache cleared', { clientId });
    } catch (error) {
      log.error('Error clearing tool cache', error);
    }
  }

  /**
   * Format tools for LLM based on provider capabilities
   * @param {Array} tools - Raw tool definitions from database
   * @param {String} provider - LLM provider (claude, openai, ollama)
   * @returns {Array|String} Formatted tools (array for native function calling, string for prompt engineering)
   */
  formatToolsForLLM(tools, provider = llmService.provider) {
    if (!tools || tools.length === 0) {
      return provider === 'ollama' ? '' : [];
    }

    // Use native function calling for Claude, Groq, and OpenAI
    if (llmService.supportsNativeFunctionCalling(provider)) {
      return this.formatForNativeFunctionCalling(tools, provider);
    }

    // Use prompt engineering for Ollama
    return this.formatForPromptEngineering(tools);
  }

  /**
   * Format tools for native function calling (Claude/OpenAI/Groq)
   * @param {Array} tools - Tool definitions
   * @param {String} provider - Provider name
   * @returns {Array} Formatted tool definitions
   */
  formatForNativeFunctionCalling(tools, provider) {
    // Generate current date context for tools with date parameters
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayIso = `${year}-${month}-${day}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    return tools.map(tool => {
      let description = tool.description || `Execute ${tool.tool_name} action`;

      // Check if tool has date parameters and add context
      const hasDateParam = tool.parameters_schema?.properties &&
        Object.keys(tool.parameters_schema.properties).some(key =>
          key.toLowerCase().includes('date')
        );

      if (hasDateParam) {
        description += ` [DATES: today=${todayIso}, tomorrow=${tomorrowIso}. Use YYYY-MM-DD format.]`;
      }

      const formatted = {
        name: tool.tool_name,
        description,
        parameters: tool.parameters_schema || {
          type: 'object',
          properties: {},
          required: []
        }
      };

      // Add input_schema key for Claude (different from OpenAI)
      if (provider === 'claude') {
        return {
          name: formatted.name,
          description: formatted.description,
          input_schema: formatted.parameters
        };
      }

      // OpenAI format (and fallback)
      return formatted;
    });
  }

  /**
   * Format tools for prompt engineering (Ollama)
   * Returns a text description to add to system prompt
   * Aligned with the guided reasoning approach
   * @param {Array} tools - Tool definitions
   * @returns {String} Tool descriptions for system prompt
   */
  formatForPromptEngineering(tools) {
    if (!tools || tools.length === 0) {
      return '';
    }

    // Build detailed tool descriptions
    const toolDescriptions = tools.map(tool => {
      const params = tool.parameters_schema?.properties || {};
      const required = tool.parameters_schema?.required || [];

      // Build parameter list with types
      const paramList = Object.entries(params).map(([name, schema]) => {
        const isRequired = required.includes(name);
        const type = schema.type || 'string';
        return `  - ${name} (${type})${isRequired ? ' [REQUIRED]' : ''}`;
      }).join('\n');

      return `**${tool.tool_name}**
${tool.description || 'No description'}
Parameters:
${paramList || '  (no parameters)'}`;
    }).join('\n\n');

    // Build example based on first tool
    const firstTool = tools[0];
    const exampleParams = {};
    const required = firstTool?.parameters_schema?.required || [];
    required.forEach(key => {
      exampleParams[key] = '<actual_value>';
    });

    return `

## AVAILABLE TOOLS

${toolDescriptions}

## TOOL CALLING DECISION TREE

Before calling a tool, verify:
1. Does the user's request actually need external data?
2. Do I have ALL required parameters from the user?
3. Have I already called this tool with these parameters?

If YES to #1, YES to #2, and NO to #3 → Call the tool
Otherwise → Ask for missing info OR respond from context

## TOOL CALL FORMAT

USE_TOOL: ${firstTool?.tool_name || 'tool_name'}
PARAMETERS: ${JSON.stringify(exampleParams).replace(/<actual_value>/g, '"actual_value"')}

IMPORTANT: Replace placeholder values with REAL data from the user. Never use "value", "example", or similar placeholders.`;
  }

  /**
   * Parse tool calls from LLM response (for Ollama prompt engineering)
   * @param {String} content - LLM response content
   * @returns {Array|null} Parsed tool calls or null
   */
  parseToolCallsFromContent(content) {
    try {
      const toolCalls = [];
      const addedToolKeys = new Set(); // Track to avoid duplicates

      // Helper to add tool call without duplicates
      const addToolCall = (name, parameters) => {
        const key = `${name}:${JSON.stringify(parameters)}`;
        if (!addedToolKeys.has(key) && Object.keys(parameters).length > 0) {
          addedToolKeys.add(key);
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.toLowerCase(),
            arguments: parameters
          });
          return true;
        }
        return false;
      };

      // Pattern 1: USE_TOOL: followed by PARAMETERS: (can be anywhere in text, same or next line)
      // This catches: "USE_TOOL: get_order_status PARAMETERS: {...}" embedded in prose
      const useToolRegex = /USE_TOOL:\s*(\w+)\s*(?:\n\s*)?PARAMETERS:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/gi;
      let match;
      while ((match = useToolRegex.exec(content)) !== null) {
        const toolName = match[1].trim();
        try {
          // Try to extract complete JSON object (handle cases where there might be trailing text like ". Waits for response.")
          let jsonStr = match[2];
          // Find the matching closing brace for the JSON object
          let braceCount = 0;
          let jsonEnd = -1;
          for (let i = 0; i < jsonStr.length; i++) {
            if (jsonStr[i] === '{') braceCount++;
            if (jsonStr[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          if (jsonEnd > 0) {
            jsonStr = jsonStr.substring(0, jsonEnd);
          }
          const parameters = JSON.parse(jsonStr);
          log.debug('Parsed tool call', { toolName, parameters });
          addToolCall(toolName, parameters);
        } catch (e) {
          log.warn('Failed to parse tool parameters', { toolName, rawParams: match[2], error: e.message });
        }
      }

      // Pattern 2: Multi-line format (USE_TOOL: on one line, PARAMETERS: on next)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for USE_TOOL: anywhere in the line
        const useToolMatch = line.match(/USE_TOOL:\s*(\w+)/i);
        if (useToolMatch) {
          const toolName = useToolMatch[1].trim();

          // Check for PARAMETERS: on the same line (after USE_TOOL:)
          const sameLineParams = line.match(/PARAMETERS:\s*(\{[^}]+\})/i);
          if (sameLineParams) {
            try {
              const parameters = JSON.parse(sameLineParams[1]);
              addToolCall(toolName, parameters);
            } catch {
              log.warn('Failed to parse same-line parameters', { toolName, rawParams: sameLineParams[1] });
            }
            continue;
          }

          // Look for PARAMETERS: on the next line
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const nextLineParams = nextLine.match(/PARAMETERS:\s*(\{[^}]+\})/i);
            if (nextLineParams) {
              try {
                const parameters = JSON.parse(nextLineParams[1]);
                addToolCall(toolName, parameters);
              } catch {
                log.warn('Failed to parse next-line parameters', { toolName, rawParams: nextLineParams[1] });
              }
            }
          }
        }
      }

      // Pattern 3: tool_name: {...} format (fallback - AI sometimes outputs this)
      // Matches: "book_appointment: {...}" or "get_order_status: {...}"
      const toolNameColonRegex = /(\w+):\s*(\{[^}]+\})/g;
      while ((match = toolNameColonRegex.exec(content)) !== null) {
        const toolName = match[1];
        // Check if this looks like a tool name (contains underscore or matches known tools)
        if (toolName.includes('_') || ['book_appointment', 'get_order_status', 'check_inventory'].includes(toolName.toLowerCase())) {
          try {
            const parameters = JSON.parse(match[2]);
            addToolCall(toolName, parameters);
          } catch {
            // Try to extract JSON from the line
            const jsonMatch = match[2].match(/\{.*\}/);
            if (jsonMatch) {
              try {
                const parameters = JSON.parse(jsonMatch[0]);
                addToolCall(toolName, parameters);
              } catch {
                log.warn('Failed to parse fallback parameters', { toolName, rawParams: match[2] });
              }
            }
          }
        }
      }

      // Pattern 4: Single-line "Using the tool: TOOL_NAME - PARAMETERS: {...}"
      const singleLineRegex = /using the tool:\s*([A-Z_]+)\s*-\s*PARAMETERS:\s*(\{[^}]+\})/gi;
      while ((match = singleLineRegex.exec(content)) !== null) {
        const toolName = match[1];
        try {
          const parameters = JSON.parse(match[2]);
          addToolCall(toolName, parameters);
        } catch {
          log.warn('Failed to parse multiline parameters', { toolName, rawParams: match[2] });
        }
      }

      return toolCalls.length > 0 ? toolCalls : null;
    } catch (error) {
      log.error('Error parsing tool calls from content', error);
      return null;
    }
  }

  /**
   * Validate tool schema
   * @param {Object} schema - JSON schema for tool parameters
   * @returns {Boolean} Valid or not
   */
  validateToolSchema(schema) {
    if (!schema) return true; // No schema means no parameters required

    try {
      // Basic validation - check for required properties
      if (schema.type !== 'object') {
        log.warn('Tool schema should have type "object"', { schema });
        return false;
      }

      if (schema.properties && typeof schema.properties !== 'object') {
        log.warn('Tool schema properties should be an object', { schema });
        return false;
      }

      if (schema.required && !Array.isArray(schema.required)) {
        log.warn('Tool schema required should be an array', { schema });
        return false;
      }

      return true;
    } catch (error) {
      log.error('Schema validation error', error);
      return false;
    }
  }

  /**
   * Get tool by name from client's enabled tools
   * @param {Number} clientId - Client ID
   * @param {String} toolName - Tool name
   * @returns {Object|null} Tool definition
   */
  async getToolByName(clientId, toolName) {
    try {
      const tools = await this.getClientTools(clientId);
      return tools.find(t => t.tool_name === toolName) || null;
    } catch (error) {
      log.error('Error getting tool', { toolName, error });
      return null;
    }
  }

  /**
   * Validate tool call arguments against schema
   * Also performs type coercion (e.g., "1" -> 1) before validation
   * @param {Object} tool - Tool definition with parameters_schema
   * @param {Object} args - Arguments provided in tool call (MUTATED with coerced values)
   * @returns {Object} { valid: Boolean, errors: Array, coercedArgs: Object }
   */
  validateToolArguments(tool, args) {
    const schema = tool.parameters_schema;
    const errors = [];

    if (!schema) {
      return { valid: true, errors: [], coercedArgs: args };
    }

    // Check required parameters
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in args)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Type coercion and validation
    if (schema.properties) {
      for (const [paramName, paramValue] of Object.entries(args)) {
        const paramSchema = schema.properties[paramName];

        if (!paramSchema) {
          // Allow unknown parameters - don't fail, just skip validation
          continue;
        }

        const expectedType = paramSchema.type;
        let actualType = typeof paramValue;

        // TYPE COERCION: LLMs often output numbers as strings
        if (expectedType === 'number' && actualType === 'string') {
          const num = parseFloat(paramValue);
          if (!isNaN(num)) {
            args[paramName] = num; // Mutate the args object
            actualType = 'number';
            log.debug('Coerced string to number', { paramName, original: paramValue, coerced: num });
          }
        } else if (expectedType === 'integer' && actualType === 'string') {
          const num = parseInt(paramValue, 10);
          if (!isNaN(num)) {
            args[paramName] = num;
            actualType = 'number';
            log.debug('Coerced string to number', { paramName, original: paramValue, coerced: num });
          }
        } else if (expectedType === 'boolean' && actualType === 'string') {
          const lower = paramValue.toLowerCase();
          if (lower === 'true' || lower === '1' || lower === 'yes') {
            args[paramName] = true;
            actualType = 'boolean';
          } else if (lower === 'false' || lower === '0' || lower === 'no') {
            args[paramName] = false;
            actualType = 'boolean';
          }
        }

        // Type checking (after coercion)
        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Parameter ${paramName} should be a string`);
        } else if ((expectedType === 'number' || expectedType === 'integer') && actualType !== 'number') {
          errors.push(`Parameter ${paramName} should be a number`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Parameter ${paramName} should be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
          errors.push(`Parameter ${paramName} should be an array`);
        } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue))) {
          errors.push(`Parameter ${paramName} should be an object`);
        }

        // PLACEHOLDER VALUE DETECTION: Handle common placeholder/garbage values
        if (typeof paramValue === 'string') {
          const placeholderError = this.detectPlaceholderValue(paramName, paramValue);
          if (placeholderError) {
            // Check if this is a required parameter
            const isRequired = schema.required && schema.required.includes(paramName);
            if (isRequired) {
              // Required parameters with placeholders are errors
              errors.push(placeholderError);
            } else {
              // Optional parameters with placeholders should be removed
              log.debug('Removing optional placeholder parameter', { paramName, paramValue });
              delete args[paramName];
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      coercedArgs: args
    };
  }

  /**
   * Detect if a parameter value is a placeholder or garbage value
   * @param {String} paramName - Parameter name
   * @param {String} value - Parameter value
   * @returns {String|null} Error message if placeholder detected, null otherwise
   */
  detectPlaceholderValue(paramName, value) {
    if (typeof value !== 'string') return null;

    // Empty or whitespace-only values
    if (!value || value.trim() === '') {
      return `Parameter '${paramName}' is empty - please provide actual data`;
    }

    const lowerValue = value.toLowerCase().trim();

    // Exact matches - common placeholder values
    const exactPlaceholders = [
      'required', 'optional', 'string', 'number', 'boolean', 'value', 'example',
      'placeholder', 'todo', 'tbd', 'null', 'undefined', 'none', 'n/a', 'na',
      'test', 'testing', 'sample', 'dummy', 'fake', 'mock', 'default',
      'your_value', 'your_name', 'your_email', 'your_phone', 'user_input',
      'enter_value', 'insert_value', 'add_value', 'fill_in', 'replace_me',
      'xxx', 'yyy', 'zzz', 'abc', 'aaa', 'bbb', 'ccc', 'asdf', 'qwerty',
      'foo', 'bar', 'baz', 'foobar', 'lorem', 'ipsum',
      // AI-generated placeholders
      'not provided', 'not_provided', 'notprovided', 'unknown', 'unspecified',
      'not specified', 'not_specified', 'missing', 'empty', 'blank',
      'to be provided', 'tba', 'to be announced', 'pending', 'awaiting',
      'user', 'customer', 'guest', 'anonymous',
    ];

    if (exactPlaceholders.includes(lowerValue)) {
      return `Parameter '${paramName}' contains placeholder value '${value}' - please provide actual data`;
    }

    // Pattern-based placeholder detection (catches creative AI variations)
    const placeholderPhrasePatterns = [
      /^not\s+\w+$/i,           // "not given", "not provided", "not specified", "not available"
      /^no\s+\w+$/i,            // "no name", "no email", "no data"
      /^needs?\s+\w+$/i,        // "need info", "needs input"
      /^requires?\s+\w+$/i,     // "require input", "requires data"
      /^waiting\s+(for\s+)?\w+$/i,  // "waiting for input", "waiting input"
      /^will\s+(be\s+)?\w+$/i,  // "will provide", "will be provided"
      /^to\s+be\s+\w+$/i,       // "to be provided", "to be specified"
      /^\[.+\]$/,               // [any bracketed text]
      /^<.+>$/,                 // <any angle bracket text>
      /^\{.+\}$/,               // {any curly brace text}
    ];

    for (const pattern of placeholderPhrasePatterns) {
      if (pattern.test(lowerValue)) {
        return `Parameter '${paramName}' contains placeholder '${value}' - ask the user for real data`;
      }
    }

    // Pattern matches - template-style placeholders
    const placeholderPatterns = [
      /^<.*>$/,           // <value>, <name>, <actual_value>
      /^\[.*\]$/,         // [value], [required]
      /^\{.*\}$/,         // {value}, {name}
      /^{{.*}}$/,         // {{value}}, {{name}}
      /^\$\{.*\}$/,       // ${value}
      /^%.*%$/,           // %value%
      /^_+$/,             // ___, ____
      /^\*+$/,            // ***, ****
      /^\.{3,}$/,         // ..., ....
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(value.trim())) {
        return `Parameter '${paramName}' contains template placeholder '${value}' - please provide actual data`;
      }
    }

    // Check for values that look like schema descriptions
    const schemaDescPatterns = [
      /^(the )?customer'?s? (name|email|phone|address|id)/i,
      /^(the )?(name|email|phone|date|time|id) (of|for) (the )?(customer|user|order)/i,
      /^(a |an )?(valid )?(name|email|phone|date|time|address)/i,
      /^type:/i,
      /^format:/i,
      /^description:/i,
    ];

    for (const pattern of schemaDescPatterns) {
      if (pattern.test(value.trim())) {
        return `Parameter '${paramName}' appears to contain a description rather than actual data: '${value}'`;
      }
    }

    // Check for obviously invalid specific parameter values
    const paramLower = paramName.toLowerCase();

    // Email validation
    if (paramLower.includes('email')) {
      if (!value.includes('@') || !value.includes('.')) {
        // Could be placeholder if it doesn't look like an email at all
        if (/^[a-z_]+$/i.test(value)) {
          return `Parameter '${paramName}' value '${value}' doesn't look like a valid email address`;
        }
      }
    }

    // Phone validation - reject if it's just a word
    if (paramLower.includes('phone') || paramLower.includes('tel')) {
      if (!/\d/.test(value)) {
        return `Parameter '${paramName}' value '${value}' doesn't contain any digits - please provide a valid phone number`;
      }
    }

    // Date validation - reject if it's just a word (but allow "today", "tomorrow" etc)
    if (paramLower.includes('date')) {
      const validDateWords = ['today', 'tomorrow', 'yesterday', 'now'];
      if (!/\d/.test(value) && !validDateWords.includes(lowerValue)) {
        // Check if it's a placeholder word
        if (/^[a-z_]+$/i.test(value) && value.length < 15) {
          return `Parameter '${paramName}' value '${value}' doesn't look like a valid date`;
        }
      }

      // Check for hallucinated dates (dates more than 1 year in the past)
      const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        const inputDate = new Date(value);
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        if (inputDate < oneYearAgo) {
          return `Parameter '${paramName}' value '${value}' appears to be a hallucinated date (more than 1 year in the past). Use 'today' or ask the user for the actual date.`;
        }
      }
    }

    // Time validation
    if (paramLower.includes('time') && !paramLower.includes('datetime')) {
      // Should contain a colon or digits for time
      if (!/\d/.test(value) && !/:/.test(value)) {
        if (/^[a-z_]+$/i.test(value) && value.length < 15) {
          return `Parameter '${paramName}' value '${value}' doesn't look like a valid time`;
        }
      }
    }

    return null;
  }

  /**
   * Format tool result for LLM consumption
   * @param {String} toolName - Name of the tool
   * @param {Object} result - Result from n8n execution
   * @param {Boolean} success - Whether execution was successful
   * @returns {String} Formatted result message
   */
  formatToolResult(toolName, result, success) {
    if (!success) {
      return `Tool execution failed: ${result.error || 'Unknown error'}`;
    }

    // If result is already a string, return it
    if (typeof result === 'string') {
      return result;
    }

    // If result is an object, format it nicely
    if (typeof result === 'object') {
      // Check for common result patterns
      if (result.message) {
        return result.message;
      }
      if (result.data) {
        return JSON.stringify(result.data, null, 2);
      }
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }
}

// Export singleton instance
const toolManager = new ToolManager();
export default toolManager;
