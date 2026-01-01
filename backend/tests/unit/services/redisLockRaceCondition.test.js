import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCache } from '../../../src/services/redisCache.js';
import { redisClient } from '../../../src/redis.js';

// Mock Redis client
vi.mock('../../../src/redis.js', () => ({
  redisClient: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    quit: vi.fn(),
  },
}));

describe('Redis Lock Race Condition Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Track lock state
    const lockState = new Map();
    redisClient.set.mockImplementation((key, value, ...args) => {
      if (args.includes('NX')) {
        // NX means "only set if not exists"
        if (lockState.has(key)) {
          return Promise.resolve(null); // Lock already exists
        }
        lockState.set(key, value);
        return Promise.resolve('OK');
      }
      lockState.set(key, value);
      return Promise.resolve('OK');
    });
    redisClient.get.mockImplementation((key) => {
      return Promise.resolve(lockState.get(key) || null);
    });
    redisClient.del.mockImplementation((key) => {
      const existed = lockState.has(key);
      lockState.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    });
    redisClient.exists.mockImplementation((key) => {
      return Promise.resolve(lockState.has(key) ? 1 : 0);
    });
    redisClient.expire.mockImplementation((key, seconds) => {
      if (lockState.has(key)) {
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });
    redisClient.ttl.mockImplementation((key) => {
      if (lockState.has(key)) {
        return Promise.resolve(60); // Mock TTL
      }
      return Promise.resolve(-2);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireLock - Race Condition Prevention', () => {
    it('should prevent concurrent lock acquisition', async () => {
      const lockKey = 'tool:1:get_order_status:{"order_id":"123"}';

      // First acquisition should succeed
      const firstAcquisition = await RedisCache.acquireLock(lockKey, 60);
      expect(firstAcquisition).toBe(true);
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('lock:conversation:'),
        '1',
        'EX',
        60,
        'NX'
      );

      // Second concurrent acquisition should fail
      const secondAcquisition = await RedisCache.acquireLock(lockKey, 60);
      expect(secondAcquisition).toBe(false);
    });

    it('should use atomic SET NX operation', async () => {
      const lockKey = 'test-lock';
      await RedisCache.acquireLock(lockKey, 30);

      // Verify NX flag is used (prevents race conditions)
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        '1',
        'EX',
        30,
        'NX'
      );
    });

    it('should prevent duplicate tool execution with same parameters', async () => {
      const conversationId = 1;
      const toolName = 'get_order_status';
      const toolArgs = { order_id: '12345' };
      const lockKey = `tool:${conversationId}:${toolName}:${JSON.stringify(toolArgs)}`;

      // First execution acquires lock
      const firstLock = await RedisCache.acquireLock(lockKey, 60);
      expect(firstLock).toBe(true);

      // Concurrent execution attempt (race condition scenario)
      const secondLock = await RedisCache.acquireLock(lockKey, 60);
      expect(secondLock).toBe(false); // Should be blocked
    });

    it('should allow different tool executions with different parameters', async () => {
      const conversationId = 1;
      const toolName = 'get_order_status';

      const lockKey1 = `tool:${conversationId}:${toolName}:${JSON.stringify({ order_id: '123' })}`;
      const lockKey2 = `tool:${conversationId}:${toolName}:${JSON.stringify({ order_id: '456' })}`;

      const lock1 = await RedisCache.acquireLock(lockKey1, 60);
      const lock2 = await RedisCache.acquireLock(lockKey2, 60);

      expect(lock1).toBe(true);
      expect(lock2).toBe(true); // Different parameters = different lock
    });

    it('should allow same tool execution after lock release', async () => {
      const lockKey = 'tool:1:get_order_status:{"order_id":"123"}';

      // Acquire lock
      const firstLock = await RedisCache.acquireLock(lockKey, 60);
      expect(firstLock).toBe(true);

      // Release lock
      await RedisCache.releaseLock(lockKey);

      // Should be able to acquire again
      const secondLock = await RedisCache.acquireLock(lockKey, 60);
      expect(secondLock).toBe(true);
    });
  });

  describe('Concurrent Tool Execution Simulation', () => {
    it('should prevent race condition in duplicate detection', async () => {
      const conversationId = 1;
      const toolName = 'book_appointment';
      const toolArgs = { date: '2024-01-15', time: '14:00' };
      const lockKey = `tool:${conversationId}:${toolName}:${JSON.stringify(toolArgs)}`;

      // Simulate two concurrent requests trying to execute the same tool
      const promises = [
        RedisCache.acquireLock(lockKey, 60),
        RedisCache.acquireLock(lockKey, 60),
      ];

      const results = await Promise.all(promises);

      // Only one should succeed
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBe(1);
    });

    it('should handle multiple concurrent tool executions correctly', async () => {
      const conversationId = 1;
      const toolName = 'get_order_status';

      // Simulate 5 concurrent requests for the same tool with same args
      const toolArgs = { order_id: '12345' };
      const lockKey = `tool:${conversationId}:${toolName}:${JSON.stringify(toolArgs)}`;

      const promises = Array(5)
        .fill(null)
        .map(() => RedisCache.acquireLock(lockKey, 60));

      const results = await Promise.all(promises);

      // Only the first one should succeed
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBe(1);
    });

    it('should allow concurrent executions of different tools', async () => {
      const conversationId = 1;

      const lockKey1 = `tool:${conversationId}:get_order_status:${JSON.stringify({ order_id: '123' })}`;
      const lockKey2 = `tool:${conversationId}:book_appointment:${JSON.stringify({ date: '2024-01-15' })}`;

      const promises = [
        RedisCache.acquireLock(lockKey1, 60),
        RedisCache.acquireLock(lockKey2, 60),
      ];

      const results = await Promise.all(promises);

      // Both should succeed (different tools)
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
    });
  });

  describe('Lock TTL and Expiration', () => {
    it('should set custom TTL for tool execution locks', async () => {
      const lockKey = 'tool:1:test_tool:{}';
      await RedisCache.acquireLock(lockKey, 120); // 120 seconds for long operations

      expect(redisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        '1',
        'EX',
        120,
        'NX'
      );
    });

    it('should use default TTL when not specified', async () => {
      const lockKey = 'test-lock';
      await RedisCache.acquireLock(lockKey);

      expect(redisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        '1',
        'EX',
        RedisCache.LOCK_TTL,
        'NX'
      );
    });
  });

  describe('Lock Release and Cleanup', () => {
    it('should release lock after tool execution', async () => {
      const lockKey = 'tool:1:test_tool:{}';
      await RedisCache.acquireLock(lockKey, 60);
      await RedisCache.releaseLock(lockKey);

      const isLocked = await RedisCache.isLocked(lockKey);
      expect(isLocked).toBe(false);
    });

    it('should handle release of non-existent lock gracefully', async () => {
      const lockKey = 'non-existent-lock';
      const released = await RedisCache.releaseLock(lockKey);
      // Should not throw, but may return false
      expect(typeof released).toBe('boolean');
    });
  });

  describe('Integration with Tool Execution Flow', () => {
    it('should simulate complete tool execution flow with lock', async () => {
      const conversationId = 1;
      const toolName = 'get_order_status';
      const toolArgs = { order_id: '12345' };
      const lockKey = `tool:${conversationId}:${toolName}:${JSON.stringify(toolArgs)}`;

      // Step 1: Acquire lock (prevents concurrent execution)
      const lockAcquired = await RedisCache.acquireLock(lockKey, 60);
      expect(lockAcquired).toBe(true);

      // Step 2: Check if already locked (simulate duplicate check)
      const isLocked = await RedisCache.isLocked(lockKey);
      expect(isLocked).toBe(true);

      // Step 3: Simulate tool execution (would happen here)
      // ... tool execution logic ...

      // Step 4: Release lock after execution
      await RedisCache.releaseLock(lockKey);
      const isLockedAfter = await RedisCache.isLocked(lockKey);
      expect(isLockedAfter).toBe(false);
    });

    it('should prevent TOCTOU (Time-Of-Check-Time-Of-Use) race condition', async () => {
      const conversationId = 1;
      const toolName = 'book_appointment';
      const toolArgs = { date: '2024-01-15', time: '14:00' };
      const lockKey = `tool:${conversationId}:${toolName}:${JSON.stringify(toolArgs)}`;

      // Simulate TOCTOU scenario:
      // Request 1: Check if duplicate exists (would query DB)
      // Request 2: Check if duplicate exists (would query DB) - both pass check
      // Request 1: Acquire lock and execute
      // Request 2: Try to acquire lock - should fail

      // Both requests check for duplicates (both would pass in real scenario)
      // Then both try to acquire lock
      const request1Lock = await RedisCache.acquireLock(lockKey, 60);
      const request2Lock = await RedisCache.acquireLock(lockKey, 60);

      // Only one should succeed
      expect(request1Lock || request2Lock).toBe(true);
      expect(request1Lock && request2Lock).toBe(false);
    });
  });
});

