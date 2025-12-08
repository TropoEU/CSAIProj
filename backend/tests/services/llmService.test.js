/**
 * LLM Service Integration Test
 *
 * Tests the LLM service with different providers
 *
 * Run with: node tests/services/llmService.test.js
 */

import llmService from '../../src/services/llmService.js';

console.log('🧪 Testing LLM Service...\n');

async function testOllama() {
  console.log('📡 Testing Ollama Provider...');

  try {
    // Simple chat test
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in one sentence.' }
    ];

    console.log('Sending test message to Ollama...');
    const response = await llmService.chat(messages, {
      maxTokens: 100,
      temperature: 0.7
    });

    console.log('✅ Ollama Response:');
    console.log('  Content:', response.content);
    console.log('  Tokens:', response.tokens);
    console.log('  Cost:', response.cost);
    console.log('  Model:', response.model);
    console.log('  Provider:', response.provider);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Ollama Test Failed:', error.message);
    console.log('');
    return false;
  }
}

async function testOllamaWithTools() {
  console.log('🔧 Testing Ollama with Function Calling...');

  // Check if Ollama supports native function calling
  if (!llmService.supportsNativeFunctionCalling()) {
    console.log('⚠️  Skipping tool test (Ollama function calling is experimental)');
    console.log('   Note: Tools will be handled via prompt engineering instead');
    console.log('');
    return null;
  }

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant with access to tools.' },
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
              description: 'The order ID (e.g., #12345)'
            }
          },
          required: ['order_id']
        }
      }
    ];

    console.log('Sending message with tool definitions...');
    const response = await llmService.chat(messages, {
      tools,
      maxTokens: 200,
      temperature: 0.7
    });

    console.log('✅ Ollama Tool Response:');
    console.log('  Content:', response.content);
    console.log('  Tool Calls:', response.toolCalls);
    console.log('  Tokens:', response.tokens);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Ollama Tool Test Failed:', error.message);
    console.log('');
    return false;
  }
}

async function testClaude() {
  console.log('🤖 Testing Claude Provider...');

  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  Skipping Claude test (ANTHROPIC_API_KEY not configured)');
    console.log('');
    return null;
  }

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in one sentence.' }
    ];

    console.log('Sending test message to Claude...');

    // Temporarily switch to Claude provider
    const originalProvider = llmService.provider;
    llmService.provider = 'claude';
    llmService.model = llmService.getModelForProvider();
    llmService.client = llmService.initializeClient();

    const response = await llmService.chat(messages, {
      maxTokens: 100,
      temperature: 0.7
    });

    // Restore original provider
    llmService.provider = originalProvider;
    llmService.model = llmService.getModelForProvider();
    llmService.client = llmService.initializeClient();

    console.log('✅ Claude Response:');
    console.log('  Content:', response.content);
    console.log('  Tokens:', response.tokens);
    console.log('  Cost: $' + response.cost.toFixed(4));
    console.log('  Model:', response.model);
    console.log('  Provider:', response.provider);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Claude Test Failed:', error.message);
    console.log('');
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════\n');
  console.log(`Current Provider: ${llmService.provider}`);
  console.log(`Current Model: ${llmService.model}`);
  console.log('');

  const results = {
    ollama: false,
    ollamaTools: false,
    claude: null
  };

  // Test based on current provider
  if (llmService.provider === 'ollama') {
    results.ollama = await testOllama();
    results.ollamaTools = await testOllamaWithTools();
  } else if (llmService.provider === 'claude') {
    results.claude = await testClaude();
  }

  // Optionally test other providers
  if (llmService.provider !== 'claude') {
    results.claude = await testClaude();
  }

  console.log('═══════════════════════════════════════════');
  console.log('📊 Test Results:');
  console.log(`  Ollama Basic: ${results.ollama ? '✅ PASS' : results.ollama === null ? '⚠️  SKIPPED' : '❌ FAIL'}`);
  console.log(`  Ollama Tools: ${results.ollamaTools ? '✅ PASS' : results.ollamaTools === null ? '⚠️  SKIPPED' : '❌ FAIL'}`);
  console.log(`  Claude: ${results.claude === null ? '⚠️  SKIPPED' : results.claude ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════\n');

  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.values(results).filter(r => r !== null).length;

  if (passed === total && total > 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else if (total === 0) {
    console.log('⚠️  No tests were run');
    process.exit(1);
  } else {
    console.log(`⚠️  ${passed}/${total} tests passed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
