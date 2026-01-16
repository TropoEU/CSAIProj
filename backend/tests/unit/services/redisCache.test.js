import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client with correct methods
vi.mock('../../../src/redis.js', () => ({
  redisClient: {
    setex: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    exists: vi.fn(),
    scan: vi.fn(),
    ping: vi.fn(),
    getdel: vi.fn(),
  },
}));

const { redisClient } = await import('../../../src/redis.js');
const { RedisCache } = await import('../../../src/services/redisCache.js');

describe('RedisCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isConnected', () => {
    it('should return true when Redis responds to ping', async () => {
      redisClient.ping.mockResolvedValueOnce('PONG');

      const result = await RedisCache.isConnected();

      expect(result).toBe(true);
      expect(redisClient.ping).toHaveBeenCalled();
    });

    it('should return false when Redis fails to respond', async () => {
      redisClient.ping.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await RedisCache.isConnected();

      expect(result).toBe(false);
    });
  });

  describe('Conversation Context', () => {
    const testSessionId = 'test-session-123';
    const testContext = {
      client_id: 'client-1',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      metadata: { user_id: 'user123' },
    };

    describe('setConversationContext', () => {
      it('should store conversation context with TTL using setex', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');

        const result = await RedisCache.setConversationContext(testSessionId, testContext);

        expect(result).toBe(true);
        expect(redisClient.setex).toHaveBeenCalledWith(
          `conversation:${testSessionId}`,
          RedisCache.CONVERSATION_TTL,
          expect.any(String)
        );
      });

      it('should include last_activity timestamp', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');

        await RedisCache.setConversationContext(testSessionId, testContext);

        const callArgs = redisClient.setex.mock.calls[0];
        const storedData = JSON.parse(callArgs[2]);
        expect(storedData).toHaveProperty('last_activity');
      });

      it('should return false on error', async () => {
        redisClient.setex.mockRejectedValueOnce(new Error('Redis error'));

        const result = await RedisCache.setConversationContext(testSessionId, testContext);

        expect(result).toBe(false);
      });
    });

    describe('getConversationContext', () => {
      it('should retrieve and parse conversation context', async () => {
        redisClient.get.mockResolvedValueOnce(JSON.stringify(testContext));

        const result = await RedisCache.getConversationContext(testSessionId);

        expect(result).toEqual(testContext);
        expect(redisClient.get).toHaveBeenCalledWith(`conversation:${testSessionId}`);
      });

      it('should return null when context not found', async () => {
        redisClient.get.mockResolvedValueOnce(null);

        const result = await RedisCache.getConversationContext(testSessionId);

        expect(result).toBeNull();
      });

      it('should return null on parse error', async () => {
        redisClient.get.mockResolvedValueOnce('invalid json');

        const result = await RedisCache.getConversationContext(testSessionId);

        expect(result).toBeNull();
      });
    });

    describe('updateConversationContext', () => {
      it('should merge updates with existing context', async () => {
        redisClient.get.mockResolvedValueOnce(JSON.stringify(testContext));
        redisClient.setex.mockResolvedValueOnce('OK');

        const updates = {
          messages: [...testContext.messages, { role: 'user', content: 'New message' }],
        };

        const result = await RedisCache.updateConversationContext(testSessionId, updates);

        expect(result.messages).toHaveLength(3);
        expect(redisClient.setex).toHaveBeenCalled();
      });

      it('should return null if context does not exist', async () => {
        redisClient.get.mockResolvedValueOnce(null);

        const result = await RedisCache.updateConversationContext(testSessionId, { test: true });

        expect(result).toBeNull();
      });
    });

    describe('deleteConversationContext', () => {
      it('should delete conversation context and return true', async () => {
        redisClient.del.mockResolvedValueOnce(1);

        const result = await RedisCache.deleteConversationContext(testSessionId);

        expect(result).toBe(true);
        expect(redisClient.del).toHaveBeenCalledWith(`conversation:${testSessionId}`);
      });

      it('should return false when key does not exist', async () => {
        redisClient.del.mockResolvedValueOnce(0);

        const result = await RedisCache.deleteConversationContext(testSessionId);

        expect(result).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    const testClientId = 'client-123';
    const maxRequests = 60;

    describe('checkRateLimit', () => {
      it('should allow request when under limit', async () => {
        redisClient.incr.mockResolvedValueOnce(5);
        redisClient.ttl.mockResolvedValueOnce(45);

        const result = await RedisCache.checkRateLimit(testClientId, maxRequests);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(55);
      });

      it('should block request when limit exceeded', async () => {
        redisClient.incr.mockResolvedValueOnce(61);
        redisClient.ttl.mockResolvedValueOnce(30);

        const result = await RedisCache.checkRateLimit(testClientId, maxRequests);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should set TTL on first request (count === 1)', async () => {
        redisClient.incr.mockResolvedValueOnce(1);
        redisClient.expire.mockResolvedValueOnce(1);
        redisClient.ttl.mockResolvedValueOnce(60);

        await RedisCache.checkRateLimit(testClientId, maxRequests);

        expect(redisClient.expire).toHaveBeenCalled();
      });

      it('should fail open on Redis error', async () => {
        redisClient.incr.mockRejectedValueOnce(new Error('Redis error'));

        const result = await RedisCache.checkRateLimit(testClientId, maxRequests);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(60);
      });
    });

    describe('getRateLimitStatus', () => {
      it('should return current rate limit status without incrementing', async () => {
        redisClient.get.mockResolvedValueOnce('25');
        redisClient.ttl.mockResolvedValueOnce(45);

        const result = await RedisCache.getRateLimitStatus(testClientId, maxRequests);

        expect(result.count).toBe(25);
        expect(result.remaining).toBe(35);
        expect(result.resetIn).toBe(45);
        expect(redisClient.incr).not.toHaveBeenCalled();
      });

      it('should return 0 count when no key exists', async () => {
        redisClient.get.mockResolvedValueOnce(null);
        redisClient.ttl.mockResolvedValueOnce(-2);

        const result = await RedisCache.getRateLimitStatus(testClientId, maxRequests);

        expect(result.count).toBe(0);
        expect(result.remaining).toBe(60);
      });
    });
  });

  describe('Response Caching', () => {
    const testHash = 'abc123hash';
    const testClientId = 'client-456';
    const testResponse = {
      text: 'This is a cached response',
      tokens: 10,
      model: 'gpt-4',
    };

    describe('cacheResponse', () => {
      it('should cache response with client-specific key using setex', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');

        await RedisCache.cacheResponse(testHash, testResponse, testClientId);

        expect(redisClient.setex).toHaveBeenCalledWith(
          `cache:${testClientId}:${testHash}`,
          RedisCache.CACHE_TTL,
          expect.any(String)
        );
      });

      it('should cache response with global key when no client ID', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');

        await RedisCache.cacheResponse(testHash, testResponse);

        expect(redisClient.setex).toHaveBeenCalledWith(
          `cache:${testHash}`,
          RedisCache.CACHE_TTL,
          expect.any(String)
        );
      });

      it('should accept custom TTL', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');
        const customTtl = 600;

        await RedisCache.cacheResponse(testHash, testResponse, testClientId, customTtl);

        expect(redisClient.setex).toHaveBeenCalledWith(
          expect.any(String),
          customTtl,
          expect.any(String)
        );
      });
    });

    describe('getCachedResponse', () => {
      it('should retrieve cached response', async () => {
        const cachedData = { response: testResponse, cached_at: new Date().toISOString() };
        redisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));

        const result = await RedisCache.getCachedResponse(testHash, testClientId);

        expect(result).toMatchObject({ response: testResponse });
      });

      it('should return null when no cached response', async () => {
        redisClient.get.mockResolvedValueOnce(null);

        const result = await RedisCache.getCachedResponse(testHash, testClientId);

        expect(result).toBeNull();
      });
    });

    describe('deleteCachedResponse', () => {
      it('should delete cached response and return true', async () => {
        redisClient.del.mockResolvedValueOnce(1);

        const result = await RedisCache.deleteCachedResponse(testHash, testClientId);

        expect(result).toBe(true);
        expect(redisClient.del).toHaveBeenCalledWith(`cache:${testClientId}:${testHash}`);
      });
    });
  });

  describe('Session Locks', () => {
    const testSessionId = 'session-789';

    describe('acquireLock', () => {
      it('should acquire lock when not held', async () => {
        redisClient.set.mockResolvedValueOnce('OK');

        const result = await RedisCache.acquireLock(testSessionId);

        expect(result).toBe(true);
        expect(redisClient.set).toHaveBeenCalledWith(
          `lock:conversation:${testSessionId}`,
          '1',
          'EX',
          RedisCache.LOCK_TTL,
          'NX'
        );
      });

      it('should fail to acquire lock when already held', async () => {
        redisClient.set.mockResolvedValueOnce(null);

        const result = await RedisCache.acquireLock(testSessionId);

        expect(result).toBe(false);
      });
    });

    describe('releaseLock', () => {
      it('should release lock and return true', async () => {
        redisClient.del.mockResolvedValueOnce(1);

        const result = await RedisCache.releaseLock(testSessionId);

        expect(result).toBe(true);
        expect(redisClient.del).toHaveBeenCalledWith(`lock:conversation:${testSessionId}`);
      });
    });

    describe('isLocked', () => {
      it('should return true when lock exists', async () => {
        redisClient.exists.mockResolvedValueOnce(1);

        const result = await RedisCache.isLocked(testSessionId);

        expect(result).toBe(true);
      });

      it('should return false when lock does not exist', async () => {
        redisClient.exists.mockResolvedValueOnce(0);

        const result = await RedisCache.isLocked(testSessionId);

        expect(result).toBe(false);
      });
    });

    describe('extendLock', () => {
      it('should extend lock TTL', async () => {
        redisClient.exists.mockResolvedValueOnce(1);
        redisClient.ttl.mockResolvedValueOnce(20);
        redisClient.expire.mockResolvedValueOnce(1);

        const result = await RedisCache.extendLock(testSessionId, 30);

        expect(result).toBe(true);
        expect(redisClient.expire).toHaveBeenCalledWith(
          `lock:conversation:${testSessionId}`,
          50 // 20 + 30
        );
      });

      it('should return false when lock does not exist', async () => {
        redisClient.exists.mockResolvedValueOnce(0);

        const result = await RedisCache.extendLock(testSessionId, 60);

        expect(result).toBe(false);
      });
    });
  });

  describe('Pending Intent', () => {
    const conversationId = 'conv-123';
    const testIntent = {
      tool: 'book_table',
      params: { date: '2024-01-15' },
      hash: 'abcd1234',
    };

    describe('setPendingIntent', () => {
      it('should store pending intent with TTL', async () => {
        redisClient.setex.mockResolvedValueOnce('OK');

        const result = await RedisCache.setPendingIntent(conversationId, testIntent);

        expect(result).toBe(true);
        expect(redisClient.setex).toHaveBeenCalledWith(
          `pending_intent:${conversationId}`,
          RedisCache.PENDING_INTENT_TTL,
          expect.any(String)
        );
      });

      it('should return false on error', async () => {
        redisClient.setex.mockRejectedValueOnce(new Error('Redis error'));

        const result = await RedisCache.setPendingIntent(conversationId, testIntent);

        expect(result).toBe(false);
      });
    });

    describe('getPendingIntent', () => {
      it('should retrieve pending intent', async () => {
        const storedIntent = { ...testIntent, stored_at: '2024-01-15T10:00:00Z' };
        redisClient.get.mockResolvedValueOnce(JSON.stringify(storedIntent));

        const result = await RedisCache.getPendingIntent(conversationId);

        expect(result).toEqual(storedIntent);
      });

      it('should return null when not found', async () => {
        redisClient.get.mockResolvedValueOnce(null);

        const result = await RedisCache.getPendingIntent(conversationId);

        expect(result).toBeNull();
      });
    });

    describe('clearPendingIntent', () => {
      it('should delete pending intent', async () => {
        redisClient.del.mockResolvedValueOnce(1);

        const result = await RedisCache.clearPendingIntent(conversationId);

        expect(result).toBe(true);
      });
    });

    describe('getAndClearPendingIntent', () => {
      it('should atomically get and delete pending intent', async () => {
        const storedIntent = { ...testIntent, stored_at: '2024-01-15T10:00:00Z' };
        redisClient.getdel.mockResolvedValueOnce(JSON.stringify(storedIntent));

        const result = await RedisCache.getAndClearPendingIntent(conversationId);

        expect(result).toEqual(storedIntent);
        expect(redisClient.getdel).toHaveBeenCalledWith(`pending_intent:${conversationId}`);
      });

      it('should return null when not found', async () => {
        redisClient.getdel.mockResolvedValueOnce(null);

        const result = await RedisCache.getAndClearPendingIntent(conversationId);

        expect(result).toBeNull();
      });
    });

    describe('verifyPendingIntent', () => {
      it('should return matches: true when hashes match', async () => {
        const storedIntent = { ...testIntent, stored_at: '2024-01-15T10:00:00Z' };
        redisClient.get.mockResolvedValueOnce(JSON.stringify(storedIntent));

        const result = await RedisCache.verifyPendingIntent(conversationId, testIntent.hash);

        expect(result.matches).toBe(true);
        expect(result.intent).toEqual(storedIntent);
      });

      it('should return matches: false when hashes do not match', async () => {
        const storedIntent = { ...testIntent, stored_at: '2024-01-15T10:00:00Z' };
        redisClient.get.mockResolvedValueOnce(JSON.stringify(storedIntent));

        const result = await RedisCache.verifyPendingIntent(conversationId, 'different-hash');

        expect(result.matches).toBe(false);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getTTL', () => {
      it('should return TTL for key', async () => {
        redisClient.ttl.mockResolvedValueOnce(3600);

        const result = await RedisCache.getTTL('some:key');

        expect(result).toBe(3600);
      });
    });

    describe('clearClientCache', () => {
      it('should clear all cache keys for client using SCAN', async () => {
        // First scan returns some keys
        redisClient.scan.mockResolvedValueOnce(['5', ['cache:client-1:hash1', 'cache:client-1:hash2']]);
        redisClient.del.mockResolvedValueOnce(2);
        // Second scan returns more keys
        redisClient.scan.mockResolvedValueOnce(['0', ['cache:client-1:hash3']]);
        redisClient.del.mockResolvedValueOnce(1);

        const result = await RedisCache.clearClientCache('client-1');

        expect(result).toBe(3);
        expect(redisClient.scan).toHaveBeenCalledTimes(2);
      });

      it('should return 0 when no keys found', async () => {
        redisClient.scan.mockResolvedValueOnce(['0', []]);

        const result = await RedisCache.clearClientCache('client-1');

        expect(result).toBe(0);
      });
    });

    describe('hashQuery', () => {
      it('should generate consistent hash for query', () => {
        const hash1 = RedisCache.hashQuery('test query', 'client-1');
        const hash2 = RedisCache.hashQuery('test query', 'client-1');

        expect(hash1).toBe(hash2);
      });

      it('should generate different hashes for different queries', () => {
        const hash1 = RedisCache.hashQuery('query 1', 'client-1');
        const hash2 = RedisCache.hashQuery('query 2', 'client-1');

        expect(hash1).not.toBe(hash2);
      });

      it('should generate different hashes for different clients', () => {
        const hash1 = RedisCache.hashQuery('same query', 'client-1');
        const hash2 = RedisCache.hashQuery('same query', 'client-2');

        expect(hash1).not.toBe(hash2);
      });

      it('should be case insensitive', () => {
        const hash1 = RedisCache.hashQuery('Test Query', 'client-1');
        const hash2 = RedisCache.hashQuery('test query', 'client-1');

        expect(hash1).toBe(hash2);
      });
    });
  });
});
