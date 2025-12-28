import { db } from '../db.js';
import { Client } from '../models/Client.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { Invoice } from '../models/Invoice.js';
import { BillingService } from '../services/billingService.js';

/**
 * Mock Data Generator for Phase 6 Testing
 *
 * Generates realistic test data including:
 * - Multiple clients across different plan tiers
 * - Historical usage data (3-6 months)
 * - Sample invoices with various statuses
 * - Varied usage patterns to test analytics and limits
 */

// Mock company names for test clients
const MOCK_COMPANIES = [
  { name: 'TechStart Solutions', domain: 'techstart.com', plan: 'free' },
  { name: 'E-Commerce Hub', domain: 'ecommercehub.com', plan: 'starter' },
  { name: 'Digital Marketing Pro', domain: 'digitalmarketingpro.com', plan: 'starter' },
  { name: 'Enterprise Corp', domain: 'enterprisecorp.com', plan: 'pro' },
  { name: 'Global Retail Inc', domain: 'globalretail.com', plan: 'pro' },
  { name: 'Mega Corporation', domain: 'megacorp.com', plan: 'enterprise' },
  { name: 'Startup Ventures', domain: 'startupventures.com', plan: 'free' },
  { name: 'Cloud Services Ltd', domain: 'cloudservices.com', plan: 'starter' },
  { name: 'Finance Solutions', domain: 'financesolutions.com', plan: 'pro' },
  { name: 'Healthcare Systems', domain: 'healthcaresys.com', plan: 'enterprise' },
];

/**
 * Generate random usage data based on plan type
 */
function generateUsageForPlan(planType) {
  const baseUsage = {
    free: {
      conversations: () => Math.floor(Math.random() * 15) + 1,
      messages: () => Math.floor(Math.random() * 150) + 10,
      tokens_input: () => Math.floor(Math.random() * 5000) + 500,
      tokens_output: () => Math.floor(Math.random() * 8000) + 1000,
      tool_calls: () => Math.floor(Math.random() * 5) + 1,
    },
    starter: {
      conversations: () => Math.floor(Math.random() * 300) + 50,
      messages: () => Math.floor(Math.random() * 3000) + 500,
      tokens_input: () => Math.floor(Math.random() * 150000) + 20000,
      tokens_output: () => Math.floor(Math.random() * 250000) + 40000,
      tool_calls: () => Math.floor(Math.random() * 150) + 20,
    },
    pro: {
      conversations: () => Math.floor(Math.random() * 2000) + 500,
      messages: () => Math.floor(Math.random() * 20000) + 3000,
      tokens_input: () => Math.floor(Math.random() * 1500000) + 200000,
      tokens_output: () => Math.floor(Math.random() * 2500000) + 400000,
      tool_calls: () => Math.floor(Math.random() * 1000) + 200,
    },
    enterprise: {
      conversations: () => Math.floor(Math.random() * 15000) + 5000,
      messages: () => Math.floor(Math.random() * 150000) + 30000,
      tokens_input: () => Math.floor(Math.random() * 15000000) + 2000000,
      tokens_output: () => Math.floor(Math.random() * 25000000) + 4000000,
      tool_calls: () => Math.floor(Math.random() * 8000) + 2000,
    },
  };

  const usage = baseUsage[planType];
  return {
    conversations: usage.conversations(),
    messages: usage.messages(),
    tokens_input: usage.tokens_input(),
    tokens_output: usage.tokens_output(),
    tool_calls: usage.tool_calls(),
  };
}

/**
 * Calculate cost estimate for usage
 */
function calculateCostEstimate(usage, planType) {
  const pricing = BillingService.getPricingConfig(planType);

  const totalTokens = usage.tokens_input + usage.tokens_output;
  const tokensInThousands = totalTokens / 1000;

  const tokenCost = tokensInThousands * (pricing.costPerThousandTokens || 0);
  const messageCost = usage.messages * (pricing.costPerMessage || 0);
  const toolCallCost = usage.tool_calls * (pricing.costPerToolCall || 0);

  return parseFloat((tokenCost + messageCost + toolCallCost).toFixed(2));
}

/**
 * Create test clients
 */
async function createMockClients() {
  console.log('\n📝 Creating mock clients...');
  const clients = [];

  for (const company of MOCK_COMPANIES) {
    try {
      const client = await Client.create(company.name, company.domain, company.plan);

      clients.push(client);
      console.log(`  ✅ Created: ${client.name} (${client.plan_type})`);
    } catch (error) {
      console.error(`  ❌ Failed to create ${company.name}:`, error.message);
    }
  }

  return clients;
}

/**
 * Generate historical usage data
 */
async function generateHistoricalUsage(clients, months = 6) {
  console.log(`\n📊 Generating ${months} months of usage data...`);

  const now = new Date();

  for (const client of clients) {
    console.log(`  Processing ${client.name}...`);

    for (let monthOffset = 0; monthOffset < months; monthOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Generate daily usage for the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);

        // Skip future dates
        if (date > now) continue;

        const dateStr = date.toISOString().split('T')[0];

        // Generate usage with some variation (some days higher, some lower)
        const dailyMultiplier = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
        const baseUsage = generateUsageForPlan(client.plan_type);

        const usage = {
          conversations: Math.floor(baseUsage.conversations * dailyMultiplier / 30),
          messages: Math.floor(baseUsage.messages * dailyMultiplier / 30),
          tokens_input: Math.floor(baseUsage.tokens_input * dailyMultiplier / 30),
          tokens_output: Math.floor(baseUsage.tokens_output * dailyMultiplier / 30),
          tool_calls: Math.floor(baseUsage.tool_calls * dailyMultiplier / 30),
        };

        const costEstimate = calculateCostEstimate(usage, client.plan_type);

        try {
          await ApiUsage.recordUsage(
            client.id,
            usage.conversations,
            usage.messages,
            usage.tokens_input,
            usage.tokens_output,
            usage.tool_calls,
            costEstimate,
            dateStr
          );
        } catch (error) {
          // Ignore duplicate errors (date already exists)
          if (!error.message.includes('duplicate')) {
            console.error(`    ❌ Failed to create usage for ${dateStr}:`, error.message);
          }
        }
      }
    }

    console.log(`    ✅ Generated ${months} months of data`);
  }
}

/**
 * Generate sample invoices
 */
async function generateInvoices(clients, months = 6) {
  console.log(`\n💰 Generating invoices for the last ${months} months...`);

  const now = new Date();

  for (const client of clients) {
    // Skip free tier (no invoices)
    if (client.plan_type === 'free') {
      console.log(`  ⏭️  Skipping ${client.name} (free plan)`);
      continue;
    }

    console.log(`  Processing ${client.name}...`);

    for (let monthOffset = 1; monthOffset <= months; monthOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const billingPeriod = `${year}-${month.toString().padStart(2, '0')}`;

      try {
        // Check if invoice already exists
        const existing = await Invoice.findByClientAndPeriod(client.id, billingPeriod);
        if (existing) {
          console.log(`    ⏭️  Invoice already exists for ${billingPeriod}`);
          continue;
        }

        // Generate invoice
        const result = await BillingService.generateInvoice(client.id, billingPeriod, false);

        // Randomly mark some invoices as paid (80% paid for older months)
        const isPaid = Math.random() < (monthOffset > 2 ? 0.8 : 0.3);

        if (isPaid) {
          await Invoice.markAsPaid(result.invoice.id, {
            payment_provider: 'manual',
            payment_method: 'credit_card',
            notes: 'Automatically paid (mock data)',
          });
          console.log(`    ✅ Generated and paid invoice for ${billingPeriod}: $${result.invoice.total_cost}`);
        } else {
          console.log(`    ✅ Generated pending invoice for ${billingPeriod}: $${result.invoice.total_cost}`);
        }
      } catch (error) {
        console.error(`    ❌ Failed to generate invoice for ${billingPeriod}:`, error.message);
      }
    }
  }
}

/**
 * Create some clients near their limits (for testing limit enforcement)
 */
async function createLimitTestClients() {
  console.log('\n⚠️  Creating clients near plan limits...');

  // Free plan client near message limit
  const nearLimitClient = await Client.create('Near Limit Free User', 'nearlimit.com', 'free');

  // Create usage that's 95% of free limit (500 messages)
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  await ApiUsage.recordUsage(
    nearLimitClient.id,
    45,  // 45/50 conversations
    475, // 475/500 messages (95%)
    45000, // 45K/50K tokens (90%)
    3000,
    23, // 23/25 tool calls (92%)
    0,
    dateStr
  );

  console.log(`  ✅ Created near-limit client: ${nearLimitClient.name}`);
  console.log('     - Messages: 475/500 (95%)');
  console.log('     - Tokens: 48K/50K (96%)');
  console.log('     - Tool calls: 23/25 (92%)');

  return nearLimitClient;
}

/**
 * Display summary statistics
 */
async function displaySummary() {
  console.log('\n📈 Summary Statistics:');

  // Count clients by plan
  const clientStats = await db.query(`
    SELECT plan_type, COUNT(*) as count
    FROM clients
    WHERE status = 'active'
    GROUP BY plan_type
    ORDER BY plan_type
  `);

  console.log('\n  Clients by Plan:');
  clientStats.rows.forEach(row => {
    console.log(`    ${row.plan_type}: ${row.count} clients`);
  });

  // Count usage records
  const usageStats = await db.query(`
    SELECT COUNT(*) as total_records,
           COUNT(DISTINCT client_id) as unique_clients,
           SUM(message_count) as total_messages,
           SUM(conversation_count) as total_conversations
    FROM api_usage
  `);

  console.log('\n  Usage Data:');
  console.log(`    Total records: ${usageStats.rows[0].total_records}`);
  console.log(`    Unique clients: ${usageStats.rows[0].unique_clients}`);
  console.log(`    Total messages: ${usageStats.rows[0].total_messages}`);
  console.log(`    Total conversations: ${usageStats.rows[0].total_conversations}`);

  // Count invoices
  const invoiceStats = await db.query(`
    SELECT
      COUNT(*) as total_invoices,
      SUM(total_cost) as total_revenue,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
      SUM(CASE WHEN status = 'paid' THEN total_cost ELSE 0 END) as paid_revenue
    FROM invoices
  `);

  console.log('\n  Invoices:');
  console.log(`    Total invoices: ${invoiceStats.rows[0].total_invoices}`);
  console.log(`    Paid invoices: ${invoiceStats.rows[0].paid_count}`);
  console.log(`    Total revenue: $${parseFloat(invoiceStats.rows[0].total_revenue || 0).toFixed(2)}`);
  console.log(`    Paid revenue: $${parseFloat(invoiceStats.rows[0].paid_revenue || 0).toFixed(2)}`);
}

/**
 * Clear existing test data
 */
async function clearExistingData() {
  console.log('\n🗑️  Clearing existing test data...');

  // Delete test clients (this will cascade delete usage and invoices)
  await db.query(`
    DELETE FROM clients
    WHERE domain IN (
      'techstart.com', 'ecommercehub.com', 'digitalmarketingpro.com',
      'enterprisecorp.com', 'globalretail.com', 'megacorp.com',
      'startupventures.com', 'cloudservices.com', 'financesolutions.com',
      'healthcaresys.com', 'nearlimit.com'
    )
  `);

  console.log('  ✅ Cleared existing mock data');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting mock data generation...\n');
    console.log('This will create:');
    console.log('  - 10 test clients across all plan tiers');
    console.log('  - 6 months of historical usage data');
    console.log('  - Sample invoices with varied payment statuses');
    console.log('  - Clients near plan limits for testing\n');

    // Clear existing test data first
    await clearExistingData();

    // Create clients
    const clients = await createMockClients();

    // Generate usage data
    await generateHistoricalUsage(clients, 6);

    // Generate invoices
    await generateInvoices(clients, 6);

    // Create limit test clients
    await createLimitTestClients();

    // Display summary
    await displaySummary();

    console.log('\n✅ Mock data generation complete!\n');
    console.log('You can now:');
    console.log('  - View clients in admin dashboard');
    console.log('  - Check usage analytics');
    console.log('  - Review invoices and revenue');
    console.log('  - Test plan limit enforcement');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating mock data:', error);
    process.exit(1);
  }
}

// Run if called directly
main();

export { main as generateMockData };
