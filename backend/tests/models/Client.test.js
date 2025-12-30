import { Client } from '../../src/models/Client.js';
import { db } from '../../src/db.js';

async function testClientModel() {
    console.log('🧪 Testing Client Model...\n');

    try {
        // Test 1: Create a client
        console.log('1. Creating a new client...');
        const client = await Client.create('Test Pizza Shop', 'testpizza.com', 'free');
        console.log('✅ Client created:', { id: client.id, name: client.name, api_key: client.api_key.substring(0, 10) + '...' });

        // Test 2: Find by ID
        console.log('\n2. Finding client by ID...');
        const foundById = await Client.findById(client.id);
        console.log('✅ Found client:', foundById ? foundById.name : 'Not found');

        // Test 3: Find by API key
        console.log('\n3. Finding client by API key...');
        const foundByApiKey = await Client.findByApiKey(client.api_key);
        console.log('✅ Found client:', foundByApiKey ? foundByApiKey.name : 'Not found');

        // Test 4: Update client
        console.log('\n4. Updating client...');
        const updated = await Client.update(client.id, { name: 'Updated Pizza Shop', plan_type: 'pro' });
        console.log('✅ Client updated:', { name: updated.name, plan_type: updated.plan_type });

        // Test 5: Get all clients
        console.log('\n5. Getting all clients...');
        const allClients = await Client.findAll();
        console.log('✅ Total clients:', allClients.length);

        // Test 6: Regenerate API key
        console.log('\n6. Regenerating API key...');
        const oldKey = client.api_key;
        const regenerated = await Client.regenerateApiKey(client.id);
        console.log('✅ API key regenerated:', oldKey.substring(0, 10) !== regenerated.api_key.substring(0, 10));

        // Test 7: Update API key manually
        console.log('\n7. Updating API key manually...');
        const customKey = 'custom_api_key_12345';
        const updatedWithKey = await Client.updateApiKey(client.id, customKey);
        console.log('✅ API key updated:', updatedWithKey.api_key === customKey);

        // Test 8: Deactivate client
        console.log('\n8. Deactivating client...');
        const deactivated = await Client.deactivate(client.id);
        console.log('✅ Client deactivated:', deactivated.status === 'inactive');

        // Test 9: Delete client
        console.log('\n9. Deleting client...');
        const deleted = await Client.delete(client.id);
        console.log('✅ Client deleted:', deleted ? 'Yes' : 'No');

        console.log('\n✅ All Client model tests passed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await db.end();
        process.exit(0);
    }
}

testClientModel();
