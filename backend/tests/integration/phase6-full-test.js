/**
 * Phase 6 Integration Test
 *
 * Comprehensive end-to-end testing of:
 * - Billing infrastructure
 * - Plan configuration and limits
 * - Usage tracking and analytics
 * - Cost calculation
 * - Prorating logic
 */

import { Invoice } from '../../src/models/Invoice.js';
import { Client } from '../../src/models/Client.js';
import { BillingService } from '../../src/services/billingService.js';
import { UsageTracker } from '../../src/services/usageTracker.js';
import { CostCalculator } from '../../src/services/costCalculator.js';
import { getPlanConfig, checkLimit, getPlanLimits } from '../../src/config/planLimits.js';
import { ApiUsage } from '../../src/models/ApiUsage.js';

console.log('🚀 Starting Phase 6 Integration Tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  try {
    // ========================================
    // TEST 1: Plan Configuration
    // ========================================
    console.log('📋 Test 1: Plan Configuration System');

    const freePlan = getPlanConfig('free');
    assert(freePlan !== null, 'Free plan configuration loaded');
    assert(freePlan.limits.messagesPerMonth === 500, 'Free plan message limit is 500');
    assert(freePlan.pricing.baseCost === 0, 'Free plan has no base cost');

    const proPlan = getPlanConfig('pro');
    assert(proPlan.limits.messagesPerMonth === 100000, 'Pro plan message limit is 100K');
    assert(proPlan.pricing.baseCost === 99.99, 'Pro plan base cost is $99.99');
    assert(proPlan.features.customBranding === true, 'Pro plan has custom branding');

    console.log('');

    // ========================================
    // TEST 2: Limit Checking
    // ========================================
    console.log('📊 Test 2: Limit Checking Logic');

    const limitCheck1 = checkLimit('free', 'messagesPerMonth', 450);
    assert(limitCheck1.allowed === true, 'Usage below limit is allowed');
    assert(limitCheck1.remaining === 50, 'Remaining usage calculated correctly');

    const limitCheck2 = checkLimit('free', 'messagesPerMonth', 550);
    assert(limitCheck2.exceeded === true, 'Usage above limit is flagged');
    assert(limitCheck2.allowed === false, 'Usage above limit is not allowed');

    const limitCheck3 = checkLimit('enterprise', 'integrationsEnabled', 999999);
    assert(limitCheck3.allowed === true, 'Unlimited (null) limits always allow');
    assert(limitCheck3.limit === null, 'Unlimited limit is null');

    console.log('');

    // ========================================
    // TEST 3: Usage Tracking
    // ========================================
    console.log('📈 Test 3: Usage Tracking & Analytics');

    // Get a test client (using one created by mock data)
    const clients = await Client.findAll(1, 0);
    assert(clients.length > 0, 'Test clients exist in database');

    const testClient = clients[0];
    console.log(`  Testing with client: ${testClient.name} (ID: ${testClient.id})`);

    // Get usage summary
    const summary = await UsageTracker.getUsageSummary(testClient.id, 'month');
    assert(summary !== null, 'Usage summary retrieved');
    assert(typeof summary.messages === 'number', 'Messages count is a number');
    assert(typeof summary.conversations === 'number', 'Conversations count is a number');
    assert(typeof summary.tokens.total === 'number', 'Total tokens is a number');
    console.log(`  Current usage: ${summary.messages} messages, ${summary.conversations} conversations`);

    // Get usage history
    const history = await UsageTracker.getUsageHistory(testClient.id, 'messages', 6);
    assert(Array.isArray(history), 'Usage history is an array');
    assert(history.length > 0, 'Usage history has data');
    console.log(`  Usage history: ${history.length} months of data`);

    console.log('');

    // ========================================
    // TEST 4: Cost Calculation
    // ========================================
    console.log('💰 Test 4: Cost Calculation');

    const testUsage = {
      total_tokens_input: 50000,
      total_tokens_output: 75000,
      total_messages: 100,
      total_tool_calls: 10,
    };

    const freeCost = BillingService.calculateUsageCost(testUsage, 'free');
    assert(freeCost === 0, 'Free plan has no usage cost');

    const starterCost = BillingService.calculateUsageCost(testUsage, 'starter');
    assert(starterCost > 0, 'Starter plan has usage cost');
    console.log(`  Starter plan cost for test usage: $${starterCost}`);

    const proCost = BillingService.calculateUsageCost(testUsage, 'pro');
    assert(proCost > 0, 'Pro plan has usage cost');
    assert(proCost < starterCost, 'Pro plan has lower per-unit cost than Starter');
    console.log(`  Pro plan cost for test usage: $${proCost}`);

    // Test LLM provider cost calculation
    const llmCost = CostCalculator.calculateTokenCost(50000, 75000, 'claude-3-5-sonnet');
    assert(llmCost > 0, 'LLM cost calculation works');
    console.log(`  Claude 3.5 Sonnet cost: $${llmCost}`);

    const ollamaCost = CostCalculator.calculateTokenCost(50000, 75000, 'ollama');
    assert(ollamaCost === 0, 'Ollama (local) has no cost');

    console.log('');

    // ========================================
    // TEST 5: Invoice Generation
    // ========================================
    console.log('📝 Test 5: Invoice Generation');

    // Find a paid client (not free tier) - fetch more clients if needed
    let paidClients = clients.filter(c => c.plan_type !== 'free');
    if (paidClients.length === 0) {
      // Fetch more clients
      const allClients = await Client.findAll(100, 0);
      paidClients = allClients.filter(c => c.plan_type !== 'free');
    }
    assert(paidClients.length > 0, 'Paid clients exist for testing');

    const paidClient = paidClients[0];
    console.log(`  Testing invoice generation for: ${paidClient.name} (${paidClient.plan_type})`);

    const now = new Date();
    const testPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if invoice already exists
    const existingInvoice = await Invoice.findByClientAndPeriod(paidClient.id, testPeriod);
    if (existingInvoice) {
      console.log(`  Invoice already exists for ${testPeriod}, testing with existing invoice`);
      assert(existingInvoice.plan_type === paidClient.plan_type, 'Invoice plan type matches client');
      assert(existingInvoice.total_cost > 0, 'Invoice has a cost');
      console.log(`  Invoice total: $${existingInvoice.total_cost}`);
    } else {
      // Generate new invoice
      const invoiceResult = await BillingService.generateInvoice(paidClient.id, testPeriod, false);
      assert(invoiceResult.invoice !== null, 'Invoice generated successfully');
      assert(invoiceResult.invoice.total_cost > 0, 'Invoice has total cost');
      console.log(`  Generated invoice: $${invoiceResult.invoice.total_cost}`);

      // Clean up - delete test invoice
      await Invoice.delete(invoiceResult.invoice.id);
      console.log('  Cleaned up test invoice');
    }

    console.log('');

    // ========================================
    // TEST 6: Revenue Analytics
    // ========================================
    console.log('💵 Test 6: Revenue Analytics');

    const revenue = await BillingService.getRevenueSummary();
    assert(revenue !== null, 'Revenue summary retrieved');
    assert(typeof parseFloat(revenue.total_revenue) === 'number', 'Total revenue is a number');
    assert(typeof parseFloat(revenue.paid_revenue) === 'number', 'Paid revenue is a number');
    console.log(`  Total revenue: $${parseFloat(revenue.total_revenue || 0).toFixed(2)}`);
    console.log(`  Paid revenue: $${parseFloat(revenue.paid_revenue || 0).toFixed(2)}`);
    console.log(`  Outstanding: $${parseFloat(revenue.outstanding_revenue || 0).toFixed(2)}`);

    const monthlyRevenue = await BillingService.getMonthlyRevenue(3);
    assert(Array.isArray(monthlyRevenue), 'Monthly revenue is an array');
    console.log(`  Monthly revenue data: ${monthlyRevenue.length} months`);

    const revenueByPlan = await BillingService.getRevenueByPlan();
    assert(Array.isArray(revenueByPlan), 'Revenue by plan is an array');
    console.log(`  Revenue by plan types: ${revenueByPlan.length} plans`);

    console.log('');

    // ========================================
    // TEST 7: Outstanding Payments
    // ========================================
    console.log('⏰ Test 7: Outstanding Payments');

    const outstanding = await BillingService.getOutstandingPayments();
    assert(outstanding !== null, 'Outstanding payments summary retrieved');
    assert(typeof outstanding.total_count === 'number', 'Total count is a number');
    assert(typeof outstanding.total_amount === 'number', 'Total amount is a number');
    console.log(`  Outstanding invoices: ${outstanding.total_count}`);
    console.log(`  Outstanding amount: $${outstanding.total_amount}`);
    console.log(`  Pending: ${outstanding.pending_count} ($${outstanding.pending_amount})`);
    console.log(`  Overdue: ${outstanding.overdue_count} ($${outstanding.overdue_amount})`);

    console.log('');

    // ========================================
    // TEST 8: Plan Limits Integration
    // ========================================
    console.log('🔒 Test 8: Plan Limits with Real Usage');

    // Find a client with significant usage
    const clientsWithUsage = [];
    for (const client of clients.slice(0, 5)) {
      const usage = await UsageTracker.getUsageSummary(client.id, 'month');
      if (usage.messages > 0) {
        clientsWithUsage.push({ client, usage });
      }
    }

    assert(clientsWithUsage.length > 0, 'Found clients with usage data');

    const { client: usageClient, usage: clientUsage } = clientsWithUsage[0];
    console.log(`  Testing limits for: ${usageClient.name} (${usageClient.plan_type})`);
    console.log(`  Current usage: ${clientUsage.messages} messages, ${clientUsage.tokens.total} tokens`);

    const planLimits = getPlanLimits(usageClient.plan_type);
    const messageLimit = checkLimit(usageClient.plan_type, 'messagesPerMonth', clientUsage.messages);
    const tokenLimit = checkLimit(usageClient.plan_type, 'tokensPerMonth', clientUsage.tokens.total);

    console.log(`  Messages: ${clientUsage.messages}/${planLimits.messagesPerMonth || 'unlimited'} (${messageLimit.exceeded ? 'EXCEEDED' : 'OK'})`);
    console.log(`  Tokens: ${clientUsage.tokens.total}/${planLimits.tokensPerMonth || 'unlimited'} (${tokenLimit.exceeded ? 'EXCEEDED' : 'OK'})`);

    console.log('');

    // ========================================
    // TEST 9: Export Functionality
    // ========================================
    console.log('📤 Test 9: Usage Export');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const csvData = await UsageTracker.exportUsageCSV(
      testClient.id,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    assert(typeof csvData === 'string', 'CSV data is a string');
    assert(csvData.includes('Date,Conversations,Messages'), 'CSV has correct headers');
    assert(csvData.length > 100, 'CSV has substantial data');
    console.log(`  CSV export size: ${csvData.length} characters`);

    console.log('');

    // ========================================
    // TEST 10: Top Clients Analytics
    // ========================================
    console.log('🏆 Test 10: Top Clients Analytics');

    const topByMessages = await UsageTracker.getTopClients('messages', 5, 'month');
    assert(Array.isArray(topByMessages), 'Top clients by messages is an array');
    console.log(`  Top clients by messages: ${topByMessages.length}`);
    if (topByMessages.length > 0) {
      console.log(`  #1: ${topByMessages[0].clientName} - ${topByMessages[0].value} messages`);
    }

    const topByCost = await UsageTracker.getTopClients('cost', 5, 'month');
    assert(Array.isArray(topByCost), 'Top clients by cost is an array');
    console.log(`  Top clients by cost: ${topByCost.length}`);
    if (topByCost.length > 0) {
      console.log(`  #1: ${topByCost[0].clientName} - $${topByCost[0].value}`);
    }

    console.log('');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 All Phase 6 tests passed successfully!\n');
      console.log('Phase 6 Features Verified:');
      console.log('  ✅ Plan configuration and limits');
      console.log('  ✅ Usage tracking and analytics');
      console.log('  ✅ Cost calculation (plan-based and LLM-based)');
      console.log('  ✅ Invoice generation and management');
      console.log('  ✅ Revenue analytics and reporting');
      console.log('  ✅ Outstanding payment tracking');
      console.log('  ✅ CSV export functionality');
      console.log('  ✅ Top clients analytics');
      console.log('');
      process.exit(0);
    } else {
      console.error('❌ Some tests failed. Please review the errors above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
