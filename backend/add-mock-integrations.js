import { db } from './src/db.js';

const integrationTemplates = [
  {
    type: 'shopify',
    name: 'My Shopify Store',
    config: {
      api_key: 'shopify_test_key_123456789',
      api_secret: 'shopify_secret_abc',
      webhook_url: 'https://mystore.myshopify.com/admin/api/webhooks',
      shop_domain: 'mystore.myshopify.com'
    }
  },
  {
    type: 'woocommerce',
    name: 'WooCommerce Store',
    config: {
      api_key: 'ck_test_woocommerce_key',
      api_secret: 'cs_test_woocommerce_secret',
      webhook_url: 'https://mysite.com/wp-json/wc/v3',
      store_url: 'https://mysite.com'
    }
  },
  {
    type: 'gmail',
    name: 'Support Gmail',
    config: {
      api_key: 'gmail_oauth_token_123',
      email: 'support@example.com',
      refresh_token: 'refresh_token_xyz'
    }
  },
  {
    type: 'google_calendar',
    name: 'Business Calendar',
    config: {
      api_key: 'calendar_oauth_token_456',
      calendar_id: 'primary',
      refresh_token: 'refresh_token_calendar'
    }
  },
  {
    type: 'stripe',
    name: 'Stripe Payments',
    config: {
      api_key: 'sk_test_stripe_key_789',
      webhook_secret: 'whsec_test_secret',
      webhook_url: 'https://api.stripe.com/v1'
    }
  }
];

async function addMockIntegrations() {
  try {
    console.log('🔍 Fetching active clients...');

    // Get all active clients
    const clientsResult = await db.query(
      'SELECT id, name FROM clients WHERE status = $1 LIMIT 10',
      ['active']
    );

    const clients = clientsResult.rows;

    if (clients.length === 0) {
      console.log('❌ No active clients found');
      process.exit(0);
    }

    console.log(`✅ Found ${clients.length} active clients\n`);

    let totalAdded = 0;

    // Add 2-3 random integrations to each client
    for (const client of clients) {
      const numIntegrations = Math.floor(Math.random() * 2) + 2; // 2-3 integrations
      const selectedTemplates = [...integrationTemplates]
        .sort(() => Math.random() - 0.5)
        .slice(0, numIntegrations);

      console.log(`📦 Adding ${numIntegrations} integrations for ${client.name}:`);

      for (const template of selectedTemplates) {
        const connectionConfig = {
          name: template.name,
          ...template.config
        };

        try {
          const result = await db.query(
            `INSERT INTO client_integrations (
              client_id,
              integration_type,
              connection_config,
              enabled,
              last_sync_test
            ) VALUES ($1, $2, $3, $4, NOW())
            RETURNING id`,
            [
              client.id,
              template.type,
              JSON.stringify(connectionConfig),
              Math.random() > 0.2 // 80% active, 20% inactive
            ]
          );

          console.log(`  ✓ ${template.type.padEnd(20)} - ${template.name}`);
          totalAdded++;
        } catch (err) {
          if (err.code === '23505') {
            // Duplicate, skip
            console.log(`  ⊘ ${template.type.padEnd(20)} - Already exists`);
          } else {
            throw err;
          }
        }
      }

      console.log('');
    }

    console.log('========================================');
    console.log(`✅ Successfully added ${totalAdded} integrations`);
    console.log('========================================\n');

    // Show summary
    const summaryResult = await db.query(`
      SELECT
        c.name as client_name,
        ci.integration_type,
        ci.connection_config->>'name' as integration_name,
        ci.enabled,
        ci.last_sync_test
      FROM client_integrations ci
      JOIN clients c ON ci.client_id = c.id
      ORDER BY c.name, ci.integration_type
    `);

    console.log('📊 Current Integrations:');
    console.log('─'.repeat(80));

    let currentClient = '';
    summaryResult.rows.forEach(row => {
      if (row.client_name !== currentClient) {
        if (currentClient) console.log('');
        console.log(`\n${row.client_name}:`);
        currentClient = row.client_name;
      }
      const status = row.enabled ? '🟢' : '🔴';
      console.log(`  ${status} ${row.integration_type.padEnd(20)} - ${row.integration_name}`);
    });

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMockIntegrations();
