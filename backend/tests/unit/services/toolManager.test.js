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

      expect(result).toContain('order_id (string) [REQUIRED]');
      expect(result).toContain('date (string) [REQUIRED]');
      expect(result).toContain('time (string) [REQUIRED]');
    });

    it('should include optional parameters', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      // Optional parameters are shown without [REQUIRED] marker
      expect(result).toContain('service (string)');
      // Verify it's NOT marked as required
      expect(result).not.toContain('service (string) [REQUIRED]');
    });

    it('should include format instructions', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      expect(result).toContain('USE_TOOL:');
      expect(result).toContain('PARAMETERS:');
      expect(result).toContain('FORMAT');
    });

    it('should include tool decision tree', () => {
      const result = toolManager.formatForPromptEngineering(mockTools);

      // New format includes decision tree instead of examples
      expect(result).toContain('TOOL CALLING DECISION TREE');
      expect(result).toContain('Before calling a tool, verify:');
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

  describe('detectPlaceholderValue', () => {
    describe('Exact placeholder matches', () => {
      it('should detect common placeholders', () => {
        const placeholders = ['placeholder', 'example', 'value', 'todo', 'tbd', 'test', 'sample'];
        placeholders.forEach((value) => {
          const result = toolManager.detectPlaceholderValue('name', value);
          expect(result).not.toBeNull();
          expect(result).toContain('placeholder value');
        });
      });

      it('should detect template-style placeholders', () => {
        const result1 = toolManager.detectPlaceholderValue('name', '<value>');
        expect(result1).toContain('template placeholder');

        const result2 = toolManager.detectPlaceholderValue('email', '[required]');
        expect(result2).toContain('template placeholder');

        const result3 = toolManager.detectPlaceholderValue('id', '{{name}}');
        expect(result3).toContain('template placeholder');
      });

      it('should detect AI-generated placeholders', () => {
        const aiPlaceholders = ['not provided', 'unknown', 'missing', 'pending'];
        aiPlaceholders.forEach((value) => {
          const result = toolManager.detectPlaceholderValue('field', value);
          expect(result).not.toBeNull();
        });
      });
    });

    describe('Pattern-based detection', () => {
      it('should detect phrase patterns', () => {
        const result1 = toolManager.detectPlaceholderValue('name', 'not given');
        expect(result1).toContain('placeholder');

        const result2 = toolManager.detectPlaceholderValue('email', 'no data');
        expect(result2).toContain('placeholder');

        const result3 = toolManager.detectPlaceholderValue('phone', 'will provide');
        expect(result3).toContain('placeholder');
      });

      it('should detect schema descriptions as placeholders', () => {
        const result = toolManager.detectPlaceholderValue('name', "the customer's name");
        expect(result).toContain('description rather than actual data');
      });
    });

    describe('Email validation', () => {
      it('should accept valid-looking emails', () => {
        const result = toolManager.detectPlaceholderValue('email', 'user@example.com');
        expect(result).toBeNull();
      });

      it('should reject email fields without @ or .', () => {
        const result = toolManager.detectPlaceholderValue('email', 'notanemail');
        expect(result).toContain("doesn't look like a valid email");
      });
    });

    describe('Phone validation', () => {
      it('should accept phone numbers with digits', () => {
        const result = toolManager.detectPlaceholderValue('phone', '555-1234');
        expect(result).toBeNull();
      });

      it('should reject phone fields without any digits', () => {
        const result = toolManager.detectPlaceholderValue('phone', 'phonenumber');
        expect(result).toContain("doesn't contain any digits");
      });
    });

    describe('Date validation', () => {
      it('should accept "today" and "tomorrow" as valid', () => {
        expect(toolManager.detectPlaceholderValue('date', 'today')).toBeNull();
        expect(toolManager.detectPlaceholderValue('date', 'tomorrow')).toBeNull();
      });

      it('should accept dates within 2 years past', () => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const dateStr = oneYearAgo.toISOString().split('T')[0];

        const result = toolManager.detectPlaceholderValue('date', dateStr);
        expect(result).toBeNull();
      });

      it('should accept dates within 2 years future', () => {
        const oneYearAhead = new Date();
        oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
        const dateStr = oneYearAhead.toISOString().split('T')[0];

        const result = toolManager.detectPlaceholderValue('date', dateStr);
        expect(result).toBeNull();
      });

      it('should reject dates more than 2 years in the past', () => {
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        const dateStr = threeYearsAgo.toISOString().split('T')[0];

        const result = toolManager.detectPlaceholderValue('date', dateStr);
        expect(result).not.toBeNull();
        expect(result).toContain('outside reasonable date range');
      });

      it('should reject dates more than 2 years in the future', () => {
        const threeYearsAhead = new Date();
        threeYearsAhead.setFullYear(threeYearsAhead.getFullYear() + 3);
        const dateStr = threeYearsAhead.toISOString().split('T')[0];

        const result = toolManager.detectPlaceholderValue('date', dateStr);
        expect(result).not.toBeNull();
        expect(result).toContain('outside reasonable date range');
      });

      it('should reject non-numeric date words', () => {
        const result = toolManager.detectPlaceholderValue('date', 'somedate');
        expect(result).toContain("doesn't look like a valid date");
      });
    });

    describe('Time validation', () => {
      it('should accept time values with colons or digits', () => {
        expect(toolManager.detectPlaceholderValue('time', '14:30')).toBeNull();
        expect(toolManager.detectPlaceholderValue('time', '1430')).toBeNull();
      });

      it('should reject non-numeric time words', () => {
        const result = toolManager.detectPlaceholderValue('time', 'sometime');
        expect(result).toContain("doesn't look like a valid time");
      });
    });

    describe('Empty values', () => {
      it('should reject empty strings', () => {
        const result = toolManager.detectPlaceholderValue('name', '');
        expect(result).toContain('empty');
      });

      it('should reject whitespace-only strings', () => {
        const result = toolManager.detectPlaceholderValue('name', '   ');
        expect(result).toContain('empty');
      });
    });

    describe('Valid real values', () => {
      it('should accept normal text values', () => {
        expect(toolManager.detectPlaceholderValue('name', 'John Doe')).toBeNull();
        expect(toolManager.detectPlaceholderValue('address', '123 Main St')).toBeNull();
        expect(toolManager.detectPlaceholderValue('notes', 'This is a note')).toBeNull();
      });

      it('should return null for non-string values', () => {
        expect(toolManager.detectPlaceholderValue('count', 123)).toBeNull();
        expect(toolManager.detectPlaceholderValue('active', true)).toBeNull();
      });
    });
  });

  describe('validateToolArguments', () => {
    const mockTool = {
      tool_name: 'test_tool',
      parameters_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'email'],
      },
    };

    it('should detect missing required parameters', () => {
      const args = { name: 'John' }; // missing email
      const result = toolManager.validateToolArguments(mockTool, args);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: email');
    });

    it('should coerce string numbers to numbers', () => {
      const args = { name: 'John', email: 'john@example.com', age: '25' };
      const result = toolManager.validateToolArguments(mockTool, args);

      expect(result.valid).toBe(true);
      expect(result.coercedArgs.age).toBe(25);
      expect(typeof result.coercedArgs.age).toBe('number');
    });

    it('should coerce string booleans to booleans', () => {
      const args = { name: 'John', email: 'john@example.com', active: 'true' };
      const result = toolManager.validateToolArguments(mockTool, args);

      expect(result.valid).toBe(true);
      expect(result.coercedArgs.active).toBe(true);
      expect(typeof result.coercedArgs.active).toBe('boolean');
    });

    it('should reject required parameters with placeholder values', () => {
      const args = { name: 'placeholder', email: 'john@example.com' };
      const result = toolManager.validateToolArguments(mockTool, args);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('placeholder'))).toBe(true);
    });

    it('should remove optional parameters with placeholder values', () => {
      const args = { name: 'John', email: 'john@example.com', age: 'unknown' };
      const result = toolManager.validateToolArguments(mockTool, args);

      // age should be removed because it's optional and contains a placeholder
      expect(result.coercedArgs.age).toBeUndefined();
    });

    it('should pass validation with all valid arguments', () => {
      const args = { name: 'John Doe', email: 'john@example.com', age: 30, active: true };
      const result = toolManager.validateToolArguments(mockTool, args);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
