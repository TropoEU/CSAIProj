/**
 * Test script for Groq integration
 *
 * Run with: node backend/test-groq.js
 */

import 'dotenv/config';
import llmService from './src/services/llmService.js';

async function testGroq() {
  console.log('\n🧪 Testing Groq Integration\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Simple message
    console.log('\n📝 Test 1: Simple conversation');
    console.log('-'.repeat(50));

    const messages1 = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Keep responses concise.'
      },
      {
        role: 'user',
        content: 'What is 2+2? Answer in one sentence.'
      }
    ];

    const response1 = await llmService.chat(messages1, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 100
    });

    console.log('✅ Response:', response1.content);
    console.log('📊 Tokens:', response1.tokens);
    console.log('💰 Cost:', response1.cost);
    console.log('🚀 Provider:', response1.provider);
    console.log('🤖 Model:', response1.model);

    // Test 2: Tool calling
    console.log('\n\n📝 Test 2: Tool calling');
    console.log('-'.repeat(50));

    const messages2 = [
      {
        role: 'system',
        content: 'You are a helpful assistant that can check order status.'
      },
      {
        role: 'user',
        content: 'What is the status of order #12345?'
      }
    ];

    const tools = [
      {
        name: 'get_order_status',
        description: 'Get the status of an order by order number',
        parameters: {
          type: 'object',
          properties: {
            order_number: {
              type: 'string',
              description: 'The order number to look up'
            }
          },
          required: ['order_number']
        }
      }
    ];

    const response2 = await llmService.chat(messages2, {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      tools,
      temperature: 0.3,
      maxTokens: 200
    });

    console.log('✅ Response:', response2.content);
    console.log('🔧 Tool Calls:', response2.toolCalls);
    console.log('📊 Tokens:', response2.tokens);
    console.log('💰 Cost:', response2.cost);

    // Test 3: Different model (faster one)
    console.log('\n\n📝 Test 3: Fast model (llama-3.1-8b-instant)');
    console.log('-'.repeat(50));

    const messages3 = [
      {
        role: 'user',
        content: 'Tell me a short joke.'
      }
    ];

    const response3 = await llmService.chat(messages3, {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      maxTokens: 100
    });

    console.log('✅ Response:', response3.content);
    console.log('📊 Tokens:', response3.tokens);
    console.log('🚀 Model:', response3.model);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testGroq();
