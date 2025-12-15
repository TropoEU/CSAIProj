/**
 * Script to restart server and test all customer dashboard endpoints
 */

import { spawn } from 'child_process';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const ACCESS_CODE = 'GAV091';
const SERVER_STARTUP_WAIT = 5000; // 5 seconds

let authToken = null;
let serverProcess = null;

// Helper to make API requests
async function apiRequest(method, endpoint, body = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      config.data = body;
    }

    const response = await axios(config);
    return { status: response.status, ok: true, data: response.data };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        ok: false,
        data: error.response.data,
        error: error.message,
      };
    }
    return { status: 0, ok: false, error: error.message };
  }
}

// Wait for server to be ready
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 1000 });
      if (response.status === 200) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  console.log('\n❌ Server did not start in time');
  return false;
}

// Start the server
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting server...');
    serverProcess = spawn('npm', ['start'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'pipe',
    });

    let serverReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Backend running on port')) {
        if (!serverReady) {
          serverReady = true;
          console.log('   Server process started');
          resolve(serverProcess);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (!output.includes('Warning')) {
        console.error('   Server error:', output.trim());
      }
    });

    serverProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

// Stop the server
function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      console.log('🛑 Stopping server...');
      serverProcess.kill('SIGTERM');
      serverProcess.on('exit', () => {
        console.log('   Server stopped');
        resolve();
      });
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
        resolve();
      }, 3000);
    } else {
      resolve();
    }
  });
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing: POST /api/customer/auth/login');
  const result = await apiRequest('POST', '/api/customer/auth/login', {
    accessCode: ACCESS_CODE,
    rememberMe: false,
  });

  if (result.ok && result.data.token) {
    authToken = result.data.token;
    console.log('✅ Login successful!');
    return true;
  } else {
    console.log('❌ Login failed!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

async function testEndpoint(name, method, endpoint, body = null) {
  console.log(`\n${name}`);
  const result = await apiRequest(method, endpoint, body, authToken);
  
  if (result.ok) {
    console.log('✅ Success!');
    return true;
  } else {
    console.log('❌ Failed!');
    console.log(`   Status: ${result.status}`);
    if (result.data) {
      console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    }
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Customer Dashboard API Test Suite');
  console.log('='.repeat(60));

  try {
    // Start server
    await startServer();
    await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_WAIT));
    
    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready');
    const serverReady = await waitForServer();
    if (!serverReady) {
      throw new Error('Server did not start');
    }

    // Run tests
    const results = {
      login: await testLogin(),
      dashboard: await testEndpoint('📊 Testing: GET /api/customer/dashboard/overview', 'GET', '/api/customer/dashboard/overview'),
      actions: await testEndpoint('🛠️  Testing: GET /api/customer/actions', 'GET', '/api/customer/actions'),
      conversations: await testEndpoint('💬 Testing: GET /api/customer/conversations', 'GET', '/api/customer/conversations?page=1&limit=10'),
      conversationDetail: await testEndpoint('💬 Testing: GET /api/customer/conversations/:id', 'GET', '/api/customer/conversations/108'),
      invoices: await testEndpoint('💰 Testing: GET /api/customer/billing/invoices', 'GET', '/api/customer/billing/invoices'),
      usageCurrent: await testEndpoint('📈 Testing: GET /api/customer/usage/current', 'GET', '/api/customer/usage/current'),
      usageTrends: await testEndpoint('📊 Testing: GET /api/customer/usage/trends', 'GET', '/api/customer/usage/trends?period=30d'),
      usageTools: await testEndpoint('🔧 Testing: GET /api/customer/usage/tools', 'GET', '/api/customer/usage/tools'),
    };

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Summary');
    console.log('='.repeat(60));
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([name, result]) => {
      console.log(`${result ? '✅' : '❌'} ${name}: ${result ? 'PASS' : 'FAIL'}`);
    });
    
    console.log('='.repeat(60));
    console.log(`Total: ${passed}/${total} passed`);
    console.log('='.repeat(60));

    // Cleanup
    await stopServer();
    
    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    await stopServer();
    process.exit(1);
  }
}

// Run tests
runTests();

