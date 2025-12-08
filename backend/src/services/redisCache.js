import { redisClient } from '../redis.js';
import crypto from 'crypto';

/**
 * Redis Cache Service
 *
 * Implements Redis schema design for:
 * - Active conversation context caching
 * - Rate limiting per client
 * - Response caching to save API costs
 * - Session locks to prevent duplicate processing
 */
export class RedisCache {
    // Key prefixes
    static CONVERSATION_PREFIX = 'conversation:';
    static RATE_LIMIT_PREFIX = 'rate_limit:';
    static CACHE_PREFIX = 'cache:';
    static LOCK_PREFIX = 'lock:conversation:';

    // TTL values (in seconds)
    static CONVERSATION_TTL = 3600; // 1 hour
    static RATE_LIMIT_TTL = 60; // 60 seconds
    static CACHE_TTL = 300; // 5 minutes
    static LOCK_TTL = 30; // 30 seconds

    /**
     * ============================================
     * ACTIVE CONVERSATION CONTEXT
     * ============================================
     */

    /**
     * Store active conversation context
     * @param {string} sessionId - Session identifier
     * @param {Object} context - Context data (messages, client_id, last_activity, etc.)
     * @returns {Promise<boolean>} Success status
     */
    static async setConversationContext(sessionId, context) {
        try {
            const key = `${this.CONVERSATION_PREFIX}${sessionId}`;
            const value = JSON.stringify({
                ...context,
                last_activity: new Date().toISOString()
            });

            await redisClient.setex(key, this.CONVERSATION_TTL, value);
            return true;
        } catch (error) {
            console.error('Set conversation context failed:', error);
            return false;
        }
    }

    /**
     * Get active conversation context
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object|null>} Context data or null if not found
     */
    static async getConversationContext(sessionId) {
        try {
            const key = `${this.CONVERSATION_PREFIX}${sessionId}`;
            const value = await redisClient.get(key);

            if (!value) {
                return null;
            }

            return JSON.parse(value);
        } catch (error) {
            console.error('Get conversation context failed:', error);
            return null;
        }
    }

    /**
     * Update conversation context (extends TTL)
     * @param {string} sessionId - Session identifier
     * @param {Object} updates - Partial context updates
     * @returns {Promise<Object|null>} Updated context or null if not found
     */
    static async updateConversationContext(sessionId, updates) {
        const existing = await this.getConversationContext(sessionId);
        
        if (!existing) {
            return null;
        }
        
        const updated = {
            ...existing,
            ...updates,
            last_activity: new Date().toISOString()
        };
        
        await this.setConversationContext(sessionId, updated);
        return updated;
    }

    /**
     * Delete conversation context
     * @param {string} sessionId - Session identifier
     * @returns {Promise<boolean>} Success status
     */
    static async deleteConversationContext(sessionId) {
        const key = `${this.CONVERSATION_PREFIX}${sessionId}`;
        const result = await redisClient.del(key);
        return result > 0;
    }

    /**
     * ============================================
     * RATE LIMITING
     * ============================================
     */

    /**
     * Check if client is within rate limit
     * @param {string|number} clientId - Client identifier
     * @param {number} maxRequests - Maximum requests allowed per minute
     * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
     */
    static async checkRateLimit(clientId, maxRequests = 60) {
        try {
            // Use Unix timestamp divided by 60 to get current minute bucket
            const now = Math.floor(Date.now() / 1000);
            const currentMinute = Math.floor(now / 60);
            const key = `${this.RATE_LIMIT_PREFIX}${clientId}:${currentMinute}`;

            const current = await redisClient.get(key);
            const count = current ? parseInt(current) : 0;

            if (count >= maxRequests) {
                const ttl = await redisClient.ttl(key);
                return {
                    allowed: false,
                    remaining: 0,
                    resetIn: ttl > 0 ? ttl : this.RATE_LIMIT_TTL
                };
            }

            // Increment counter
            let newCount;
            if (count === 0) {
                // First request in this minute, set with TTL
                await redisClient.setex(key, this.RATE_LIMIT_TTL, '1');
                newCount = 1;
            } else {
                // Increment existing counter (preserves TTL)
                newCount = await redisClient.incr(key);
            }

            return {
                allowed: true,
                remaining: maxRequests - newCount,
                resetIn: await redisClient.ttl(key)
            };
        } catch (error) {
            // On Redis error, allow the request (fail open)
            console.error('Rate limit check failed:', error);
            return {
                allowed: true,
                remaining: maxRequests,
                resetIn: this.RATE_LIMIT_TTL
            };
        }
    }

    /**
     * Get current rate limit status without incrementing
     * @param {string|number} clientId - Client identifier
     * @param {number} maxRequests - Maximum requests allowed per minute
     * @returns {Promise<{count: number, remaining: number, resetIn: number}>}
     */
    static async getRateLimitStatus(clientId, maxRequests = 60) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const currentMinute = Math.floor(now / 60);
            const key = `${this.RATE_LIMIT_PREFIX}${clientId}:${currentMinute}`;

            const current = await redisClient.get(key);
            const count = current ? parseInt(current) : 0;
            const ttl = await redisClient.ttl(key);

            return {
                count,
                remaining: Math.max(0, maxRequests - count),
                resetIn: ttl > 0 ? ttl : 0
            };
        } catch (error) {
            console.error('Rate limit status check failed:', error);
            return {
                count: 0,
                remaining: maxRequests,
                resetIn: 0
            };
        }
    }

    /**
     * ============================================
     * RESPONSE CACHING
     * ============================================
     */

    /**
     * Generate cache key from query hash
     * @param {string} queryHash - Hash of the query/question
     * @param {string|number} clientId - Optional client ID for client-specific caching
     * @returns {string} Cache key
     */
    static getCacheKey(queryHash, clientId = null) {
        if (clientId) {
            return `${this.CACHE_PREFIX}${clientId}:${queryHash}`;
        }
        return `${this.CACHE_PREFIX}${queryHash}`;
    }

    /**
     * Cache AI response
     * @param {string} queryHash - Hash of the query/question
     * @param {Object} response - Response data to cache
     * @param {string|number} clientId - Optional client ID
     * @param {number} ttl - Optional custom TTL (default: 5 minutes)
     * @returns {Promise<boolean>} Success status
     */
    static async cacheResponse(queryHash, response, clientId = null, ttl = null) {
        const key = this.getCacheKey(queryHash, clientId);
        const value = JSON.stringify({
            response,
            cached_at: new Date().toISOString()
        });
        
        const cacheTtl = ttl || this.CACHE_TTL;
        await redisClient.setex(key, cacheTtl, value);
        return true;
    }

    /**
     * Get cached response
     * @param {string} queryHash - Hash of the query/question
     * @param {string|number} clientId - Optional client ID
     * @returns {Promise<Object|null>} Cached response or null if not found
     */
    static async getCachedResponse(queryHash, clientId = null) {
        const key = this.getCacheKey(queryHash, clientId);
        const value = await redisClient.get(key);
        
        if (!value) {
            return null;
        }
        
        return JSON.parse(value);
    }

    /**
     * Delete cached response
     * @param {string} queryHash - Hash of the query/question
     * @param {string|number} clientId - Optional client ID
     * @returns {Promise<boolean>} Success status
     */
    static async deleteCachedResponse(queryHash, clientId = null) {
        const key = this.getCacheKey(queryHash, clientId);
        const result = await redisClient.del(key);
        return result > 0;
    }

    /**
     * ============================================
     * SESSION LOCKS
     * ============================================
     */

    /**
     * Acquire a session lock (prevents duplicate processing)
     * @param {string} sessionId - Session identifier
     * @param {number} ttl - Optional custom TTL (default: 30 seconds)
     * @returns {Promise<boolean>} True if lock acquired, false if already locked
     */
    static async acquireLock(sessionId, ttl = null) {
        const key = `${this.LOCK_PREFIX}${sessionId}`;
        const lockTtl = ttl || this.LOCK_TTL;
        
        // Try to set the key only if it doesn't exist (NX = only set if not exists)
        const result = await redisClient.set(key, '1', 'EX', lockTtl, 'NX');
        
        return result === 'OK';
    }

    /**
     * Release a session lock
     * @param {string} sessionId - Session identifier
     * @returns {Promise<boolean>} Success status
     */
    static async releaseLock(sessionId) {
        const key = `${this.LOCK_PREFIX}${sessionId}`;
        const result = await redisClient.del(key);
        return result > 0;
    }

    /**
     * Check if a session is locked
     * @param {string} sessionId - Session identifier
     * @returns {Promise<boolean>} True if locked, false otherwise
     */
    static async isLocked(sessionId) {
        const key = `${this.LOCK_PREFIX}${sessionId}`;
        const exists = await redisClient.exists(key);
        return exists === 1;
    }

    /**
     * Extend lock TTL (useful for long-running operations)
     * @param {string} sessionId - Session identifier
     * @param {number} additionalSeconds - Additional seconds to add
     * @returns {Promise<boolean>} True if lock exists and was extended
     */
    static async extendLock(sessionId, additionalSeconds = 30) {
        const key = `${this.LOCK_PREFIX}${sessionId}`;
        const exists = await redisClient.exists(key);
        
        if (exists === 0) {
            return false;
        }
        
        const ttl = await redisClient.ttl(key);
        if (ttl > 0) {
            await redisClient.expire(key, ttl + additionalSeconds);
            return true;
        }
        
        return false;
    }

    /**
     * ============================================
     * UTILITY METHODS
     * ============================================
     */

    /**
     * Clear all cache entries for a specific client
     * Uses SCAN instead of KEYS to avoid blocking Redis
     * @param {string|number} clientId - Client identifier
     * @returns {Promise<number>} Number of keys deleted
     */
    static async clearClientCache(clientId) {
        try {
            const pattern = `${this.CACHE_PREFIX}${clientId}:*`;
            let cursor = '0';
            let deletedCount = 0;

            do {
                // SCAN returns [cursor, keys] - non-blocking iteration
                const result = await redisClient.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100 // Process 100 keys at a time
                );

                cursor = result[0];
                const keys = result[1];

                if (keys.length > 0) {
                    deletedCount += await redisClient.del(...keys);
                }
            } while (cursor !== '0');

            return deletedCount;
        } catch (error) {
            console.error('Clear client cache failed:', error);
            return 0;
        }
    }

    /**
     * Get TTL for a key
     * @param {string} key - Redis key
     * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
     */
    static async getTTL(key) {
        return await redisClient.ttl(key);
    }

    /**
     * Check if Redis is connected
     * @returns {Promise<boolean>} Connection status
     */
    static async isConnected() {
        try {
            const result = await redisClient.ping();
            return result === 'PONG';
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate MD5 hash for query (used for response caching)
     * @param {string} query - Query text to hash
     * @param {string|number} clientId - Optional client ID to include in hash
     * @returns {string} MD5 hash
     */
    static hashQuery(query, clientId = null) {
        const input = clientId ? `${clientId}:${query}` : query;
        return crypto.createHash('md5').update(input.toLowerCase().trim()).digest('hex');
    }

    /**
     * Flush all Redis data (USE WITH CAUTION - only for testing/dev)
     * @returns {Promise<boolean>} Success status
     */
    static async flushAll() {
        try {
            await redisClient.flushall();
            return true;
        } catch (error) {
            console.error('Flush all failed:', error);
            return false;
        }
    }
}

