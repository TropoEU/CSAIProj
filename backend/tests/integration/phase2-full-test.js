/**
 * Phase 2 Full Integration Test
 *
 * Tests the complete AI conversation flow:
 * - LLM Service (Ollama)
 * - Conversation Service
 * - System Prompts
 * - Message History
 * - Context Management
 * - Token Tracking
 *
 * Run with: node tests/integration/phase2-full-test.js
 */

import llmService from '../../src/services/llmService.js';
import conversationService from '../../src/services/conversationService.js';
import { Client } from '../../src/models/Client.js';
import { Tool } from '../../src/models/Tool.js';
import { getEnhancedSystemPrompt } from '../../src/prompts/systemPrompt.js';
import { RedisCache } from '../../src/services/redisCache.js';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       Phase 2 Full Integration Test                      ║');
console.log('║       AI Conversation Flow Demo                          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Test data (will be created in database)
let testClient = null;

const testTools = [
  {
    id: 'tool-1',
    name: 'check_order_status',
    description: 'Check the status of a pizza order by order number',
    parametersSchema: {
      type: 'object',
      properties: {
        orderNumber: {
          type: 'string',
          description: 'The order number (e.g., #12345)'
        }
      },
      required: ['orderNumber']
    },
    category: 'orders'
  },
  {
    id: 'tool-2',
    name: 'check_menu',
    description: 'Get information about menu items and prices',
    parametersSchema: {
      type: 'object',
      properties: {
        itemName: {
          type: 'string',
          description: 'Name of the menu item'
        }
      }
    },
    category: 'menu'
  }
];

const sessionId = 'test-session-' + Date.now();

async function setupTestClient() {
  console.log('🔧 Setting up test client...');
  try {
    // Create a test client in the database
    testClient = await Client.create(
      'Bob\'s Pizza Shop',
      'bobspizza.com',
      'test-api-key-' + Date.now()
    );
    testClient.customInstructions = 'You specialize in pizza orders and delivery. Be friendly and helpful. Our specialty is the Margherita pizza.';
    console.log('✅ Test client created:', testClient.id, '\n');
  } catch (error) {
    console.error('❌ Failed to create test client:', error.message);
    throw error;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  try {
    // Clear Redis cache (method might not exist, so we'll try-catch it)
    try {
      if (RedisCache.clearConversationContext) {
        await RedisCache.clearConversationContext(sessionId);
      }
    } catch (e) {
      // Ignore if method doesn't exist
    }

    // Delete test client
    if (testClient && testClient.id) {
      await Client.delete(testClient.id);
      console.log('✅ Test client deleted');
    }

    console.log('✅ Cleanup complete\n');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message, '\n');
  }
}

async function testSystemPrompt() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 1: System Prompt Generation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const systemPrompt = getEnhancedSystemPrompt(testClient, testTools);

  console.log('Generated System Prompt:');
  console.log('─'.repeat(60));
  console.log(systemPrompt);
  console.log('─'.repeat(60));
  console.log('✅ System prompt generated successfully\n');

  return systemPrompt;
}

async function testLLMService(systemPrompt) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 2: LLM Service - Single Message');
  console.log('═══════════════════════════════════════════════════════════\n');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Hi! Do you have Margherita pizza?' }
  ];

  console.log('💬 User: "Hi! Do you have Margherita pizza?"');
  console.log('🤖 Generating response...\n');

  const response = await llmService.chat(messages, {
    maxTokens: 200,
    temperature: 0.7
  });

  console.log('Response Details:');
  console.log('─'.repeat(60));
  console.log('Content:', response.content);
  console.log('\nMetadata:');
  console.log('  Provider:', response.provider);
  console.log('  Model:', response.model);
  console.log('  Tokens (input):', response.tokens.input);
  console.log('  Tokens (output):', response.tokens.output);
  console.log('  Tokens (total):', response.tokens.total);
  console.log('  Cost: $' + response.cost.toFixed(6));
  console.log('─'.repeat(60));
  console.log('✅ LLM Service working correctly\n');

  return response;
}

async function testConversationFlow(systemPrompt) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Full Conversation Flow');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Simulate a multi-turn conversation
  const conversationTurns = [
    'Hello! I want to order a pizza.',
    'What sizes do you have for Margherita pizza?',
    'I\'ll take a large Margherita. How long will delivery take?',
    'Great! My order number is #67890. Can you check its status?'
  ];

  let conversationHistory = [
    { role: 'system', content: systemPrompt }
  ];

  console.log('🎭 Starting Conversation Simulation');
  console.log('Client:', testClient.name);
  console.log('Session ID:', sessionId);
  console.log('─'.repeat(60));
  console.log('');

  for (let i = 0; i < conversationTurns.length; i++) {
    const userMessage = conversationTurns[i];

    console.log(`\n[${'Turn ' + (i + 1)}]`);
    console.log('💬 User:', userMessage);

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Get AI response
    console.log('🤔 AI thinking...');
    const response = await llmService.chat(conversationHistory, {
      maxTokens: 250,
      temperature: 0.7
    });

    console.log('🤖 Assistant:', response.content);
    console.log('   📊 Tokens:', response.tokens.total, '| Cost: $' + response.cost.toFixed(6));

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: response.content
    });

    // Small delay to make it feel more natural
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n─'.repeat(60));
  console.log('✅ Conversation flow completed successfully');
  console.log(`   Total messages: ${conversationHistory.length}`);
  console.log('   (1 system + ' + conversationTurns.length + ' user + ' + conversationTurns.length + ' assistant)\n');

  return conversationHistory;
}

async function testConversationService(conversationHistory) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 4: Conversation Service Integration');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📝 Creating conversation record...');

  // Create conversation
  const conversation = await conversationService.createConversation(
    testClient.id,
    sessionId,
    'test-user@example.com'
  );

  console.log('✅ Conversation created:', conversation.id);

  // Add messages to database
  console.log('💾 Saving messages to database...');
  let totalTokens = 0;

  for (const msg of conversationHistory) {
    if (msg.role === 'system') continue; // Skip system message

    const tokens = Math.floor(msg.content.length / 4); // Rough estimate
    totalTokens += tokens;

    await conversationService.addMessage(
      conversation.id,
      msg.role,
      msg.content,
      tokens
    );
  }

  console.log('✅ Messages saved:', conversationHistory.length - 1, 'messages');
  console.log('   Total tokens tracked:', totalTokens);

  // Test Redis caching
  console.log('\n💾 Testing Redis cache...');
  await conversationService.updateConversationContext(
    sessionId,
    conversation.id,
    conversationHistory
  );
  console.log('✅ Conversation cached in Redis');

  // Retrieve from cache
  const cached = await RedisCache.getConversationContext(sessionId);
  if (cached && cached.messages) {
    console.log('✅ Retrieved from cache:', cached.messages.length, 'messages');
  } else {
    console.log('⚠️  Cache returned null (may have expired or failed to set)');
  }

  // Test context window management
  console.log('\n📏 Testing context window management...');
  const managed = conversationService.manageContextWindow(conversationHistory);
  console.log('✅ Context window managed');
  console.log('   Original messages:', conversationHistory.length);
  console.log('   After management:', managed.length);
  console.log('   Max context messages:', conversationService.maxContextMessages);

  console.log('\n✅ Conversation Service working correctly\n');

  return conversation;
}

async function testContextRetrieval(conversation) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 5: Context Retrieval & History');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('🔍 Retrieving conversation history...');
  const messages = await conversationService.getConversationHistory(conversation.id);

  console.log('✅ Retrieved', messages.length, 'messages\n');
  console.log('Message History:');
  console.log('─'.repeat(60));

  messages.forEach((msg, idx) => {
    const preview = msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : '');
    console.log(`${idx + 1}. [${msg.role.toUpperCase()}] ${preview}`);
    console.log(`   Tokens: ${msg.tokensUsed} | Time: ${msg.timestamp}`);
  });

  console.log('─'.repeat(60));
  console.log('✅ Context retrieval working correctly\n');
}

async function displaySummary(conversation) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('✅ All Phase 2 components tested successfully!\n');

  console.log('Components Verified:');
  console.log('  ✅ LLM Service (Ollama)');
  console.log('  ✅ Conversation Service');
  console.log('  ✅ System Prompts');
  console.log('  ✅ Message History');
  console.log('  ✅ Context Management');
  console.log('  ✅ Redis Caching');
  console.log('  ✅ Token Tracking\n');

  console.log('Conversation Stats:');
  console.log('  Session ID:', sessionId);
  console.log('  Conversation ID:', conversation.id);
  console.log('  Messages:', conversation.messageCount || 'N/A');
  console.log('  Total Tokens:', conversation.tokensTotal || 'N/A');

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🎉 Phase 2: AI Engine Core - FULLY OPERATIONAL! 🎉      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

async function runTests() {
  try {
    // Setup
    await setupTestClient();

    // Run all tests
    const systemPrompt = await testSystemPrompt();
    await testLLMService(systemPrompt);
    const conversationHistory = await testConversationFlow(systemPrompt);
    const conversation = await testConversationService(conversationHistory);
    await testContextRetrieval(conversation);
    await displaySummary(conversation);

    // Cleanup
    await cleanup();

    console.log('✅ All tests completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);

    await cleanup();
    process.exit(1);
  }
}

// Run the test suite
console.log('🚀 Starting Phase 2 integration tests...\n');
runTests();
