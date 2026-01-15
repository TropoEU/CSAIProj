/**
 * Debug script to check Adaptive Mode configuration
 *
 * Run: node src/scripts/checkAdaptiveMode.js
 */

import { db } from '../db.js';

async function checkAdaptiveMode() {
  console.log('🔍 Checking Adaptive Mode Configuration\n');
  console.log('='.repeat(60));

  try {
    // Check all plans
    console.log('\n📋 Plans Configuration:');
    const plansResult = await db.query(`
      SELECT id, name, display_name, ai_mode,
             (SELECT COUNT(*) FROM clients WHERE plan_type = plans.name) as clients_count
      FROM plans
      ORDER BY sort_order, name
    `);

    if (plansResult.rows.length === 0) {
      console.log('❌ No plans found in database!');
    } else {
      console.table(
        plansResult.rows.map((p) => ({
          ID: p.id,
          Name: p.name,
          'Display Name': p.display_name,
          'AI Mode': p.ai_mode || 'standard (default)',
          Clients: p.clients_count,
        }))
      );
    }

    // Check clients and their plan assignments
    console.log('\n👥 Clients and Their Plans:');
    const clientsResult = await db.query(`
      SELECT
        c.id,
        c.name,
        c.plan_type,
        p.ai_mode,
        p.display_name as plan_display_name
      FROM clients c
      LEFT JOIN plans p ON c.plan_type = p.name
      WHERE c.status = 'active'
      ORDER BY c.id
    `);

    if (clientsResult.rows.length === 0) {
      console.log('❌ No active clients found!');
    } else {
      console.table(
        clientsResult.rows.map((c) => ({
          'Client ID': c.id,
          'Client Name': c.name,
          'Plan Type': c.plan_type,
          'Plan Display Name': c.plan_display_name || '(plan not found)',
          'AI Mode': c.ai_mode || 'standard (default)',
        }))
      );
    }

    // Check recent conversations
    console.log('\n💬 Recent Conversations (last 10):');
    const conversationsResult = await db.query(`
      SELECT
        c.id,
        c.session_id,
        cl.name as client_name,
        cl.plan_type,
        p.ai_mode,
        c.created_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN plans p ON cl.plan_type = p.name
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    if (conversationsResult.rows.length === 0) {
      console.log('❌ No conversations found!');
    } else {
      console.table(
        conversationsResult.rows.map((conv) => ({
          'Conv ID': conv.id,
          Client: conv.client_name,
          Plan: conv.plan_type,
          'AI Mode': conv.ai_mode || 'standard',
          Messages: conv.message_count,
          Created: new Date(conv.created_at).toLocaleString(),
        }))
      );
    }

    // Check for adaptive mode usage in api_usage
    console.log('\n📊 Adaptive Mode Usage:');
    const usageResult = await db.query(`
      SELECT
        client_id,
        c.name as client_name,
        SUM(adaptive_count) as total_adaptive_messages,
        SUM(critique_count) as total_critiques,
        SUM(context_fetch_count) as total_context_fetches
      FROM api_usage au
      JOIN clients c ON au.client_id = c.id
      WHERE adaptive_count > 0 OR critique_count > 0 OR context_fetch_count > 0
      GROUP BY client_id, c.name
    `);

    if (usageResult.rows.length === 0) {
      console.log('ℹ️  No adaptive mode usage recorded yet');
    } else {
      console.table(
        usageResult.rows.map((u) => ({
          'Client ID': u.client_id,
          'Client Name': u.client_name,
          'Adaptive Messages': u.total_adaptive_messages,
          Critiques: u.total_critiques,
          'Context Fetches': u.total_context_fetches,
        }))
      );
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Configuration Check Complete\n');

    const adaptivePlans = plansResult.rows.filter((p) => p.ai_mode === 'adaptive');
    const clientsOnAdaptive = clientsResult.rows.filter((c) => c.ai_mode === 'adaptive');

    if (adaptivePlans.length === 0) {
      console.log('⚠️  WARNING: No plans have ai_mode set to "adaptive"!');
      console.log('   To fix: Edit a plan in Admin Dashboard and set AI Mode to "Adaptive"\n');
    } else {
      console.log(`✓ ${adaptivePlans.length} plan(s) configured with adaptive mode`);
    }

    if (clientsOnAdaptive.length === 0) {
      console.log('⚠️  WARNING: No clients are assigned to an adaptive mode plan!');
      console.log('   To fix: Assign a client to a plan with Adaptive mode\n');
    } else {
      console.log(`✓ ${clientsOnAdaptive.length} client(s) on adaptive mode plans`);
    }

    if (usageResult.rows.length > 0) {
      console.log(
        `✓ Adaptive mode has been used (${usageResult.rows.length} client(s) with usage)`
      );
    } else {
      console.log('ℹ️  Adaptive mode has not been used yet (or no usage recorded)');
    }
  } catch (error) {
    console.error('❌ Error checking configuration:', error);
  } finally {
    await db.end();
    process.exit(0);
  }
}

checkAdaptiveMode();
