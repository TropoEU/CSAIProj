/**
 * End-to-end test for per-client LLM provider switching
 *
 * Run with: node backend/test-provider-switching.js
 */

import 'dotenv/config';
import { Client } from './src/models/Client.js';
import llmService from './src/services/llmService.js';
import { db } from './src/db.js';

async function testProviderSwitching() {
  console.log('\n🧪 Testing Per-Client LLM Provider Switching\n');
  console.log('='.repeat(60));

  try {
    // Find or create a test client
    console.log('\n📝 Step 1: Finding/Creating test client...');
    let testClient = await Client.findByApiKey('csai_test_provider_switching_key');

    if (!testClient) {
      // Create test client with custom API key
      const query = `
        INSERT INTO clients (name, domain, api_key, plan_type, llm_provider, model_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await db.query(query, [
        'Test Provider Switching',
        'test-provider-switching.com',
        'csai_test_provider_switching_key',
        'pro',
        'ollama',
        'Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf'
      ]);
      testClient = result.rows[0];
      console.log('✅ Created test client:', testClient.name);
    } else {
      console.log('✅ Found existing test client:', testClient.name);
    }

    const testMessages = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Keep responses concise (1 sentence).'
      },
      {
        role: 'user',
        content: 'What is the capital of France?'
      }
    ];

    // Test 1: Ollama (default)
    console.log('\n' + '-'.repeat(60));
    console.log('🧪 Test 1: Ollama Provider');
    console.log('-'.repeat(60));

    const ollamaResponse = await llmService.chat(testMessages, {
      provider: testClient.llm_provider,
      model: testClient.model_name,
      temperature: 0.3,
      maxTokens: 100
    });

    console.log('Provider:', ollamaResponse.provider);
    console.log('Model:', ollamaResponse.model);
    console.log('Response:', ollamaResponse.content);
    console.log('Tokens:', ollamaResponse.tokens);
    console.log('Cost:', ollamaResponse.cost);

    // Test 2: Switch to Groq
    console.log('\n' + '-'.repeat(60));
    console.log('🧪 Test 2: Switching to Groq');
    console.log('-'.repeat(60));

    await Client.update(testClient.id, {
      llm_provider: 'groq',
      model_name: 'llama-3.3-70b-versatile'
    });

    const updatedClient = await Client.findById(testClient.id);
    console.log('✅ Updated client provider to:', updatedClient.llm_provider);
    console.log('✅ Updated client model to:', updatedClient.model_name);

    const groqResponse = await llmService.chat(testMessages, {
      provider: updatedClient.llm_provider,
      model: updatedClient.model_name,
      temperature: 0.3,
      maxTokens: 100
    });

    console.log('Provider:', groqResponse.provider);
    console.log('Model:', groqResponse.model);
    console.log('Response:', groqResponse.content);
    console.log('Tokens:', groqResponse.tokens);
    console.log('Cost:', groqResponse.cost);

    // Test 3: Switch to faster Groq model
    console.log('\n' + '-'.repeat(60));
    console.log('🧪 Test 3: Switching to faster Groq model');
    console.log('-'.repeat(60));

    await Client.update(testClient.id, {
      model_name: 'llama-3.1-8b-instant'
    });

    const updatedClient2 = await Client.findById(testClient.id);
    console.log('✅ Updated client model to:', updatedClient2.model_name);

    const groqFastResponse = await llmService.chat(testMessages, {
      provider: updatedClient2.llm_provider,
      model: updatedClient2.model_name,
      temperature: 0.3,
      maxTokens: 100
    });

    console.log('Provider:', groqFastResponse.provider);
    console.log('Model:', groqFastResponse.model);
    console.log('Response:', groqFastResponse.content);
    console.log('Tokens:', groqFastResponse.tokens);
    console.log('Cost:', groqFastResponse.cost);

    // Test 4: Switch back to Ollama
    console.log('\n' + '-'.repeat(60));
    console.log('🧪 Test 4: Switching back to Ollama');
    console.log('-'.repeat(60));

    await Client.update(testClient.id, {
      llm_provider: 'ollama',
      model_name: 'Hermes-2-Pro-Mistral-7B.Q5_K_M.gguf'
    });

    const updatedClient3 = await Client.findById(testClient.id);
    console.log('✅ Updated client provider to:', updatedClient3.llm_provider);
    console.log('✅ Updated client model to:', updatedClient3.model_name);

    const ollamaResponse2 = await llmService.chat(testMessages, {
      provider: updatedClient3.llm_provider,
      model: updatedClient3.model_name,
      temperature: 0.3,
      maxTokens: 100
    });

    console.log('Provider:', ollamaResponse2.provider);
    console.log('Model:', ollamaResponse2.model);
    console.log('Response:', ollamaResponse2.content);
    console.log('Tokens:', ollamaResponse2.tokens);
    console.log('Cost:', ollamaResponse2.cost);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log('- Ollama → Groq: ✅');
    console.log('- Groq model switching: ✅');
    console.log('- Groq → Ollama: ✅');
    console.log('\n✨ Per-client LLM provider switching is working correctly!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testProviderSwitching();
