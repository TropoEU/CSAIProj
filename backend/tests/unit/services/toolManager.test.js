import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies to test pure functions
vi.mock('../../../src/models/ClientTool.js', () => ({
  ClientTool: {
    getEnabledTools: vi.fn(),
  },
}));

vi.mock('../../../src/services/llmService.js', () => ({
  default: {
    provider: 'groq',
    supportsNativeFunctionCalling: vi.fn((provider) => {
      return ['claude', 'groq', 'openai'].includes(provider);
    }),
  },
}));

// Import after mocks
const { default: toolManager } = await import('../../../src/services/toolManager.js');

describe('ToolManager', () => {
  const mockTools = [
    {
      tool_name: 'get_order_status',
      description: 'Check the status of an order',
      parameters_schema: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'Order ID' },
        },
        required: ['order_id'],
      },
    },
    {
      tool_name: 'book_appointment',
      description: 'Book an appointment at the business',
      parameters_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date' },
          time: { type: 'string', description: 'Time' },
          service: { type: 'string', description: 'Service type' },
        },
        required: ['date', 'time'],
      },
    },
  ];

  describe('formatForNativeFunctionCalling', () => {
    it('should format tools for OpenAI/Groq style', () => {
      const result = toolManager.formatForNativeFunctionCalling(mockTools, 'groq');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'get_order_status',
        description: 'Check the status of an order',
        parameters: mockTools[0].parameters_schema,
      });
    });

    it('should format tools for Claude style (with input_schema)', () => {
      const result = toolManager.formatForNativeFunctionCalling(mockTools, 'claude');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('input_schema');
      expect(result[0]).not.toHaveProperty('parameters');
      expect(result[0].input_schema).toEqual(mockTools[0].parameters_schema);
    });

    it('should use default description when none provided', () => {
      const toolsWithoutDescription = [
        { tool_name: 'test_tool', parameters_schema: { type: 'object', properties: {} } },
      ];

      const result = toolManager.formatForNativeFunctionCalling(toolsWithoutDescription, 'groq');

      expect(result[0].description).toBe('Execute test_tool action');
    });

    it('should use default schema when none provided', () => {
      const toolsWithoutSchema = [{ tool_name: 'test_tool', description: 'Test' }];

      const result = toolManager.formatForNativeFunctionCalling(toolsWithoutSchema, 'groq');

      expect(result[0].parameters).toEqual({
        type: 'object',
        properties: {},
        required: [],
      });
    });
  });

  describe('formatForPromptEngineering', () => {
    it('should return empty string for empty tools array', () => {
      expect(toolManager.formatForPromptEngineering([])).toBe('');
      expect(toolManager.formatForPromptEngineering(null)).toBe('');
    });

    it('should include tool names and descriptions', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('get_order_status');
      expect(result).toContain('book_appointment');
      expect(result).toContain('Check the status of an order');
    });

    it('should include required parameters', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('REQUIRED(order_id)');
      expect(result).toContain('REQUIRED(date,time)');
    });

    it('should include optional parameters', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('optional(service)');
    });

    it('should include format instructions', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('USE_TOOL:');
      expect(result).toContain('PARAMETERS:');
      expect(result).toContain('CRITICAL FORMAT');
    });

    it('should include examples', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('Examples:');
    });
  });

  describe('parseToolCallsFromContent', () => {
    it('should parse USE_TOOL format on single line', () => {
      const content = 'USE_TOOL: get_order_status\nPARAMETERS: {"order_id":"12345"}';
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('get_order_status');
      expect(result[0].arguments).toEqual({ order_id: '12345' });
    });

    it('should parse USE_TOOL format inline', () => {
      const content =
        'I will check that for you. USE_TOOL: get_order_status PARAMETERS: {"order_id":"ABC123"}';
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('get_order_status');
      expect(result[0].arguments.order_id).toBe('ABC123');
    });

    it('should parse tool_name: {...} fallback format', () => {
      const content = 'get_order_status: {"order_id":"12345"}';
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('get_order_status');
    });

    it('should parse multiple tool calls', () => {
      const content = `
        USE_TOOL: get_order_status
        PARAMETERS: {"order_id":"123"}

        USE_TOOL: book_appointment
        PARAMETERS: {"date":"2024-01-15","time":"14:00"}
      `;
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(2);
    });

    it('should return null for content with no tool calls', () => {
      const content = 'Hello, how can I help you today?';
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toBeNull();
    });

    it('should handle malformed JSON gracefully', () => {
      const content = 'USE_TOOL: get_order_status\nPARAMETERS: {invalid json}';
      const result = toolManager.parseToolCallsFromContent(content);

      // Should not crash, returns null or empty
      expect(result === null || result.length === 0).toBe(true);
    });

    it('should deduplicate identical tool calls', () => {
      const content = `
        USE_TOOL: get_order_status
        PARAMETERS: {"order_id":"123"}

        USE_TOOL: get_order_status
        PARAMETERS: {"order_id":"123"}
      `;
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(1);
    });

    it('should generate unique IDs for each tool call', () => {
      const content = `
        USE_TOOL: get_order_status
        PARAMETERS: {"order_id":"123"}

        USE_TOOL: get_order_status
        PARAMETERS: {"order_id":"456"}
      `;
      const result = toolManager.parseToolCallsFromContent(content);

      expect(result).toHaveLength(2);
      expect(result[0].id).not.toBe(result[1].id);
      expect(result[0].id).toMatch(/^call_/);
    });
  });

  describe('formatToolsForLLM', () => {
    it('should return empty array for empty tools with native providers', () => {
      const result = toolManager.formatToolsForLLM([], 'groq');
      expect(result).toEqual([]);
    });

    it('should return empty string for empty tools with ollama', () => {
      const result = toolManager.formatToolsForLLM([], 'ollama');
      expect(result).toBe('');
    });

    it('should use native format for groq', () => {
      const result = toolManager.formatToolsForLLM(mockTools, 'groq');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('parameters');
    });

    it('should use prompt engineering format for ollama', () => {
      const result = toolManager.formatToolsForLLM(mockTools, 'ollama');

      expect(typeof result).toBe('string');
      expect(result).toContain('USE_TOOL:');
    });
  });

  describe('validateToolSchema', () => {
    it('should return true for null schema', () => {
      expect(toolManager.validateToolSchema(null)).toBe(true);
    });

    it('should return true for valid object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };
      expect(toolManager.validateToolSchema(schema)).toBe(true);
    });

    it('should return false for non-object type', () => {
      const schema = {
        type: 'string',
      };
      expect(toolManager.validateToolSchema(schema)).toBe(false);
    });
  });
});
