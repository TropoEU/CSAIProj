import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the default export directly since we want to test the instance methods
const n8nService = (await import('../../../src/services/n8nService.js')).default;

describe('N8nService', () => {
  describe('buildWebhookUrl', () => {
    it('should return complete URL if already a full URL (http)', () => {
      const url = n8nService.buildWebhookUrl('http://localhost:5678/webhook/test');
      expect(url).toBe('http://localhost:5678/webhook/test');
    });

    it('should return complete URL if already a full URL (https)', () => {
      const url = n8nService.buildWebhookUrl('https://n8n.example.com/webhook/test');
      expect(url).toBe('https://n8n.example.com/webhook/test');
    });

    it('should combine base URL with path (without leading slash)', () => {
      const url = n8nService.buildWebhookUrl('webhook/test');
      expect(url).toMatch(/http:\/\/.*:5678\/webhook\/test$/);
    });

    it('should combine base URL with path (with leading slash)', () => {
      const url = n8nService.buildWebhookUrl('/webhook/test');
      expect(url).toMatch(/http:\/\/.*:5678\/webhook\/test$/);
    });
  });

  describe('formatResponseForLLM', () => {
    it('should handle null/undefined response', () => {
      expect(n8nService.formatResponseForLLM(null)).toBe(
        'No data returned from tool execution.'
      );
      expect(n8nService.formatResponseForLLM(undefined)).toBe(
        'No data returned from tool execution.'
      );
    });

    it('should handle string response', () => {
      const response = 'Simple string response';
      expect(n8nService.formatResponseForLLM(response)).toBe('Simple string response');
    });

    it('should handle empty array', () => {
      expect(n8nService.formatResponseForLLM([])).toBe('No results found.');
    });

    it('should handle array with items', () => {
      const response = [{ id: 1 }, { id: 2 }];
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toContain('"id": 1');
      expect(result).toContain('"id": 2');
    });

    it('should truncate large arrays', () => {
      const response = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toContain('and 5 more items (truncated)');
    });

    it('should handle empty object as error', () => {
      const result = n8nService.formatResponseForLLM({});
      expect(result).toContain('ERROR');
      expect(result).toContain('empty response');
    });

    it('should detect error response with error field', () => {
      const response = { error: 'Something went wrong' };
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toBe('Error: Something went wrong');
    });

    it('should detect error response with success=false', () => {
      const response = { success: false, message: 'Operation failed' };
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toBe('Error: Operation failed');
    });

    it('should extract message from response', () => {
      const response = { message: 'Order confirmed', data: { id: 123 } };
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toContain('Order confirmed');
    });

    it('should include details for small data objects', () => {
      const response = {
        message: 'Order found',
        data: { orderId: 123, status: 'shipped' },
      };
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toContain('Order found');
      expect(result).toContain('orderId');
    });

    it('should extract important fields for large data', () => {
      const largeData = { id: 1, status: 'active' };
      // Add lots of extra fields to make it large
      for (let i = 0; i < 100; i++) {
        largeData[`field_${i}`] = 'x'.repeat(50);
      }
      const response = { message: 'Data retrieved', data: largeData };
      const result = n8nService.formatResponseForLLM(response);
      expect(result).toContain('Data retrieved');
      // Should extract key fields like id and status
      expect(result).toContain('id');
    });
  });

  describe('isErrorResponse', () => {
    it('should detect error field', () => {
      expect(n8nService.isErrorResponse({ error: 'Something wrong' })).toBe(true);
    });

    it('should detect err field', () => {
      expect(n8nService.isErrorResponse({ err: 'Something wrong' })).toBe(true);
    });

    it('should detect errorMessage field', () => {
      expect(n8nService.isErrorResponse({ errorMessage: 'Failed' })).toBe(true);
    });

    it('should detect success=false', () => {
      expect(n8nService.isErrorResponse({ success: false })).toBe(true);
    });

    it('should detect ok=false', () => {
      expect(n8nService.isErrorResponse({ ok: false })).toBe(true);
    });

    it('should detect succeeded=false', () => {
      expect(n8nService.isErrorResponse({ succeeded: false })).toBe(true);
    });

    it('should detect status=error', () => {
      expect(n8nService.isErrorResponse({ status: 'error' })).toBe(true);
    });

    it('should detect status=failed', () => {
      expect(n8nService.isErrorResponse({ status: 'failed' })).toBe(true);
    });

    it('should detect HTTP error status codes', () => {
      expect(n8nService.isErrorResponse({ statusCode: 404 })).toBe(true);
      expect(n8nService.isErrorResponse({ statusCode: 500 })).toBe(true);
      expect(n8nService.isErrorResponse({ code: 400 })).toBe(true);
    });

    it('should not detect success responses as errors', () => {
      expect(n8nService.isErrorResponse({ success: true, data: {} })).toBe(false);
      expect(n8nService.isErrorResponse({ status: 'ok' })).toBe(false);
      expect(n8nService.isErrorResponse({ statusCode: 200 })).toBe(false);
    });
  });

  describe('extractMessage', () => {
    it('should extract message field', () => {
      expect(n8nService.extractMessage({ message: 'Hello' })).toBe('Hello');
    });

    it('should extract msg field', () => {
      expect(n8nService.extractMessage({ msg: 'Hello' })).toBe('Hello');
    });

    it('should extract description field', () => {
      expect(n8nService.extractMessage({ description: 'A description' })).toBe(
        'A description'
      );
    });

    it('should extract text field', () => {
      expect(n8nService.extractMessage({ text: 'Some text' })).toBe('Some text');
    });

    it('should extract statusMessage field', () => {
      expect(n8nService.extractMessage({ statusMessage: 'Status message' })).toBe(
        'Status message'
      );
    });

    it('should return null when no message field found', () => {
      expect(n8nService.extractMessage({ data: 123 })).toBeNull();
    });

    it('should ignore non-string message fields', () => {
      expect(n8nService.extractMessage({ message: { nested: 'value' } })).toBeNull();
    });
  });

  describe('extractData', () => {
    it('should extract data field', () => {
      expect(n8nService.extractData({ data: { id: 1 } })).toEqual({ id: 1 });
    });

    it('should extract result field', () => {
      expect(n8nService.extractData({ result: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('should extract results field', () => {
      expect(n8nService.extractData({ results: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    });

    it('should extract payload field', () => {
      expect(n8nService.extractData({ payload: 'test' })).toBe('test');
    });

    it('should extract body field', () => {
      expect(n8nService.extractData({ body: { key: 'value' } })).toEqual({ key: 'value' });
    });

    it('should clean and return response when no wrapper found', () => {
      const result = n8nService.extractData({ orderId: 123, amount: 50.00 });
      expect(result).toEqual({ orderId: 123, amount: 50.00 });
    });

    it('should remove internal fields from response', () => {
      const response = {
        orderId: 123,
        success: true,
        status: 'ok',
        timestamp: '2024-01-01',
        _integration: {},
      };
      const result = n8nService.extractData(response);
      expect(result.success).toBeUndefined();
      expect(result._integration).toBeUndefined();
      expect(result.orderId).toBe(123);
    });
  });

  describe('extractImportantFields', () => {
    it('should extract id field', () => {
      const result = n8nService.extractImportantFields({ id: 123, extra: 'data' });
      expect(result.id).toBe(123);
    });

    it('should extract status field', () => {
      const result = n8nService.extractImportantFields({ status: 'shipped' });
      expect(result.status).toBe('shipped');
    });

    it('should extract orderId field', () => {
      const result = n8nService.extractImportantFields({ orderId: 'ORD-123' });
      expect(result.orderId).toBe('ORD-123');
    });

    it('should extract time-related fields', () => {
      const result = n8nService.extractImportantFields({
        estimatedDelivery: '2024-12-25',
        date: '2024-12-20',
      });
      expect(result.estimatedDelivery).toBe('2024-12-25');
      expect(result.date).toBe('2024-12-20');
    });

    it('should extract amount fields', () => {
      const result = n8nService.extractImportantFields({
        total: 99.99,
        amount: 50,
      });
      expect(result.total).toBe(99.99);
      expect(result.amount).toBe(50);
    });

    it('should limit to 8 fields', () => {
      const data = {
        id: 1,
        orderId: 2,
        status: 'active',
        name: 'Test',
        total: 100,
        date: '2024-01-01',
        phone: '555-1234',
        email: 'test@test.com',
        address: '123 Main St',
        extra1: 'ignored',
        extra2: 'ignored',
      };
      const result = n8nService.extractImportantFields(data);
      expect(Object.keys(result).length).toBeLessThanOrEqual(8);
    });

    it('should handle nested objects', () => {
      const result = n8nService.extractImportantFields({
        driver: { name: 'John', phone: '555-1234', vehicleId: 'V123' },
      });
      expect(result.driver).toBeDefined();
      // Should extract up to 3 keys from nested object
      expect(Object.keys(result.driver).length).toBeLessThanOrEqual(3);
    });

    it('should handle arrays', () => {
      const result1 = n8nService.extractImportantFields({ id: 1 });
      expect(result1.id).toBe(1);

      // Empty array
      const result2 = n8nService.extractImportantFields({ status: [] });
      expect(result2.status).toEqual([]);

      // Single item array
      const result3 = n8nService.extractImportantFields({ status: ['pending'] });
      expect(result3.status).toEqual(['pending']);

      // Multi-item array
      const result4 = n8nService.extractImportantFields({ status: ['a', 'b', 'c'] });
      expect(result4.status).toBe('[3 items]');
    });

    it('should return null for non-objects', () => {
      expect(n8nService.extractImportantFields(null)).toBeNull();
      expect(n8nService.extractImportantFields('string')).toBeNull();
      expect(n8nService.extractImportantFields(123)).toBeNull();
    });

    it('should return null when no important fields found', () => {
      const result = n8nService.extractImportantFields({
        randomField1: 'value1',
        randomField2: 'value2',
      });
      expect(result).toBeNull();
    });
  });

  describe('truncateIfNeeded', () => {
    it('should not truncate short text', () => {
      const text = 'Short text';
      expect(n8nService.truncateIfNeeded(text)).toBe(text);
    });

    it('should truncate text longer than default max (8000)', () => {
      const text = 'x'.repeat(9000);
      const result = n8nService.truncateIfNeeded(text);
      expect(result.length).toBeLessThan(9000);
      expect(result).toContain('(response truncated due to length)');
    });

    it('should respect custom max length', () => {
      const text = 'x'.repeat(200);
      const result = n8nService.truncateIfNeeded(text, 100);
      expect(result.length).toBeLessThan(200);
      expect(result).toContain('truncated');
    });

    it('should not truncate text exactly at max length', () => {
      const text = 'x'.repeat(100);
      const result = n8nService.truncateIfNeeded(text, 100);
      expect(result).toBe(text);
    });
  });

  describe('executeTool', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should block placeholder values in parameters', async () => {
      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { name: 'your name' }
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.error).toContain('Missing required information');
    });

    it('should block YYYY-MM-DD placeholder', async () => {
      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { date: 'YYYY-MM-DD' }
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should block bracketed placeholders', async () => {
      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { value: '[enter value]' }
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should block angle bracket placeholders', async () => {
      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { value: '<user_input>' }
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should allow valid parameters', async () => {
      // Mock successful fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });

      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { orderId: 'ORD-12345', customerName: 'John Smith' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle fetch timeout', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { valid: 'params' },
        { timeout: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should handle non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { valid: 'params' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle JSON parse error gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve('not valid json'),
      });

      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { valid: 'params' }
      );

      expect(result.success).toBe(true);
      expect(result.data.error).toBe('Invalid JSON response');
    });

    it('should handle non-JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('Plain text response'),
      });

      const result = await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { valid: 'params' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('Plain text response');
    });

    it('should include integrations in request body', async () => {
      let capturedBody;
      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          headers: new Map([['content-type', 'application/json']]),
          text: () => Promise.resolve(JSON.stringify({ success: true })),
        });
      });

      await n8nService.executeTool(
        'http://localhost:5678/webhook/test',
        { orderId: '123' },
        {
          integrations: {
            order_api: { type: 'rest', apiUrl: 'https://api.example.com' },
          },
        }
      );

      expect(capturedBody._integrations).toBeDefined();
      expect(capturedBody._integrations.order_api).toBeDefined();
    });
  });
});
