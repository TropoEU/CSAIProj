/**
 * Check all service connections
 * Run with: npm run check:connections
 */

import { POSTGRES_CONFIG, REDIS_CONFIG, OLLAMA_CONFIG, N8N_CONFIG } from '../config.js';
import { db } from '../db.js';
import { redisClient as redis } from '../redis.js';

console.log('🔍 Checking all service connections...\n');

// Show configurations
console.log('Configuration:');
console.log('─'.repeat(60));
console.log('📊 PostgreSQL:', `${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`);
console.log('💾 Redis:', `${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);
console.log('🦙 Ollama:', OLLAMA_CONFIG.url);
console.log('🔧 n8n:', `http://${N8N_CONFIG.host}:${N8N_CONFIG.port}`);
console.log('─'.repeat(60));
console.log('');

let allPassed = true;

// Test PostgreSQL
async function testPostgres() {
  console.log('📊 Testing PostgreSQL connection...');
  try {
    const result = await db.query('SELECT NOW() as time, version()');
    console.log('✅ PostgreSQL connected');
    console.log('   Server time:', result.rows[0].time);
    console.log('   Version:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    allPassed = false;
    return false;
  }
}

// Test Redis
async function testRedis() {
  console.log('\n💾 Testing Redis connection...');
  try {
    const pong = await redis.ping();
    console.log('✅ Redis connected');
    console.log('   Response:', pong);

    // Test set/get
    await redis.set('test-key', 'test-value', 'EX', 10);
    const value = await redis.get('test-key');
    console.log('   Set/Get test:', value === 'test-value' ? '✅ Working' : '❌ Failed');
    await redis.del('test-key');

    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    allPassed = false;
    return false;
  }
}

// Test Ollama
async function testOllama() {
  console.log('\n🦙 Testing Ollama connection...');
  try {
    const response = await fetch(`${OLLAMA_CONFIG.url}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log('✅ Ollama connected');
    console.log('   Models available:', data.models.length);
    return true;
  } catch (error) {
    console.error('❌ Ollama connection failed:', error.message);
    allPassed = false;
    return false;
  }
}

// Test n8n
async function testN8n() {
  console.log('\n🔧 Testing n8n connection...');
  try {
    const response = await fetch(`http://${N8N_CONFIG.host}:${N8N_CONFIG.port}/healthz`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log('✅ n8n connected');
    console.log('   Status:', data.status || 'ok');
    return true;
  } catch (error) {
    console.error('❌ n8n connection failed:', error.message);
    console.log('   Note: Make sure Docker services are running (npm run dockerup)');
    allPassed = false;
    return false;
  }
}

async function runTests() {
  await testPostgres();
  await testRedis();
  await testOllama();
  await testN8n();

  console.log('\n' + '═'.repeat(60));
  if (allPassed) {
    console.log('🎉 All services connected successfully!');
    console.log('═'.repeat(60));
    process.exit(0);
  } else {
    console.log('⚠️  Some services failed to connect');
    console.log('═'.repeat(60));
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure Docker is running: npm run dockerup');
    console.log('  2. Check Docker containers: docker ps');
    console.log('  3. Make sure Ollama is running on Windows');
    process.exit(1);
  }
}

runTests();
