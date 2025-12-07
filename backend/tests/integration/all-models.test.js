import { Client } from '../../src/models/Client.js';
import { Conversation } from '../../src/models/Conversation.js';
import { Message } from '../../src/models/Message.js';
import { Tool } from '../../src/models/Tool.js';
import { ClientTool } from '../../src/models/ClientTool.js';
import { ClientIntegration } from '../../src/models/ClientIntegration.js';
import { IntegrationEndpoint } from '../../src/models/IntegrationEndpoint.js';
import { ApiUsage } from '../../src/models/ApiUsage.js';
import { ToolExecution } from '../../src/models/ToolExecution.js';
import { db } from '../../src/db.js';

async function testAllModels() {
    console.log('🧪 Testing All Models - Integration Test\n');
    console.log('='.repeat(60));

    try {
        // 1. Test Client Model
        console.log('\n1️⃣  Testing Client Model...');
        const client = await Client.create('Test Shop', 'testshop.com', 'pro');
        console.log(`✅ Created client: ${client.name} (ID: ${client.id})`);

        // 2. Test Tool Model (Master Catalog)
        console.log('\n2️⃣  Testing Tool Model...');
        // Check if tools exist, if not create them
        let tool1 = await Tool.findByName('get_order_status');
        if (!tool1) {
            tool1 = await Tool.create('get_order_status', 'Check order status', { order_id: 'string' }, 'ecommerce');
            console.log(`✅ Created tool: ${tool1.tool_name}`);
        } else {
            console.log(`✅ Found existing tool: ${tool1.tool_name}`);
        }

        let tool2 = await Tool.findByName('book_appointment');
        if (!tool2) {
            tool2 = await Tool.create('book_appointment', 'Book an appointment', { date: 'string', service: 'string' }, 'scheduling');
            console.log(`✅ Created tool: ${tool2.tool_name}`);
        } else {
            console.log(`✅ Found existing tool: ${tool2.tool_name}`);
        }

        // 3. Test ClientTool Model (Enable tools for client)
        console.log('\n3️⃣  Testing ClientTool Model...');
        const clientTool = await ClientTool.enable(client.id, tool1.id, 'https://n8n.example.com/webhook/orders', { timeout: 30 });
        console.log(`✅ Enabled tool "${tool1.tool_name}" for client`);

        const enabledTools = await ClientTool.getEnabledTools(client.id);
        console.log(`✅ Client has ${enabledTools.length} enabled tool(s)`);

        // 4. Test ClientIntegration Model
        console.log('\n4️⃣  Testing ClientIntegration Model...');
        const integration = await ClientIntegration.create(
            client.id,
            'shopify',
            { api_url: 'https://shop.myshopify.com', api_key: 'test_key' }
        );
        console.log(`✅ Created integration: ${integration.integration_type} (ID: ${integration.id})`);

        // 5. Test IntegrationEndpoint Model
        console.log('\n5️⃣  Testing IntegrationEndpoint Model...');
        const endpoint = await IntegrationEndpoint.create(
            integration.id,
            'get_product',
            '/products/{id}.json',
            'GET',
            'Fetch product by ID'
        );
        console.log(`✅ Created endpoint: ${endpoint.endpoint_name}`);

        // 6. Test Conversation Model
        console.log('\n6️⃣  Testing Conversation Model...');
        const conversation = await Conversation.create(client.id, 'session_abc123', 'user@example.com');
        console.log(`✅ Created conversation (ID: ${conversation.id})`);

        // 7. Test Message Model
        console.log('\n7️⃣  Testing Message Model...');
        const msg1 = await Message.create(conversation.id, 'user', 'Hello, I need help!', 10);
        const msg2 = await Message.create(conversation.id, 'assistant', 'Hi! How can I help you?', 15);
        console.log(`✅ Created ${await Message.count(conversation.id)} messages`);

        // Update conversation stats
        const totalTokens = await Message.getTotalTokens(conversation.id);
        await Conversation.incrementStats(conversation.id, totalTokens);
        console.log(`✅ Conversation total tokens: ${totalTokens}`);

        // 8. Test ToolExecution Model
        console.log('\n8️⃣  Testing ToolExecution Model...');
        const execution = await ToolExecution.create(
            conversation.id,
            'get_order_status',
            { order_id: '12345' },
            { status: 'shipped', tracking: 'ABC123' },
            true,
            350
        );
        console.log(`✅ Logged tool execution (${execution.execution_time_ms}ms)`);

        // 9. Test ApiUsage Model (Billing)
        console.log('\n9️⃣  Testing ApiUsage Model...');
        await ApiUsage.recordUsage(client.id, 100, 200, 1);
        const usage = await ApiUsage.getCurrentPeriodUsage(client.id);
        console.log(`✅ Recorded API usage - Total cost: $${parseFloat(usage.total_cost).toFixed(4)}`);

        // Test queries across models
        console.log('\n🔍 Testing Cross-Model Queries...');
        const recentMessages = await Message.getRecent(conversation.id, 10);
        console.log(`✅ Retrieved ${recentMessages.length} recent messages`);

        const executions = await ToolExecution.getByConversation(conversation.id);
        console.log(`✅ Retrieved ${executions.length} tool execution(s)`);

        const endpoints = await IntegrationEndpoint.getByIntegration(integration.id);
        console.log(`✅ Retrieved ${endpoints.length} endpoint(s) for integration`);

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await Client.delete(client.id); // Cascades to everything
        console.log('✅ Test data cleaned up');

        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL MODEL TESTS PASSED! 🎉');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await db.end();
        process.exit(0);
    }
}

testAllModels();
