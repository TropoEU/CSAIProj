/**
 * Tool Execution Service
 *
 * Handles tool execution via n8n webhooks and response generation.
 * Unified service for both Standard and Adaptive reasoning modes.
 */

import llmService from './llmService.js';
import n8nService from './n8nService.js';
import integrationService from './integrationService.js';
import toolManager from './toolManager.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { Message } from '../models/Message.js';
import { RedisCache } from './redisCache.js';
import { ADAPTIVE_REASONING, ENV, LIMITS } from '../config/constants.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ToolExecution');

class ToolExecutionService {
  /**
   * Execute a tool via n8n
   * @param {Object} assessment - Assessment with tool_call and tool_params
   * @param {number} conversationId - Conversation ID
   * @param {number} clientId - Client ID
   * @param {Array} tools - Available tools array
   * @param {Object} options - Additional options (client, formattedHistory for response generation)
   * @returns {Promise<Object>} Execution result
   */
  async executeTool(assessment, conversationId, clientId, tools, options = {}) {
    // Input validation at service boundary
    if (!assessment || typeof assessment !== 'object') {
      console.error('[Tool Execution] Invalid assessment: must be an object');
      return { executed: false, error: 'Invalid assessment parameter' };
    }
    if (!assessment.tool_call || typeof assessment.tool_call !== 'string') {
      console.error('[Tool Execution] Invalid assessment: missing or invalid tool_call');
      return { executed: false, error: 'Missing tool_call in assessment' };
    }
    if (conversationId === undefined || conversationId === null) {
      console.error('[Tool Execution] Invalid conversationId');
      return { executed: false, error: 'Invalid conversationId' };
    }
    if (clientId === undefined || clientId === null) {
      console.error('[Tool Execution] Invalid clientId');
      return { executed: false, error: 'Invalid clientId' };
    }
    if (!Array.isArray(tools)) {
      console.error('[Tool Execution] Invalid tools: must be an array');
      return { executed: false, error: 'Invalid tools parameter' };
    }

    const toolName = assessment.tool_call;
    const toolParams = assessment.tool_params || {};
    const { client, formattedHistory } = options;

    try {
      // Find the tool in the tools array
      const tool = tools.find((t) => t.tool_name === toolName);
      if (!tool) {
        console.error(`[Tool Execution] Tool not found: ${toolName}`);
        return {
          executed: false,
          error: `Tool "${toolName}" not found`,
        };
      }

      // Log tool call debug message
      await Message.createDebug(
        conversationId,
        'assistant',
        `Tool: ${toolName}\nParams: ${JSON.stringify(toolParams, null, 2)}`,
        'tool_call',
        { reasonCode: 'TOOL_CALL', metadata: { tool: toolName, params: toolParams } }
      );

      // Check for duplicate tool calls
      const isDuplicate = await ToolExecution.isDuplicateExecution(
        conversationId,
        toolName,
        toolParams
      );
      if (isDuplicate) {
        console.log(`[Tool Execution] Duplicate call blocked: ${toolName}`);
        await Message.createDebug(
          conversationId,
          'assistant',
          'Duplicate call - already executed',
          'tool_result',
          { reasonCode: 'DUPLICATE_BLOCKED', metadata: { tool: toolName } }
        );
        return {
          executed: true,
          result: { message: 'This action was already completed earlier in this conversation.' },
          final_response: 'This action was already completed earlier in this conversation.',
          duplicate: true,
        };
      }

      // Fetch integration credentials if needed
      let integrations = {};
      const requiredIntegrations = tool.required_integrations || [];
      const integrationMapping = tool.integration_mapping || {};

      if (ENV.isDevelopment) {
        console.log(
          `[Tool Execution] Tool ${toolName} requires ${requiredIntegrations.length} integrations`
        );
        console.log(
          '[Tool Execution] Required integrations:',
          requiredIntegrations.map((i) => i.key).join(', ') || 'none'
        );
        console.log('[Tool Execution] Integration mapping:', JSON.stringify(integrationMapping));
      }

      if (requiredIntegrations.length > 0) {
        try {
          integrations = await integrationService.getIntegrationsForTool(
            clientId,
            integrationMapping,
            requiredIntegrations
          );
          if (ENV.isDevelopment) {
            console.log(
              `[Tool Execution] Loaded ${Object.keys(integrations).length} integrations:`,
              Object.keys(integrations).join(', ')
            );
            // Only log integration status in development (values are already redacted)
            Object.entries(integrations).forEach(([key, int]) => {
              console.log(
                `[Tool Execution] - ${key}: apiUrl=${int.apiUrl ? 'set' : 'MISSING'}, apiKey=${int.apiKey ? 'set' : 'MISSING'}`
              );
            });
          }
        } catch (error) {
          console.error('[Tool Execution] Failed to load integrations:', error.message);
          return {
            executed: false,
            error: `Integration error: ${error.message}`,
          };
        }
      } else if (ENV.isDevelopment) {
        console.log(`[Tool Execution] Tool ${toolName} has no required integrations`);
      }

      // Execute via n8n
      console.log(`[Tool Execution] Calling n8n webhook for: ${toolName}`);
      const result = await n8nService.executeTool(tool.n8n_webhook_url, toolParams, {
        integrations,
      });

      // Handle blocked tools (placeholder values detected)
      if (result.blocked) {
        console.warn(`[Tool Execution] Tool BLOCKED - placeholder values: ${toolName}`);
        await ToolExecution.logBlocked(conversationId, toolName, toolParams, result.error);
        return {
          executed: false,
          error: result.error,
          blocked: true,
        };
      }

      // Log execution
      await ToolExecution.create(
        conversationId,
        toolName,
        toolParams,
        result.data,
        result.success,
        result.executionTimeMs
      );

      if (!result.success) {
        await Message.createDebug(
          conversationId,
          'assistant',
          `Tool failed: ${result.error}`,
          'tool_result',
          { reasonCode: 'TOOL_FAILED', metadata: { tool: toolName, error: result.error } }
        );
        return {
          executed: false,
          error: result.error,
        };
      }

      // Check for empty results - this usually indicates an n8n workflow issue
      if (
        !result.data ||
        (typeof result.data === 'object' && Object.keys(result.data).length === 0)
      ) {
        console.error('[Tool Execution] Tool returned empty result - possible n8n workflow issue');
        await Message.createDebug(
          conversationId,
          'assistant',
          'Tool returned empty result - workflow issue',
          'tool_result',
          { reasonCode: 'TOOL_EMPTY', metadata: { tool: toolName } }
        );
        return {
          executed: false,
          error:
            'The tool returned an empty response. This usually indicates a workflow configuration issue. Please check the n8n workflow and integration settings.',
          emptyResult: true,
        };
      }

      // Log successful tool result
      await Message.createDebug(
        conversationId,
        'assistant',
        `Result: ${JSON.stringify(result.data, null, 2)}`,
        'tool_result',
        {
          reasonCode: REASON_CODES.EXECUTED_SUCCESSFULLY,
          metadata: { tool: toolName, result: result.data },
        }
      );

      // Let the model generate a natural response based on the tool result
      let final_response;
      if (client && formattedHistory) {
        final_response = await this.generateToolResultResponse(
          toolName,
          toolParams,
          result.data,
          client,
          formattedHistory
        );
      } else {
        // Fallback: basic formatting if context not available
        final_response = this.basicFormatToolResult(result.data);
      }

      return {
        executed: true,
        result: result.data,
        final_response,
      };
    } catch (error) {
      console.error('[Tool Execution] Failed:', error);
      return {
        executed: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate a natural response for a tool result using the LLM
   * @param {string} toolName - Name of the tool that was executed
   * @param {Object} toolParams - Parameters used in the tool call
   * @param {Object} toolResult - Raw result from the tool
   * @param {Object} client - Client configuration
   * @param {Array} formattedHistory - Conversation history
   * @returns {Promise<string>} Natural response for the customer
   */
  async generateToolResultResponse(toolName, toolParams, toolResult, client, formattedHistory) {
    try {
      const resultJson = JSON.stringify(toolResult, null, 2);
      const paramsJson = JSON.stringify(toolParams, null, 2);

      const systemPrompt = `You are a helpful customer service assistant. A tool was just executed and you need to communicate the result to the customer in a natural, friendly way in their language.

Tool executed: ${toolName}
Parameters used: ${paramsJson}

Tool result:
${resultJson}

Instructions:
1. Summarize the result naturally for the customer
2. Do NOT expose raw data, JSON, or technical details
3. Use the customer's language (match the language from the conversation)
4. Be concise but complete
5. If the result indicates success, confirm it clearly
6. If the result indicates an error or issue, explain it helpfully`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...formattedHistory.slice(-3), // Include last few messages for context
      ];

      const response = await llmService.chat(messages, {
        maxTokens: ADAPTIVE_REASONING.REPROMPT_MAX_TOKENS,
        temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
        provider: client.llm_provider,
        model: client.model_name,
      });

      return response.content || this.basicFormatToolResult(toolResult);
    } catch (error) {
      console.error('[Tool Response] Failed to generate response:', error.message);
      return this.basicFormatToolResult(toolResult);
    }
  }

  /**
   * Basic formatting for tool results when LLM generation fails
   * @param {Object} result - Tool result
   * @returns {string} Basic formatted response
   */
  basicFormatToolResult(result) {
    if (!result) return 'The operation completed.';
    if (typeof result === 'string') return result;
    if (result.message) return result.message;
    if (result.error) return `There was an issue: ${result.error}`;
    return 'The operation completed successfully.';
  }

  /**
   * Normalize tool arguments (e.g., convert "today" to actual date, coerce types)
   * Shared between standard and adaptive modes.
   * @param {Object} args - Tool arguments
   * @param {Object} tool - Tool definition with schema
   * @returns {Object} Normalized arguments
   */
  normalizeToolArguments(args, tool) {
    const normalized = { ...args };
    const schema = tool?.parameters_schema;

    if (!schema || !schema.properties) {
      return normalized;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramSchema = schema.properties[paramName];
      if (!paramSchema) continue;

      // Type coercion: LLMs sometimes output numbers as strings
      if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
        if (typeof paramValue === 'string') {
          const num =
            paramSchema.type === 'integer' ? parseInt(paramValue, 10) : parseFloat(paramValue);
          if (!isNaN(num)) {
            normalized[paramName] = num;
            log.debug(`Coerced ${paramName} from string "${paramValue}" to number ${num}`);
          }
        }
      }

      // Type coercion: boolean strings
      if (paramSchema.type === 'boolean' && typeof paramValue === 'string') {
        const lower = paramValue.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
          normalized[paramName] = true;
        } else if (lower === 'false' || lower === '0' || lower === 'no') {
          normalized[paramName] = false;
        }
      }

      // Date normalization
      if (paramSchema.type === 'string' && typeof paramValue === 'string') {
        const lowerValue = paramValue.toLowerCase().trim();

        if (lowerValue === 'today') {
          normalized[paramName] = todayStr;
        } else if (lowerValue === 'tomorrow') {
          normalized[paramName] = tomorrowStr;
        } else if (lowerValue === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          normalized[paramName] = yesterday.toISOString().split('T')[0];
        } else if (paramName.toLowerCase().includes('date')) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(paramValue)) {
            const parsed = new Date(paramValue + 'T12:00:00');
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (parsed < oneYearAgo) {
              log.warn(`Date ${paramValue} is too far in the past, correcting to today`);
              normalized[paramName] = todayStr;
            }
          }
        }
      }
    }

    // Fix phone number/email mix-ups
    if (
      normalized.customerEmail &&
      /^\d+$/.test(normalized.customerEmail) &&
      !normalized.customerPhone
    ) {
      log.warn('Phone number found in customerEmail field, moving to customerPhone');
      normalized.customerPhone = normalized.customerEmail;
      normalized.customerEmail = '';
    }
    if (
      normalized.customerPhone &&
      normalized.customerPhone.includes('@') &&
      !normalized.customerEmail
    ) {
      log.warn('Email found in customerPhone field, moving to customerEmail');
      normalized.customerEmail = normalized.customerPhone;
      normalized.customerPhone = '';
    }

    return normalized;
  }

  /**
   * Execute a single tool call for Standard mode (with locks, validation, duplicate detection)
   * @param {Object} toolCall - Tool call object {id, name, arguments}
   * @param {Object} client - Client object
   * @param {Object} conversation - Conversation object
   * @param {Array} messages - Messages array to append results to
   * @returns {Promise<Object>} Execution result
   */
  async executeStandardToolCall(toolCall, client, conversation, messages) {
    const { id, name, arguments: toolArgs } = toolCall;

    log.info(`Executing tool: ${name}`);

    // Store tool call as debug message
    await Message.createDebug(
      conversation.id,
      'assistant',
      `Tool Call: ${name}\nArguments: ${JSON.stringify(toolArgs, null, 2)}`,
      'tool_call',
      { toolCallId: id, metadata: { tool_name: name, arguments: toolArgs } }
    );

    const tool = await toolManager.getToolByName(client.id, name);

    if (!tool) {
      log.error(`Tool not found: ${name}`);
      const errorMessage = `Error: Tool "${name}" is not available`;
      messages.push({ role: 'tool', content: errorMessage, tool_call_id: id });
      await ToolExecution.create(
        conversation.id,
        name,
        toolArgs,
        { error: 'Tool not found' },
        false,
        0
      );
      return { success: false, error: errorMessage };
    }

    // Validate tool arguments
    const validation = toolManager.validateToolArguments(tool, toolArgs);
    if (!validation.valid) {
      log.error(`Invalid arguments for ${name}`, validation.errors);
      const errorDetails = validation.errors.join('; ');
      const errorMessage = `TOOL CALL REJECTED: ${errorDetails}. You MUST ask the user for the missing or invalid information before calling this tool again. Do not use placeholder values.`;

      messages.push({ role: 'tool', content: errorMessage, tool_call_id: id });

      await ToolExecution.create(
        conversation.id,
        name,
        toolArgs,
        { error: validation.errors },
        false,
        0,
        'blocked',
        errorDetails
      );
      await Message.createDebug(conversation.id, 'assistant', errorMessage, 'tool_result', {
        toolCallId: id,
        metadata: {
          tool_name: name,
          success: false,
          status: 'blocked',
          error_reason: errorDetails,
        },
      });

      return { success: false, error: errorMessage, blocked: true };
    }

    // Normalize and prepare arguments
    const normalizedArgs = this.normalizeToolArguments(toolArgs, tool);
    const finalArgs = normalizedArgs || toolArgs;

    // Acquire lock to prevent race conditions
    const lockKey = `tool:${conversation.id}:${name}:${JSON.stringify(finalArgs)}`;
    const lockAcquired = await RedisCache.acquireLock(lockKey, 60);

    if (!lockAcquired) {
      log.warn(`Tool execution already in progress: ${name}`);
      messages.push({
        role: 'tool',
        content:
          'This action is already being processed. Please wait for the current execution to complete.',
        tool_call_id: id,
      });
      return { success: false, error: 'Execution already in progress', locked: true };
    }

    let result;
    try {
      // Check for duplicate tool calls
      const isDuplicate = await ToolExecution.isDuplicateExecution(
        conversation.id,
        name,
        finalArgs
      );
      if (isDuplicate) {
        log.warn(`DUPLICATE tool call blocked: ${name}`);
        const duplicateMessage =
          'This action was already completed earlier in this conversation. No need to repeat it.';
        await ToolExecution.logDuplicate(conversation.id, name, finalArgs);
        messages.push({ role: 'tool', content: duplicateMessage, tool_call_id: id });
        return { success: true, name, duplicate: true };
      }

      // Fetch integration credentials
      let integrations = {};
      const requiredIntegrations = tool.required_integrations || [];
      const integrationMapping = tool.integration_mapping || {};

      if (requiredIntegrations.length > 0) {
        try {
          integrations = await integrationService.getIntegrationsForTool(
            client.id,
            integrationMapping,
            requiredIntegrations
          );
          log.info(`Loaded ${Object.keys(integrations).length} integrations`);
        } catch (error) {
          log.error('Failed to load integrations', error.message);
          messages.push({
            role: 'tool',
            content: `Error: ${error.message}. Please configure the required integrations in the admin panel.`,
            tool_call_id: id,
          });
          return { success: false, error: error.message };
        }
      }

      // Execute via n8n
      result = await n8nService.executeTool(tool.n8n_webhook_url, finalArgs, { integrations });

      // Handle blocked tools (placeholder values detected)
      if (result.blocked) {
        log.warn(`Tool ${name} BLOCKED - placeholder values detected`);
        await ToolExecution.logBlocked(conversation.id, name, finalArgs, result.error);
        messages.push({
          role: 'tool',
          content: `TOOL BLOCKED: ${result.error} Do not use placeholder values - ask the user for the actual information.`,
          tool_call_id: id,
        });
        return { success: false, name, executionTime: result.executionTimeMs, blocked: true };
      }

      // Log execution
      await ToolExecution.create(
        conversation.id,
        name,
        finalArgs,
        result.data,
        result.success,
        result.executionTimeMs
      );
    } finally {
      await RedisCache.releaseLock(lockKey);
    }

    // Format result for LLM
    const formattedResult = n8nService.formatResponseForLLM(result.data);
    messages.push({
      role: 'tool',
      content: result.success ? formattedResult : result.error,
      tool_call_id: id,
    });

    // Store tool result as debug message
    const rawResultStr = JSON.stringify(result.data);
    let truncatedResult = result.data;
    if (rawResultStr.length > LIMITS.TOOL_RESULT_MAX) {
      truncatedResult = {
        _truncated: true,
        preview: rawResultStr.substring(0, LIMITS.TOOL_RESULT_PREVIEW) + '...',
      };
    }

    await Message.createDebug(
      conversation.id,
      'assistant',
      result.success ? formattedResult : `Error: ${result.error}`,
      'tool_result',
      {
        toolCallId: id,
        metadata: {
          tool_name: name,
          success: result.success,
          execution_time_ms: result.executionTimeMs,
          raw_result: truncatedResult,
        },
      }
    );

    log.info(
      `Tool ${name} ${result.success ? 'succeeded' : 'failed'} (${result.executionTimeMs}ms)`
    );

    return {
      success: result.success,
      name,
      executionTime: result.executionTimeMs,
    };
  }
}

// Export singleton
const toolExecutionService = new ToolExecutionService();
export default toolExecutionService;
