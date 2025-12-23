/**
 * LLM Service CI Test
 *
 * Tests the LLM service with Groq provider in CI environment.
 * Requires GROQ_API_KEY environment variable.
 *
 * Run with: node tests/services/llmService.ci.test.js
 */

import llmService from '../../src/services/llmService.js';

console.log('🧪 LLM Service CI Test (Groq)\n');
console.log('═══════════════════════════════════════════\n');

let testsPassed = 0;
let testsFailed = 0;

async function testGroqBasic() {
  console.log('📡 Test 1: Groq Basic Chat...');

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant. Keep responses brief.' },
      { role: 'user', content: 'Say "Hello CI" and nothing else.' }
    ];

    const response = await llmService.chat(messages, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 50,
      temperature: 0
    });

    if (!response.content) {
      throw new Error('No content in response');
    }

    console.log('  ✅ Got response:', response.content.substring(0, 50));
    console.log('  ✅ Provider:', response.provider);
    console.log('  ✅ Tokens:', response.tokens.total);
    testsPassed++;
    return true;
  } catch (error) {
    console.error('  ❌ Failed:', error.message);
    testsFailed++;
    return false;
  }
}

async function testGroqWithTools() {
  console.log('\n🔧 Test 2: Groq Function Calling...');

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant with access to tools. Use the appropriate tool when asked.' },
      { role: 'user', content: 'What is the status of order #12345?' }
    ];

    const tools = [
      {
        name: 'get_order_status',
        description: 'Get the status of an order by order ID',
        parameters: {
          type: 'object',
          properties: {
            order_id: {
              type: 'string',
              description: 'The order ID'
            }
          },
          required: ['order_id']
        }
      }
    ];

    const response = await llmService.chat(messages, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      tools,
      maxTokens: 200,
      temperature: 0
    });

    // Check that tool was called
    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error('Expected tool call but got none');
    }

    const toolCall = response.toolCalls[0];
    if (toolCall.name !== 'get_order_status') {
      throw new Error(`Expected get_order_status but got ${toolCall.name}`);
    }

    console.log('  ✅ Tool called:', toolCall.name);
    console.log('  ✅ Arguments:', JSON.stringify(toolCall.arguments));
    testsPassed++;
    return true;
  } catch (error) {
    console.error('  ❌ Failed:', error.message);
    testsFailed++;
    return false;
  }
}

async function testGroqMultiTurn() {
  console.log('\n💬 Test 3: Groq Multi-Turn Conversation...');

  try {
    const messages = [
      { role: 'system', content: 'You are a math tutor. Be concise.' },
      { role: 'user', content: 'What is 2 + 2?' },
      { role: 'assistant', content: '2 + 2 equals 4.' },
      { role: 'user', content: 'And if you add 3 more?' }
    ];

    const response = await llmService.chat(messages, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 50,
      temperature: 0
    });

    if (!response.content) {
      throw new Error('No content in response');
    }

    // Response should mention 7
    if (!response.content.includes('7')) {
      console.log('  ⚠️  Response:', response.content);
      throw new Error('Expected answer to include "7"');
    }

    console.log('  ✅ Correct answer:', response.content.substring(0, 50));
    testsPassed++;
    return true;
  } catch (error) {
    console.error('  ❌ Failed:', error.message);
    testsFailed++;
    return false;
  }
}

async function testGroqTokenCounting() {
  console.log('\n📊 Test 4: Groq Token Counting...');

  try {
    const messages = [
      { role: 'user', content: 'Count to five.' }
    ];

    const response = await llmService.chat(messages, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 50,
      temperature: 0
    });

    if (!response.tokens) {
      throw new Error('No token info in response');
    }

    if (response.tokens.input <= 0) {
      throw new Error('Input tokens should be > 0');
    }

    if (response.tokens.output <= 0) {
      throw new Error('Output tokens should be > 0');
    }

    if (response.tokens.total !== response.tokens.input + response.tokens.output) {
      throw new Error('Total tokens should equal input + output');
    }

    console.log('  ✅ Input tokens:', response.tokens.input);
    console.log('  ✅ Output tokens:', response.tokens.output);
    console.log('  ✅ Total tokens:', response.tokens.total);
    testsPassed++;
    return true;
  } catch (error) {
    console.error('  ❌ Failed:', error.message);
    testsFailed++;
    return false;
  }
}

async function runTests() {
  // Check for API key
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY environment variable is not set');
    console.error('   This test requires a valid Groq API key.');
    process.exit(1);
  }

  console.log('🔑 GROQ_API_KEY is set\n');

  // Run tests
  await testGroqBasic();
  await testGroqWithTools();
  await testGroqMultiTurn();
  await testGroqTokenCounting();

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 Test Results:');
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  console.log('═══════════════════════════════════════════\n');

  if (testsFailed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
