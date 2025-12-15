/**
 * Test script for Customer Dashboard API endpoints
 * Tests all /api/customer/* endpoints
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const ACCESS_CODE = 'GAV091';

let authToken = null;

// Helper function to make API requests
async function apiRequest(method, endpoint, body = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      config.data = body;
    }

    const response = await axios(config);
    
    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      data: response.data,
    };
  } catch (error) {
    if (error.response) {
      return {
        status: error.response.status,
        ok: false,
        data: error.response.data,
        error: error.message,
      };
    } else if (error.code === 'ECONNREFUSED') {
      return {
        status: 0,
        ok: false,
        error: `Connection refused - is the server running on ${BASE_URL}?`,
        code: error.code,
      };
    } else {
      return {
        status: 0,
        ok: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing: POST /api/customer/auth/login');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('POST', '/api/customer/auth/login', {
    accessCode: ACCESS_CODE,
    rememberMe: false,
  });

  if (result.ok && result.data.token) {
    authToken = result.data.token;
    console.log('✅ Login successful!');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   Client: ${result.data.client.name}`);
    console.log(`   Plan: ${result.data.client.plan}`);
    console.log(`   Status: ${result.data.client.status}`);
    return true;
  } else {
    console.log('❌ Login failed!');
    console.log(`   Status: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.data) {
      console.log(`   Response: ${JSON.stringify(result.data, null, 2)}`);
    }
    return false;
  }
}

async function testDashboardOverview() {
  console.log('\n📊 Testing: GET /api/customer/dashboard/overview');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/dashboard/overview', null, authToken);
  
  if (result.ok) {
    console.log('✅ Dashboard overview retrieved!');
    console.log(`   Account: ${result.data.account.name} (${result.data.account.plan})`);
    console.log(`   Usage - Conversations: ${result.data.usage.conversations}`);
    console.log(`   Usage - Tokens: ${result.data.usage.tokens.toLocaleString()}`);
    console.log(`   Usage - Tool Calls: ${result.data.usage.toolCalls}`);
    console.log(`   Today - Conversations: ${result.data.stats.conversationsToday}`);
    console.log(`   Today - Tokens: ${result.data.stats.tokensToday}`);
    console.log(`   Recent Conversations: ${result.data.recentConversations.length}`);
    return result.data;
  } else {
    console.log('❌ Failed to get dashboard overview!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testActions() {
  console.log('\n🛠️  Testing: GET /api/customer/actions');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/actions', null, authToken);
  
  if (result.ok) {
    console.log('✅ Actions retrieved!');
    console.log(`   Total Tools: ${result.data.tools.length}`);
    result.data.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} (${tool.category})`);
      console.log(`      ${tool.description}`);
    });
    return result.data;
  } else {
    console.log('❌ Failed to get actions!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testConversations() {
  console.log('\n💬 Testing: GET /api/customer/conversations');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/conversations?page=1&limit=10', null, authToken);
  
  if (result.ok) {
    console.log('✅ Conversations retrieved!');
    console.log(`   Total: ${result.data.pagination.totalConversations}`);
    console.log(`   Page: ${result.data.pagination.page} of ${result.data.pagination.totalPages}`);
    console.log(`   Conversations in this page: ${result.data.conversations.length}`);
    
    if (result.data.conversations.length > 0) {
      const firstConv = result.data.conversations[0];
      console.log(`   First conversation ID: ${firstConv.id}`);
      console.log(`   First conversation status: ${firstConv.status}`);
      return firstConv.id; // Return first conversation ID for detail test
    }
    return null;
  } else {
    console.log('❌ Failed to get conversations!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testConversationDetail(conversationId) {
  if (!conversationId) {
    console.log('\n💬 Testing: GET /api/customer/conversations/:id');
    console.log('─'.repeat(60));
    console.log('⏭️  Skipped (no conversation ID available)');
    return;
  }

  console.log(`\n💬 Testing: GET /api/customer/conversations/${conversationId}`);
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', `/api/customer/conversations/${conversationId}`, null, authToken);
  
  if (result.ok) {
    console.log('✅ Conversation detail retrieved!');
    console.log(`   Session ID: ${result.data.conversation.sessionId}`);
    console.log(`   Status: ${result.data.conversation.status}`);
    console.log(`   Messages: ${result.data.messages.length}`);
    console.log(`   Tool Executions: ${result.data.toolExecutions.length}`);
    console.log(`   Tokens Total: ${result.data.conversation.tokensTotal}`);
    return result.data;
  } else {
    console.log('❌ Failed to get conversation detail!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testBillingInvoices() {
  console.log('\n💰 Testing: GET /api/customer/billing/invoices');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/billing/invoices', null, authToken);
  
  if (result.ok) {
    console.log('✅ Invoices retrieved!');
    console.log(`   Total Invoices: ${result.data.invoices.length}`);
    result.data.invoices.forEach((invoice, index) => {
      console.log(`   ${index + 1}. ${invoice.invoiceNumber} - $${invoice.amount} (${invoice.status})`);
    });
    return result.data;
  } else {
    console.log('❌ Failed to get invoices!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testUsageCurrent() {
  console.log('\n📈 Testing: GET /api/customer/usage/current');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/usage/current', null, authToken);
  
  if (result.ok) {
    console.log('✅ Current usage retrieved!');
    console.log(`   Period: ${result.data.period}`);
    console.log(`   Conversations: ${result.data.usage.conversations}`);
    console.log(`   Tokens: ${result.data.usage.tokens.toLocaleString()}`);
    console.log(`   Tool Calls: ${result.data.usage.toolCalls}`);
    if (result.data.limits.conversations) {
      console.log(`   Limit - Conversations: ${result.data.limits.conversations}`);
    }
    if (result.data.limits.tokens) {
      console.log(`   Limit - Tokens: ${result.data.limits.tokens.toLocaleString()}`);
    }
    return result.data;
  } else {
    console.log('❌ Failed to get current usage!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testUsageTrends() {
  console.log('\n📊 Testing: GET /api/customer/usage/trends?period=30d');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/usage/trends?period=30d', null, authToken);
  
  if (result.ok) {
    console.log('✅ Usage trends retrieved!');
    console.log(`   Daily data points: ${result.data.daily.length}`);
    if (result.data.daily.length > 0) {
      const firstDay = result.data.daily[0];
      const lastDay = result.data.daily[result.data.daily.length - 1];
      console.log(`   First day: ${firstDay.date} - ${firstDay.conversations} conversations, ${firstDay.tokens.toLocaleString()} tokens`);
      console.log(`   Last day: ${lastDay.date} - ${lastDay.conversations} conversations, ${lastDay.tokens.toLocaleString()} tokens`);
    }
    return result.data;
  } else {
    console.log('❌ Failed to get usage trends!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

async function testUsageTools() {
  console.log('\n🔧 Testing: GET /api/customer/usage/tools');
  console.log('─'.repeat(60));
  
  const result = await apiRequest('GET', '/api/customer/usage/tools', null, authToken);
  
  if (result.ok) {
    console.log('✅ Tool usage retrieved!');
    console.log(`   Total Tools Used: ${result.data.tools.length}`);
    result.data.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      Calls: ${tool.callCount}, Success Rate: ${tool.successRate}%, Avg Time: ${tool.avgExecutionTime}ms`);
    });
    return result.data;
  } else {
    console.log('❌ Failed to get tool usage!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
    return null;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Customer Dashboard API Tests');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Access Code: ${ACCESS_CODE}`);

  // Step 1: Login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without authentication token');
    process.exit(1);
  }

  // Step 2: Test all authenticated endpoints
  const overview = await testDashboardOverview();
  const actions = await testActions();
  const conversationId = await testConversations();
  await testConversationDetail(conversationId);
  const invoices = await testBillingInvoices();
  const currentUsage = await testUsageCurrent();
  const trends = await testUsageTrends();
  const toolUsage = await testUsageTools();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Login: ${loginSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Dashboard Overview: ${overview ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Actions: ${actions ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Conversations: ${conversationId ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Conversation Detail: ${conversationId ? 'PASS' : 'SKIP'}`);
  console.log(`✅ Billing Invoices: ${invoices ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Usage Current: ${currentUsage ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Usage Trends: ${trends ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Usage Tools: ${toolUsage ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(60));
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

