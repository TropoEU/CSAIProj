/**
 * Quick Ollama connectivity test
 * Run with: npm run check:ollama
 */

import { OLLAMA_CONFIG } from '../config.js';

console.log('🔍 Checking Ollama connectivity...\n');
console.log(`Ollama URL: ${OLLAMA_CONFIG.url}`);
console.log(`Ollama Model: ${OLLAMA_CONFIG.model}\n`);

async function checkOllama() {
  try {
    console.log('📡 Attempting to connect...');
    const response = await fetch(`${OLLAMA_CONFIG.url}/api/tags`);

    if (!response.ok) {
      console.error(`❌ Ollama returned error: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Ollama is running!\n');
    console.log('Available models:');
    data.models.forEach((model) => {
      console.log(`  - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
    });

    // Check if configured model exists
    const hasModel = data.models.some((m) => m.name.includes(OLLAMA_CONFIG.model));
    if (hasModel) {
      console.log(`\n✅ Configured model "${OLLAMA_CONFIG.model}" is available`);
    } else {
      console.log(`\n⚠️  Warning: Configured model "${OLLAMA_CONFIG.model}" not found`);
      console.log(`   Run: ollama pull ${OLLAMA_CONFIG.model}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to Ollama:', error.message);
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure Ollama is running');
    console.log('  2. Check that Ollama is accessible at:', OLLAMA_CONFIG.url);
    console.log('  3. If running from WSL, ensure Windows firewall allows the connection');
    process.exit(1);
  }
}

checkOllama();
