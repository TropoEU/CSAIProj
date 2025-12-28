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

    // Use native function calling for Claude, Groq, and OpenAI
    if (llmService.supportsNativeFunctionCalling(provider)) {
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

    // Compact but informative: tool name, description, and ALL parameter names (not just required)
    // This is critical - the model needs to know parameter names even if they're optional
    const toolList = tools.map(tool => {
      const params = tool.parameters_schema?.properties || {};
      const required = tool.parameters_schema?.required || [];
      const allParamNames = Object.keys(params);
      
      // Show required params in parentheses, optional params after
      const requiredStr = required.length > 0 ? ` REQUIRED(${required.join(',')})` : '';
      const optionalParams = allParamNames.filter(p => !required.includes(p));
      const optionalStr = optionalParams.length > 0 ? ` optional(${optionalParams.join(',')})` : '';
      
      // Use first ~50 chars of description
      const shortDesc = (tool.description || '').substring(0, 50).replace(/\n/g, ' ');
      return `${tool.tool_name}${requiredStr}${optionalStr}: ${shortDesc}`;
    }).join('\n');

    // Show examples for tools that have different parameter patterns
    const examples = [];
    tools.slice(0, 2).forEach(tool => {
      const params = tool.parameters_schema?.properties || {};
      const required = tool.parameters_schema?.required || [];
      const paramNames = required.length > 0 ? required : Object.keys(params).slice(0, 2);
      const exampleArgs = {};
      paramNames.forEach((key) => {
        exampleArgs[key] = 'value';
      });
      if (Object.keys(exampleArgs).length > 0) {
        examples.push({
          tool: tool.tool_name,
          params: exampleArgs
        });
      }
    });

    const exampleText = examples.map(ex => 
      `USE_TOOL: ${ex.tool}\nPARAMETERS: ${JSON.stringify(ex.params)}`
    ).join('\n\n');

    return `\n## Available Tools (READ THESE REQUIREMENTS):\n${toolList}\n\n## HOW TO CALL TOOLS:\n1. READ the REQUIRED parameters for the tool above\n2. If user already gave all required info → CALL THE TOOL IMMEDIATELY\n3. If missing required info → Ask ONE question to get it\n4. Once you have everything → CALL THE TOOL IN THE SAME RESPONSE\n\n**FORMAT** (use EXACTLY - no variations):\nUSE_TOOL: tool_name\nPARAMETERS: {"param":"value"}\n\nExamples:\n${exampleText}`;
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
          console.log(`[ToolManager] Parsed tool call: ${toolName} with params:`, parameters);
          addToolCall(toolName, parameters);
        } catch (e) {
          console.warn(`[ToolManager] Failed to parse parameters for ${toolName}:`, match[2], e.message);
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
              console.warn(`Failed to parse same-line parameters for ${toolName}:`, sameLineParams[1]);
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
                console.warn(`Failed to parse next-line parameters for ${toolName}:`, nextLineParams[1]);
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
                console.warn(`Failed to parse parameters for ${toolName}:`, match[2]);
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
          console.warn(`Failed to parse parameters for ${toolName}:`, match[2]);
        }
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
            console.log(`[ToolManager] Coerced ${paramName}: "${paramValue}" -> ${num}`);
          }
        } else if (expectedType === 'integer' && actualType === 'string') {
          const num = parseInt(paramValue, 10);
          if (!isNaN(num)) {
            args[paramName] = num;
            actualType = 'number';
            console.log(`[ToolManager] Coerced ${paramName}: "${paramValue}" -> ${num}`);
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
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      coercedArgs: args
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
