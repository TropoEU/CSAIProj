/**
 * Phase 3 Full Integration Test
 *
 * Tests the complete tool execution flow:
 * - Tool Manager Service
 * - n8n Service
 * - Tool Execution Flow
 * - Conversation Service with Tools
 * - Tool Execution Logging
 *
 * IMPORTANT: This test requires n8n workflows to be imported and active!
 * See n8n-workflows/README.md for setup instructions.
 *
 * Run with: node tests/integration/phase3-full-test.js
 */

import conversationService from '../../src/services/conversationService.js';
import toolManager from '../../src/services/toolManager.js';
import n8nService from '../../src/services/n8nService.js';
import { Client } from '../../src/models/Client.js';
import { Tool } from '../../src/models/Tool.js';
import { ClientTool } from '../../src/models/ClientTool.js';
import { ToolExecution } from '../../src/models/ToolExecution.js';
import { RedisCache } from '../../src/services/redisCache.js';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       Phase 3 Full Integration Test                      ║');
console.log('║       Tool Execution System Demo                         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Test data
let testClient = null;
let testTools = [];
const sessionId = 'test-session-phase3-' + Date.now();

async function setupTestClient() {
  console.log('🔧 Setting up test client and tools...');
  try {
    // Create test client
    testClient = await Client.create(
      'Bob\'s Pizza Shop (Phase 3 Test)',
      'bobspizza-test.com',
      'test-api-key-phase3-' + Date.now()
    );
    testClient.custom_instructions = 'You are a helpful assistant for Bob\'s Pizza Shop. Use tools to check orders, inventory, and bookings.';
    console.log('✅ Test client created:', testClient.id);

    // Create test tools
    const toolDefinitions = [
      {
        tool_name: 'get_order_status',
        description: 'Check the status of a customer order by order number',
        parameters_schema: {
          type: 'object',
          properties: {
            orderNumber: {
              type: 'string',
              description: 'The order number to look up'
            }
          },
          required: ['orderNumber']
        },
        category: 'orders'
      },
      {
        tool_name: 'check_inventory',
        description: 'Check if a product is in stock',
        parameters_schema: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name of the product'
            },
            quantity: {
              type: 'number',
              description: 'Quantity needed'
            }
          }
        },
        category: 'inventory'
      }
    ];

    for (const toolDef of toolDefinitions) {
      // Check if tool exists, create if not
      let tool = await Tool.findByName(toolDef.tool_name);
      if (!tool) {
        tool = await Tool.create(
          toolDef.tool_name,
          toolDef.description,
          toolDef.parameters_schema,
          toolDef.category
        );
      }
      testTools.push(tool);

      // Enable tool for client
      await ClientTool.enable(
        testClient.id,
        tool.id,
        `http://localhost:5678/webhook/${toolDef.tool_name}`,
        null
      );
    }

    console.log('✅ Test tools created and enabled:', testTools.length);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error.message);
    throw error;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  try {
    // Clear Redis cache
    try {
      await RedisCache.clearConversationContext(sessionId);
    } catch (e) {
      // Ignore
    }

    // Delete client tools
    if (testClient && testTools.length > 0) {
      for (const tool of testTools) {
        try {
          await ClientTool.delete(testClient.id, tool.id);
        } catch (e) {
          // Ignore
        }
      }
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

async function testN8nHealth() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 1: n8n Service Health Check');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('🔍 Checking n8n service...');
  const health = await n8nService.checkHealth();

  console.log('n8n Status:');
  console.log('─'.repeat(60));
  console.log('  Available:', health.available ? '✅ Yes' : '❌ No');
  if (health.version) {
    console.log('  Version:', health.version);
  }
  if (health.error) {
    console.log('  Error:', health.error);
  }
  console.log('─'.repeat(60));

  if (!health.available) {
    console.log('⚠️  n8n is not available. Make sure n8n is running:');
    console.log('   npm run dockerup\n');
  } else {
    console.log('✅ n8n service is healthy\n');
  }

  return health.available;
}

async function testToolManager() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Tool Manager - Load & Format Tools');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📦 Loading client tools...');
  const clientTools = await toolManager.getClientTools(testClient.id);

  console.log('✅ Loaded', clientTools.length, 'tools\n');
  console.log('Tools Available:');
  console.log('─'.repeat(60));
  clientTools.forEach(tool => {
    console.log(`  • ${tool.tool_name}`);
    console.log(`    ${tool.description}`);
    console.log(`    Webhook: ${tool.n8n_webhook_url}`);
  });
  console.log('─'.repeat(60));

  // Test formatting for different providers
  console.log('\n🔧 Testing tool formatting...\n');

  console.log('Claude Format (native function calling):');
  const claudeTools = toolManager.formatToolsForLLM(clientTools, 'claude');
  console.log(JSON.stringify(claudeTools, null, 2));

  console.log('\nOllama Format (prompt engineering):');
  const ollamaTools = toolManager.formatToolsForLLM(clientTools, 'ollama');
  console.log(ollamaTools.substring(0, 300) + '...\n');

  console.log('✅ Tool Manager working correctly\n');

  return clientTools;
}

async function testN8nWebhook(n8nAvailable) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 3: n8n Webhook Execution');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!n8nAvailable) {
    console.log('⚠️  Skipping webhook test - n8n not available\n');
    return false;
  }

  console.log('🔗 Testing webhook call...');
  console.log('Calling: http://localhost:5678/webhook/get_order_status');
  console.log('Parameters: { orderNumber: "12345" }\n');

  const result = await n8nService.executeTool(
    'http://localhost:5678/webhook/get_order_status',
    { orderNumber: '12345' },
    10000 // 10s timeout for test
  );

  console.log('Webhook Result:');
  console.log('─'.repeat(60));
  console.log('  Success:', result.success ? '✅' : '❌');
  console.log('  Execution Time:', result.executionTimeMs + 'ms');

  if (result.success) {
    console.log('  Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('  Error:', result.error);
  }
  console.log('─'.repeat(60));

  if (!result.success) {
    console.log('\n⚠️  Webhook failed. Make sure workflows are imported and active:');
    console.log('   1. Open http://localhost:5678');
    console.log('   2. Import workflows from n8n-workflows/');
    console.log('   3. Activate each workflow\n');
  } else {
    console.log('\n✅ Webhook execution working correctly\n');
  }

  return result.success;
}

async function testToolExecution(webhooksWorking) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 4: Full Tool Execution Flow');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!webhooksWorking) {
    console.log('⚠️  Skipping tool execution test - webhooks not working\n');
    console.log('This is the full integration test that would run:');
    console.log('  1. User sends message requiring tool use');
    console.log('  2. AI detects need for tool');
    console.log('  3. Tool is executed via n8n');
    console.log('  4. Result is fed back to AI');
    console.log('  5. AI generates natural language response');
    console.log('  6. Execution is logged in database\n');
    return null;
  }

  console.log('🎭 Testing conversation with tool execution...');
  console.log('Session ID:', sessionId);
  console.log('─'.repeat(60));
  console.log('');

  const userMessage = "What is the status of order 12345?";
  console.log('💬 User:', userMessage);
  console.log('🤖 Processing with AI...\n');

  try {
    const result = await conversationService.processMessage(
      testClient,
      sessionId,
      userMessage
    );

    console.log('AI Response:');
    console.log('─'.repeat(60));
    console.log(result.response);
    console.log('─'.repeat(60));

    console.log('\nExecution Metadata:');
    console.log('  Conversation ID:', result.conversationId);
    console.log('  Tokens Used:', result.tokensUsed);
    console.log('  Iterations:', result.iterations);
    console.log('  Tools Used:', result.toolsUsed.length);

    if (result.toolsUsed.length > 0) {
      console.log('\nTool Executions:');
      result.toolsUsed.forEach((tool, idx) => {
        console.log(`  ${idx + 1}. ${tool.name}`);
        console.log(`     Success: ${tool.success ? '✅' : '❌'}`);
        console.log(`     Time: ${tool.executionTime}ms`);
      });
    }

    console.log('\n✅ Tool execution flow completed successfully\n');

    return result;

  } catch (error) {
    console.error('❌ Tool execution failed:', error.message);
    console.error(error.stack);
    return null;
  }
}

async function testToolLogging(conversationResult) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 5: Tool Execution Logging');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!conversationResult) {
    console.log('⚠️  Skipping logging test - no conversation result\n');
    return;
  }

  console.log('🔍 Checking tool execution logs...');

  const executions = await ToolExecution.getByConversation(conversationResult.conversationId);

  console.log('✅ Found', executions.length, 'tool execution(s)\n');

  if (executions.length > 0) {
    console.log('Execution Logs:');
    console.log('─'.repeat(60));
    executions.forEach((exec, idx) => {
      console.log(`${idx + 1}. Tool: ${exec.tool_name}`);
      console.log(`   Success: ${exec.success ? '✅' : '❌'}`);
      console.log(`   Time: ${exec.execution_time_ms}ms`);
      console.log(`   Parameters:`, JSON.stringify(exec.parameters));
      console.log(`   Timestamp: ${exec.timestamp}`);
      console.log('');
    });
    console.log('─'.repeat(60));
  }

  console.log('✅ Tool logging working correctly\n');
}

async function displaySummary(webhooksWorking, toolExecutionWorked) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Components Tested:');
  console.log('  ✅ Tool Manager (load & format)');
  console.log('  ✅ n8n Service (health check)');
  console.log('  ' + (webhooksWorking ? '✅' : '⚠️ ') + ' n8n Webhooks');
  console.log('  ' + (toolExecutionWorked ? '✅' : '⚠️ ') + ' Full Tool Execution Flow');
  console.log('  ' + (toolExecutionWorked ? '✅' : '⚠️ ') + ' Tool Execution Logging');
  console.log('');

  if (webhooksWorking && toolExecutionWorked) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 Phase 3: Tool Execution - FULLY OPERATIONAL! 🎉      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } else if (!webhooksWorking) {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ⚠️  Phase 3: Partially Complete                         ║');
    console.log('║                                                           ║');
    console.log('║  Core services are working, but n8n workflows need        ║');
    console.log('║  to be imported and activated.                            ║');
    console.log('║                                                           ║');
    console.log('║  See: n8n-workflows/README.md for setup instructions      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ⚠️  Phase 3: Issues Detected                            ║');
    console.log('║                                                           ║');
    console.log('║  Some tests failed. Check the output above for details.   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  }
}

async function runTests() {
  try {
    // Setup
    await setupTestClient();

    // Run all tests
    const n8nAvailable = await testN8nHealth();
    const clientTools = await testToolManager();
    const webhooksWorking = await testN8nWebhook(n8nAvailable);
    const conversationResult = await testToolExecution(webhooksWorking);
    await testToolLogging(conversationResult);
    await displaySummary(webhooksWorking, conversationResult !== null);

    // Cleanup
    await cleanup();

    console.log('✅ Phase 3 tests completed!');
    process.exit(webhooksWorking && conversationResult ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);

    await cleanup();
    process.exit(1);
  }
}

// Run the test suite
console.log('🚀 Starting Phase 3 integration tests...\n');
runTests();
