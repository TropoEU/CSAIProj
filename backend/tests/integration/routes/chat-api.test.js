/**
 * Tests for Chat API
 *
 * Tests the /chat endpoints with mocked database and LLM.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn()
  }
}));

// Mock Redis
vi.mock('../../../src/redis.js', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    isReady: true
  }
}));

// Mock the LLM service
vi.mock('../../../src/services/llmService.js', () => ({
  default: {
    chat: vi.fn().mockResolvedValue({
      content: 'This is a mocked AI response for testing.',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    }),
    isReady: vi.fn().mockReturnValue(true),
    getProviderInfo: vi.fn().mockReturnValue({ provider: 'mock', model: 'test-model' }),
    supportsNativeFunctionCalling: vi.fn().mockReturnValue(false)
  }
}));

// Mock the adaptive reasoning service
vi.mock('../../../src/services/adaptiveReasoningService.js', () => ({
  default: {
    processAdaptiveMessage: vi.fn().mockResolvedValue({
      response: 'This is a mocked adaptive response for testing.',
      conversationId: 1,
      metrics: { totalInputTokens: 100, totalOutputTokens: 50, critiqueTriggered: false, contextFetchCount: 0 }
    })
  }
}));

// Mock the conversation service
vi.mock('../../../src/services/conversationService.js', () => ({
  default: {
    processMessage: vi.fn().mockResolvedValue({
      response: 'Mocked response',
      conversationId: 1,
      usage: { totalInputTokens: 100, totalOutputTokens: 50 }
    }),
    getConversationHistory: vi.fn().mockResolvedValue([]),
    endConversation: vi.fn().mockResolvedValue(true)
  }
}));

// Mock Redis cache service
vi.mock('../../../src/services/redisCache.js', () => ({
  RedisCache: {
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetIn: 60 }),
    acquireLock: vi.fn().mockResolvedValue(true),
    releaseLock: vi.fn().mockResolvedValue(true),
    getConversationContext: vi.fn().mockResolvedValue(null),
    setConversationContext: vi.fn().mockResolvedValue(true)
  }
}));

import { db } from '../../../src/db.js';
import { RedisCache } from '../../../src/services/redisCache.js';
import conversationService from '../../../src/services/conversationService.js';

describe('Chat API', () => {
  const testClientApiKey = 'test_api_key_12345';
  const testClientId = 1;
  const testSessionId = 'test_session_' + Date.now();

  // Mock client data
  const mockClient = {
    id: testClientId,
    name: 'Test Client',
    api_key: testClientApiKey,
    language: 'en',
    status: 'active',
    plan_type: 'pro',
    widget_config: {},
    business_info: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses for database
    db.query.mockImplementation((query, params) => {
      // Client lookup by API key
      if (query.includes('SELECT') && query.includes('clients') && query.includes('api_key')) {
        if (params && params[0] === testClientApiKey) {
          return Promise.resolve({ rows: [mockClient] });
        }
        return Promise.resolve({ rows: [] });
      }
      // Get client by ID
      if (query.includes('SELECT') && query.includes('clients') && query.includes('WHERE id')) {
        return Promise.resolve({ rows: [mockClient] });
      }
      // Conversation queries
      if (query.includes('conversations')) {
        return Promise.resolve({ rows: [{ id: 1, session_id: testSessionId, client_id: testClientId }] });
      }
      // Message queries
      if (query.includes('messages')) {
        return Promise.resolve({ rows: [] });
      }
      // Plan queries
      if (query.includes('plans')) {
        return Promise.resolve({ rows: [{ name: 'pro', ai_mode: 'standard' }] });
      }
      // Default
      return Promise.resolve({ rows: [] });
    });

    // Reset conversation service mock
    conversationService.processMessage.mockResolvedValue({
      response: 'Mocked response',
      conversationId: 1,
      usage: { totalInputTokens: 100, totalOutputTokens: 50 }
    });
  });

  describe('GET /chat/config', () => {
    it('should return client configuration', async () => {
      const res = await request(app)
        .get('/chat/config')
        .set('Authorization', `Bearer ${testClientApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('language');
      expect(res.body).toHaveProperty('widgetConfig');
    });

    it('should reject without API key', async () => {
      const res = await request(app).get('/chat/config');
      expect(res.status).toBe(401);
    });

    it('should reject invalid API key', async () => {
      const res = await request(app)
        .get('/chat/config')
        .set('Authorization', 'Bearer invalid_key_12345');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /chat/message', () => {
    it('should process a message and return response', async () => {
      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          sessionId: testSessionId,
          message: 'Hello, this is a test message'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('response');
      expect(res.body).toHaveProperty('conversationId');
    });

    it('should reject empty message', async () => {
      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          sessionId: testSessionId,
          message: ''
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing sessionId', async () => {
      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          message: 'Test message without session'
        });

      expect(res.status).toBe(400);
    });

    it('should reject without API key', async () => {
      const res = await request(app)
        .post('/chat/message')
        .send({
          sessionId: 'test',
          message: 'Test'
        });

      expect(res.status).toBe(401);
    });

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(5000);
      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          sessionId: testSessionId + '_long',
          message: longMessage
        });

      // Should succeed with mocked services
      expect(res.status).toBe(200);
    });
  });

  describe('GET /chat/history/:sessionId', () => {
    it('should return conversation history', async () => {
      conversationService.getConversationHistory.mockResolvedValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);

      const res = await request(app)
        .get(`/chat/history/${testSessionId}`)
        .set('Authorization', `Bearer ${testClientApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('should return empty messages for non-existent session', async () => {
      conversationService.getConversationHistory.mockResolvedValue([]);

      const res = await request(app)
        .get('/chat/history/non_existent_session_12345')
        .set('Authorization', `Bearer ${testClientApiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });

    it('should reject without API key', async () => {
      const res = await request(app)
        .get(`/chat/history/${testSessionId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /chat/end', () => {
    it('should end a conversation', async () => {
      const res = await request(app)
        .post('/chat/end')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({ sessionId: testSessionId });

      expect([200, 404]).toContain(res.status);
    });

    it('should reject without sessionId', async () => {
      const res = await request(app)
        .post('/chat/end')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits when exceeded', async () => {
      // Mock rate limit exceeded
      RedisCache.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetIn: 45
      });

      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          sessionId: testSessionId,
          message: 'Test message'
        });

      expect(res.status).toBe(429);
    });

    it('should allow requests when under rate limit', async () => {
      // Mock rate limit not exceeded
      RedisCache.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 59,
        resetIn: 60
      });

      const res = await request(app)
        .post('/chat/message')
        .set('Authorization', `Bearer ${testClientApiKey}`)
        .send({
          sessionId: testSessionId,
          message: 'Test message'
        });

      expect(res.status).toBe(200);
    });
  });
});
