import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Mock config
vi.mock('../../../src/config.js', () => ({
  OLLAMA_CONFIG: {
    url: 'http://localhost:11434',
    model: 'llama2',
  },
}));

// Set environment variables before importing the service
process.env.LLM_PROVIDER = 'ollama';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

const { Anthropic } = await import('@anthropic-ai/sdk');
const llmService = (await import('../../../src/services/llmService.js')).default;

describe('LLMService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getModelForProvider', () => {
    it('should return ollama model when provider is ollama', () => {
      llmService.provider = 'ollama';
      const model = llmService.getModelForProvider();
      expect(model).toBeDefined();
    });

    it('should return groq model when provider is groq', () => {
      llmService.provider = 'groq';
      const model = llmService.getModelForProvider();
      expect(model).toBeDefined();
    });

    it('should return claude model when provider is claude', () => {
      llmService.provider = 'claude';
      const model = llmService.getModelForProvider();
      expect(model).toContain('claude');
    });
  });

  describe('supportsNativeFunctionCalling', () => {
    it('should return true for claude', () => {
      expect(llmService.supportsNativeFunctionCalling('claude')).toBe(true);
    });

    it('should return true for groq', () => {
      expect(llmService.supportsNativeFunctionCalling('groq')).toBe(true);
    });

    it('should return true for openai', () => {
      expect(llmService.supportsNativeFunctionCalling('openai')).toBe(true);
    });

    it('should return false for ollama', () => {
      expect(llmService.supportsNativeFunctionCalling('ollama')).toBe(false);
    });
  });

  describe('formatMessagesForOllama', () => {
    it('should format regular messages correctly', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = llmService.formatMessagesForOllama(messages);

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('system');
      expect(result[1].role).toBe('user');
      expect(result[2].role).toBe('assistant');
    });

    it('should convert tool results to assistant messages', () => {
      const messages = [
        { role: 'user', content: 'Check order status' },
        { role: 'tool', content: 'Order #123 is shipped' },
      ];

      const result = llmService.formatMessagesForOllama(messages);

      expect(result).toHaveLength(2);
      expect(result[1].role).toBe('assistant');
      expect(result[1].content).toContain('TOOL RESULT');
      expect(result[1].content).toContain('Order #123 is shipped');
    });

    it('should skip assistant messages with only tool calls', () => {
      const messages = [
        { role: 'user', content: 'Check order' },
        { role: 'assistant', content: '', tool_calls: [{ name: 'get_order' }] },
        { role: 'tool', content: 'Order found' },
      ];

      const result = llmService.formatMessagesForOllama(messages);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });

  describe('formatMessagesForClaude', () => {
    it('should format regular messages correctly', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      const result = llmService.formatMessagesForClaude(messages);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should skip system messages (handled separately)', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = llmService.formatMessagesForClaude(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('should format tool results correctly', () => {
      const messages = [
        { role: 'tool', content: 'Result data', tool_call_id: 'tool-123' },
      ];

      const result = llmService.formatMessagesForClaude(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content[0].type).toBe('tool_result');
      expect(result[0].content[0].tool_use_id).toBe('tool-123');
    });
  });

  describe('formatMessagesForGroq', () => {
    it('should format messages for Groq', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
      ];

      const result = llmService.formatMessagesForGroq(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: 'system', content: 'System prompt' });
    });

    it('should format tool calls in assistant messages', () => {
      const messages = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'tc-1', name: 'get_order', arguments: { id: '123' } }],
        },
      ];

      const result = llmService.formatMessagesForGroq(messages);

      expect(result[0].tool_calls).toHaveLength(1);
      expect(result[0].tool_calls[0].function.name).toBe('get_order');
    });

    it('should format tool results', () => {
      const messages = [
        { role: 'tool', content: 'Result', tool_call_id: 'tc-1' },
      ];

      const result = llmService.formatMessagesForGroq(messages);

      expect(result[0].role).toBe('tool');
      expect(result[0].tool_call_id).toBe('tc-1');
    });
  });

  describe('formatToolsForGroq', () => {
    it('should format tools for Groq API', () => {
      const tools = [
        {
          name: 'get_order',
          description: 'Get order status',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const result = llmService.formatToolsForGroq(tools);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('function');
      expect(result[0].function.name).toBe('get_order');
    });

    it('should append tool guidance to descriptions', () => {
      const tools = [
        { name: 'test', description: 'Test tool', parameters: {} },
      ];

      const result = llmService.formatToolsForGroq(tools, 'Use carefully');

      expect(result[0].function.description).toBe('Test tool Use carefully');
    });

    it('should return empty array for invalid input', () => {
      expect(llmService.formatToolsForGroq(null)).toEqual([]);
      expect(llmService.formatToolsForGroq('not array')).toEqual([]);
    });
  });

  describe('formatToolsForClaude', () => {
    it('should format tools for Claude API', () => {
      const tools = [
        {
          name: 'book_table',
          description: 'Book a table',
          parameters: { type: 'object', properties: { date: { type: 'string' } } },
        },
      ];

      const result = llmService.formatToolsForClaude(tools);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('book_table');
      expect(result[0].input_schema).toEqual(tools[0].parameters);
    });
  });

  describe('calculateClaudeCost', () => {
    it('should calculate cost based on token usage', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
      };

      const cost = llmService.calculateClaudeCost(usage);

      // Input: 1000/1M * $3 = $0.003
      // Output: 500/1M * $15 = $0.0075
      // Total: $0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should handle zero tokens', () => {
      const usage = { input_tokens: 0, output_tokens: 0 };

      const cost = llmService.calculateClaudeCost(usage);

      expect(cost).toBe(0);
    });
  });

  describe('calculateGroqCost', () => {
    it('should return 0 (free tier)', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };

      const cost = llmService.calculateGroqCost(usage);

      expect(cost).toBe(0);
    });
  });

  describe('calculateOpenAICost', () => {
    it('should calculate cost based on GPT-4o pricing', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
      };

      const cost = llmService.calculateOpenAICost(usage);

      // Input: 1000/1M * $2.50 = $0.0025
      // Output: 500/1M * $10 = $0.005
      // Total: $0.0075
      expect(cost).toBeCloseTo(0.0075, 4);
    });
  });

  describe('parseAssessment', () => {
    it('should parse valid assessment block', () => {
      const response = `Here is my response.

<assessment>
{
  "confidence": 8,
  "tool_call": "get_order",
  "tool_params": {"order_id": "123"},
  "missing_params": [],
  "is_destructive": false,
  "needs_confirmation": false
}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.visible_response).toBe('Here is my response.');
      expect(result.assessment.confidence).toBe(8);
      expect(result.assessment.tool_call).toBe('get_order');
    });

    it('should return full response when no assessment block', () => {
      const response = 'Just a regular response without assessment.';

      const result = llmService.parseAssessment(response);

      expect(result.visible_response).toBe(response);
      expect(result.assessment).toBeNull();
    });

    it('should handle assessment with reasoning block', () => {
      const response = `<reasoning>
Let me think about this...
</reasoning>

Response text here.

<assessment>
{"confidence": 7, "tool_call": null, "tool_params": {}, "missing_params": [], "is_destructive": false, "needs_confirmation": false}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.visible_response).toBe('Response text here.');
      expect(result.reasoning).toContain('think about this');
    });

    it('should handle JSON parse errors gracefully', () => {
      const response = `Response

<assessment>
{invalid json}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.visible_response).toBe(response.trim());
      expect(result.assessment).toBeNull();
      expect(result.parse_error).toBeDefined();
    });

    it('should fill default values for missing assessment fields', () => {
      const response = `Test

<assessment>
{"confidence": 9}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.assessment.confidence).toBe(9);
      expect(result.assessment.tool_call).toBeNull();
      expect(result.assessment.tool_params).toEqual({});
      expect(result.assessment.missing_params).toEqual([]);
      expect(result.assessment.is_destructive).toBe(false);
      expect(result.assessment.needs_confirmation).toBe(false);
    });

    it('should clamp confidence to 1-10 range', () => {
      const response = `Test

<assessment>
{"confidence": 15, "tool_call": null, "tool_params": {}, "missing_params": [], "is_destructive": false, "needs_confirmation": false}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.assessment.confidence).toBe(10);
    });

    it('should handle comments in JSON', () => {
      const response = `Test

<assessment>
{
  "confidence": 7, // High confidence
  "tool_call": null,
  "tool_params": {},
  "missing_params": [],
  "is_destructive": false,
  "needs_confirmation": false
}
</assessment>`;

      const result = llmService.parseAssessment(response);

      expect(result.assessment.confidence).toBe(7);
    });
  });

  describe('handleError', () => {
    it('should return rate limit error for 429', () => {
      const error = { status: 429 };

      const result = llmService.handleError(error);

      expect(result.message).toContain('Rate limit');
    });

    it('should return auth error for 401', () => {
      const error = { status: 401 };

      const result = llmService.handleError(error);

      expect(result.message).toContain('Invalid API key');
    });

    it('should return unavailable error for 500/503', () => {
      const error = { status: 500 };

      const result = llmService.handleError(error);

      expect(result.message).toContain('unavailable');
    });

    it('should return original error for unknown status', () => {
      const error = new Error('Unknown error');

      const result = llmService.handleError(error);

      expect(result).toBe(error);
    });
  });

  describe('withRetry', () => {
    it('should return result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await llmService.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValue('success');

      const result = await llmService.withRetry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      const result = await llmService.withRetry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 429 });

      await expect(llmService.withRetry(fn, 2, 10)).rejects.toEqual({ status: 429 });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Bad request');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(llmService.withRetry(fn)).rejects.toThrow('Bad request');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('ollamaChat', () => {
    it('should make request to Ollama API', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Hello!' },
        prompt_eval_count: 10,
        eval_count: 5,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await llmService.ollamaChat(
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 100, temperature: 0.7 }
      );

      expect(result.content).toBe('Hello!');
      expect(result.provider).toBe('ollama');
      expect(result.cost).toBe(0);
      expect(result.tokens.input).toBe(10);
      expect(result.tokens.output).toBe(5);
    });

    it('should handle cached prompts (prompt_eval_count = 0)', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Cached response' },
        prompt_eval_count: 0,
        eval_count: 10,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await llmService.ollamaChat(
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 100, temperature: 0.7 }
      );

      expect(result.tokens.input).toBe(0);
      expect(result.tokens.output).toBe(10);
    });

    it('should throw on API error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      });

      await expect(
        llmService.ollamaChat([{ role: 'user', content: 'Hi' }], {})
      ).rejects.toThrow('Ollama API error');
    });
  });

  describe('groqChat', () => {
    it('should make request to Groq API', async () => {
      const mockResponse = {
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from Groq!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await llmService.groqChat(
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 100, temperature: 0.7 }
      );

      expect(result.content).toBe('Hello from Groq!');
      expect(result.provider).toBe('groq');
      expect(result.tokens.total).toBe(23);
    });

    it('should extract tool calls from response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-1',
                  function: { name: 'get_order', arguments: '{"id":"123"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await llmService.groqChat(
        [{ role: 'user', content: 'Check order 123' }],
        { maxTokens: 100, temperature: 0.7, tools: [{ name: 'get_order' }] }
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_order');
      expect(result.toolCalls[0].arguments).toEqual({ id: '123' });
    });

    it('should throw when GROQ_API_KEY is missing', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      await expect(
        llmService.groqChat([{ role: 'user', content: 'Hi' }], {})
      ).rejects.toThrow('GROQ_API_KEY');

      process.env.GROQ_API_KEY = originalKey;
    });
  });

  describe('chat', () => {
    it('should route to correct provider based on options', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Test' },
        prompt_eval_count: 5,
        eval_count: 3,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await llmService.chat(
        [{ role: 'user', content: 'Hi' }],
        { provider: 'ollama' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('localhost:11434'),
        expect.any(Object)
      );
    });

    it('should use per-request model override', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Test' },
        prompt_eval_count: 5,
        eval_count: 3,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await llmService.chat(
        [{ role: 'user', content: 'Hi' }],
        { provider: 'ollama', model: 'custom-model' }
      );

      expect(result.model).toBe('custom-model');
    });
  });
});
