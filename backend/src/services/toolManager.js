import { ClientTool } from '../models/ClientTool.js';
import llmService from './llmService.js';

/**
 * Tool Manager Service
 *
 * Responsibilities:
 * - Load tool definitions from database
 * - Format tools for LLM function calling (Claude/OpenAI native, Ollama via prompts)
 * - Validate tool schemas
 * - Parse tool calls from LLM responses
 */

class ToolManager {
  /**
   * Get all enabled tools for a client
   * @param {Number} clientId - Client ID
   * @returns {Array} Tools with full definitions
   */
  async getClientTools(clientId) {
    try {
      const tools = await ClientTool.getEnabledTools(clientId);
      return tools;
    } catch (error) {
      console.error('Error loading client tools:', error);
      throw new Error('Failed to load tools for client');
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

    // Use native function calling for Claude and OpenAI
    if (llmService.supportsNativeFunctionCalling()) {
      return this.formatForNativeFunctionCalling(tools, provider);
    }

    // Use prompt engineering for Ollama
    return this.formatForPromptEngineering(tools);
  }

  /**
   * Format tools for native function calling (Claude/OpenAI)
   * @param {Array} tools - Tool definitions
   * @param {String} provider - Provider name
   * @returns {Array} Formatted tool definitions
   */
  formatForNativeFunctionCalling(tools, provider) {
    return tools.map(tool => {
      const formatted = {
        name: tool.tool_name,
        description: tool.description || `Execute ${tool.tool_name} action`,
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
   * @param {Array} tools - Tool definitions
   * @returns {String} Tool descriptions for system prompt
   */
  formatForPromptEngineering(tools) {
    if (!tools || tools.length === 0) {
      return '';
    }

    const toolDescriptions = tools.map(tool => {
      const params = tool.parameters_schema?.properties || {};
      const required = tool.parameters_schema?.required || [];

      let description = `\n### ${tool.tool_name}\n`;
      description += `${tool.description}\n`;

      if (Object.keys(params).length > 0) {
        description += '\nParameters:\n';
        Object.entries(params).forEach(([name, schema]) => {
          const isRequired = required.includes(name);
          const requiredTag = isRequired ? ' (required)' : ' (optional)';
          description += `  - ${name}${requiredTag}: ${schema.description || schema.type}\n`;
        });
      }

      description += `\nTo use this tool, you MUST respond with this EXACT format:\n`;
      description += `USE_TOOL: ${tool.tool_name}\n`;
      if (Object.keys(params).length > 0) {
        description += `PARAMETERS: ${JSON.stringify(params)}\n`;
      }

      return description;
    }).join('\n');

    return `
## Available Tools

You have access to the following tools. When you need real-time data, you MUST use the EXACT format shown below - DO NOT explain what you're doing, just output the format:

${toolDescriptions}

Example conversation:
User: "What's the status of order 12345?"
You: "USE_TOOL: get_order_status
PARAMETERS: {"orderNumber": "12345"}"

User: "Book an appointment for tomorrow at 2pm"
You: "USE_TOOL: book_appointment
PARAMETERS: {"date": "tomorrow", "time": "14:00"}"

CRITICAL RULES:
1. When you need real-time data, output ONLY the USE_TOOL format above
2. DO NOT say "I will use the tool" or "Let me check" - just output the format
3. After receiving tool results, then respond conversationally to the user
4. If you can answer from general knowledge, do so without tools
`;
  }

  /**
   * Parse tool calls from LLM response (for Ollama prompt engineering)
   * @param {String} content - LLM response content
   * @returns {Array|null} Parsed tool calls or null
   */
  parseToolCallsFromContent(content) {
    // Check if response contains tool usage pattern (multiple formats)
    if (!content.includes('USE_TOOL:') && !content.match(/using the tool:/i)) {
      return null;
    }

    try {
      const toolCalls = [];

      // Pattern 1: Multi-line format
      // USE_TOOL: tool_name
      // PARAMETERS: {...}
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('USE_TOOL:')) {
          const toolName = line.replace('USE_TOOL:', '').trim().toLowerCase();

          // Look for PARAMETERS on the next line
          let parameters = {};
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('PARAMETERS:')) {
            const paramsLine = lines[i + 1].trim().replace('PARAMETERS:', '').trim();
            try {
              parameters = JSON.parse(paramsLine);
            } catch (e) {
              console.warn(`Failed to parse parameters for ${toolName}:`, paramsLine);
            }
          }

          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: toolName,
            arguments: parameters
          });
        }
      }

      // Pattern 2: Single-line Ollama format
      // "Using the tool: TOOL_NAME - PARAMETERS: {...}"
      const singleLineRegex = /using the tool:\s*([A-Z_]+)\s*-\s*PARAMETERS:\s*(\{[^}]+\})/gi;
      let match;
      while ((match = singleLineRegex.exec(content)) !== null) {
        const toolName = match[1].toLowerCase();
        let parameters = {};
        try {
          parameters = JSON.parse(match[2]);
        } catch (e) {
          console.warn(`Failed to parse parameters for ${toolName}:`, match[2]);
        }

        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolName,
          arguments: parameters
        });
      }

      return toolCalls.length > 0 ? toolCalls : null;
    } catch (error) {
      console.error('Error parsing tool calls from content:', error);
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
        console.warn('Tool schema should have type "object"');
        return false;
      }

      if (schema.properties && typeof schema.properties !== 'object') {
        console.warn('Tool schema properties should be an object');
        return false;
      }

      if (schema.required && !Array.isArray(schema.required)) {
        console.warn('Tool schema required should be an array');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Schema validation error:', error);
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
      console.error(`Error getting tool ${toolName}:`, error);
      return null;
    }
  }

  /**
   * Validate tool call arguments against schema
   * @param {Object} tool - Tool definition with parameters_schema
   * @param {Object} args - Arguments provided in tool call
   * @returns {Object} { valid: Boolean, errors: Array }
   */
  validateToolArguments(tool, args) {
    const schema = tool.parameters_schema;
    const errors = [];

    if (!schema) {
      return { valid: true, errors: [] };
    }

    // Check required parameters
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in args)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Check parameter types (basic validation)
    if (schema.properties) {
      for (const [paramName, paramValue] of Object.entries(args)) {
        const paramSchema = schema.properties[paramName];

        if (!paramSchema) {
          errors.push(`Unknown parameter: ${paramName}`);
          continue;
        }

        // Type checking
        const actualType = typeof paramValue;
        const expectedType = paramSchema.type;

        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Parameter ${paramName} should be a string`);
        } else if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`Parameter ${paramName} should be a number`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Parameter ${paramName} should be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
          errors.push(`Parameter ${paramName} should be an array`);
        } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue))) {
          errors.push(`Parameter ${paramName} should be an object`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
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
