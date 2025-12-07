import { RedisCache } from '../../src/services/redisCache.js';
import { redisClient } from '../../src/redis.js';
import crypto from 'crypto';

/**
 * Test Redis Cache Service
 * Tests all Redis schema operations: conversation context, rate limiting, caching, and locks
 */

async function testRedisCache() {
    console.log('🧪 Testing Redis Cache Service...\n');

    try {
        // Check Redis connection
        const connected = await RedisCache.isConnected();
        if (!connected) {
            throw new Error('Redis is not connected. Make sure Redis is running.');
        }
        console.log('✅ Redis connection verified\n');

        // Generate test IDs
        const testSessionId = `test-session-${Date.now()}`;
        const testClientId = `test-client-${Date.now()}`;
        const testQueryHash = crypto.createHash('md5').update('test query').digest('hex');

        // ============================================
        // TEST 1: Conversation Context
        // ============================================
        console.log('1. Testing Conversation Context...');
        
        // Test 1.1: Set conversation context
        const context = {
            client_id: testClientId,
            messages: [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ],
            metadata: { user_id: 'user123' }
        };
        await RedisCache.setConversationContext(testSessionId, context);
        console.log('   ✅ Set conversation context');

        // Test 1.2: Get conversation context
        const retrieved = await RedisCache.getConversationContext(testSessionId);
        if (!retrieved || retrieved.client_id !== testClientId) {
            throw new Error('Failed to retrieve conversation context');
        }
        console.log('   ✅ Retrieved conversation context');

        // Test 1.3: Update conversation context
        const updates = {
            messages: [
                ...context.messages,
                { role: 'user', content: 'How are you?' }
            ]
        };
        const updated = await RedisCache.updateConversationContext(testSessionId, updates);
        if (!updated || updated.messages.length !== 3) {
            throw new Error('Failed to update conversation context');
        }
        console.log('   ✅ Updated conversation context');

        // Test 1.4: Delete conversation context
        await RedisCache.deleteConversationContext(testSessionId);
        const deleted = await RedisCache.getConversationContext(testSessionId);
        if (deleted !== null) {
            throw new Error('Failed to delete conversation context');
        }
        console.log('   ✅ Deleted conversation context');

        // ============================================
        // TEST 2: Rate Limiting
        // ============================================
        console.log('\n2. Testing Rate Limiting...');

        // Test 2.1: Check rate limit (should allow)
        const rateLimit1 = await RedisCache.checkRateLimit(testClientId, 10);
        if (!rateLimit1.allowed || rateLimit1.remaining !== 9) {
            throw new Error('Rate limit check failed');
        }
        console.log(`   ✅ Rate limit check: ${rateLimit1.remaining} remaining`);

        // Test 2.2: Make multiple requests
        for (let i = 0; i < 5; i++) {
            await RedisCache.checkRateLimit(testClientId, 10);
        }
        const rateLimit2 = await RedisCache.checkRateLimit(testClientId, 10);
        // After 1 initial + 5 in loop + 1 here = 7 total requests
        // Remaining should be 10 - 7 = 3
        if (rateLimit2.remaining !== 3) {
            throw new Error(`Rate limit counting failed. Expected 3 remaining, got ${rateLimit2.remaining}`);
        }
        console.log(`   ✅ Rate limit counting: ${rateLimit2.remaining} remaining after 7 requests`);

        // Test 2.3: Get rate limit status without incrementing
        const status = await RedisCache.getRateLimitStatus(testClientId, 10);
        // After 7 calls total (1 initial + 5 in loop + 1 final), count should be 7
        if (status.count !== 7) {
            throw new Error(`Rate limit status check failed. Expected count 7, got ${status.count}`);
        }
        console.log(`   ✅ Rate limit status: ${status.count} requests, ${status.remaining} remaining`);

        // Test 2.4: Exceed rate limit
        const testClientId2 = `test-client-${Date.now()}`;
        for (let i = 0; i < 10; i++) {
            await RedisCache.checkRateLimit(testClientId2, 10);
        }
        const rateLimit3 = await RedisCache.checkRateLimit(testClientId2, 10);
        if (rateLimit3.allowed !== false || rateLimit3.remaining !== 0) {
            throw new Error('Rate limit exceeded check failed');
        }
        console.log('   ✅ Rate limit exceeded correctly blocked');

        // ============================================
        // TEST 3: Response Caching
        // ============================================
        console.log('\n3. Testing Response Caching...');

        // Test 3.1: Cache response
        const response = {
            text: 'This is a cached response',
            tokens: 10,
            model: 'gpt-4'
        };
        await RedisCache.cacheResponse(testQueryHash, response, testClientId);
        console.log('   ✅ Cached response');

        // Test 3.2: Get cached response
        const cached = await RedisCache.getCachedResponse(testQueryHash, testClientId);
        if (!cached || cached.response.text !== response.text) {
            throw new Error('Failed to retrieve cached response');
        }
        console.log('   ✅ Retrieved cached response');

        // Test 3.3: Cache without client ID
        const globalHash = crypto.createHash('md5').update('global query').digest('hex');
        await RedisCache.cacheResponse(globalHash, response);
        const globalCached = await RedisCache.getCachedResponse(globalHash);
        if (!globalCached) {
            throw new Error('Failed to cache/retrieve global response');
        }
        console.log('   ✅ Global caching works');

        // Test 3.4: Delete cached response
        await RedisCache.deleteCachedResponse(testQueryHash, testClientId);
        const deletedCache = await RedisCache.getCachedResponse(testQueryHash, testClientId);
        if (deletedCache !== null) {
            throw new Error('Failed to delete cached response');
        }
        console.log('   ✅ Deleted cached response');

        // ============================================
        // TEST 4: Session Locks
        // ============================================
        console.log('\n4. Testing Session Locks...');

        // Test 4.1: Acquire lock
        const lockAcquired = await RedisCache.acquireLock(testSessionId);
        if (!lockAcquired) {
            throw new Error('Failed to acquire lock');
        }
        console.log('   ✅ Acquired lock');

        // Test 4.2: Try to acquire same lock again (should fail)
        const lockAcquired2 = await RedisCache.acquireLock(testSessionId);
        if (lockAcquired2) {
            throw new Error('Should not be able to acquire lock twice');
        }
        console.log('   ✅ Lock correctly prevents duplicate acquisition');

        // Test 4.3: Check if locked
        const isLocked = await RedisCache.isLocked(testSessionId);
        if (!isLocked) {
            throw new Error('Lock status check failed');
        }
        console.log('   ✅ Lock status check works');

        // Test 4.4: Extend lock
        const extended = await RedisCache.extendLock(testSessionId, 60);
        if (!extended) {
            throw new Error('Failed to extend lock');
        }
        const ttl = await RedisCache.getTTL(`lock:conversation:${testSessionId}`);
        if (ttl < 60) {
            throw new Error('Lock extension failed');
        }
        console.log('   ✅ Extended lock TTL');

        // Test 4.5: Release lock
        await RedisCache.releaseLock(testSessionId);
        const isLockedAfter = await RedisCache.isLocked(testSessionId);
        if (isLockedAfter) {
            throw new Error('Failed to release lock');
        }
        console.log('   ✅ Released lock');

        // Test 4.6: Acquire lock after release
        const lockAcquired3 = await RedisCache.acquireLock(testSessionId);
        if (!lockAcquired3) {
            throw new Error('Failed to acquire lock after release');
        }
        await RedisCache.releaseLock(testSessionId);
        console.log('   ✅ Can acquire lock after release');

        // ============================================
        // TEST 5: Utility Methods
        // ============================================
        console.log('\n5. Testing Utility Methods...');

        // Test 5.1: Clear client cache
        await RedisCache.cacheResponse('hash1', { data: 'test1' }, testClientId);
        await RedisCache.cacheResponse('hash2', { data: 'test2' }, testClientId);
        const deletedCount = await RedisCache.clearClientCache(testClientId);
        if (deletedCount < 2) {
            throw new Error('Failed to clear client cache');
        }
        console.log(`   ✅ Cleared client cache (${deletedCount} keys deleted)`);

        // Test 5.2: Get TTL
        await RedisCache.setConversationContext(testSessionId, context);
        const conversationTTL = await RedisCache.getTTL(`conversation:${testSessionId}`);
        if (conversationTTL <= 0 || conversationTTL > 3600) {
            throw new Error('TTL check failed');
        }
        console.log(`   ✅ TTL check works (${conversationTTL}s remaining)`);

        // Cleanup
        await RedisCache.deleteConversationContext(testSessionId);
        await RedisCache.releaseLock(testSessionId);

        console.log('\n✅ All Redis Cache Service tests passed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Close Redis connection
        await redisClient.quit();
        process.exit(0);
    }
}

testRedisCache();

