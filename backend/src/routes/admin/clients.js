import express from 'express';
import { Client } from '../../models/Client.js';
import { Invoice } from '../../models/Invoice.js';
import { BillingService } from '../../services/billingService.js';
import { db } from '../../db.js';

const router = express.Router();

/**
 * GET /admin/clients
 * Get all clients with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    let clients = await Client.findAll(parseInt(limit, 10), parseInt(offset, 10));

    if (status && status !== 'all') {
      clients = clients.filter((c) => c.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.domain?.toLowerCase().includes(searchLower)
      );
    }

    res.json(clients);
  } catch (error) {
    console.error('[Admin] Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

/**
 * GET /admin/clients/:id
 * Get client by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Get client error:', error);
    res.status(500).json({ error: 'Failed to get client' });
  }
});

/**
 * POST /admin/clients
 * Create a new client
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      domain,
      planType = 'free',
      email,
      llmProvider = 'ollama',
      modelName,
      systemPrompt,
      status = 'active',
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const client = await Client.create(
      name,
      domain,
      planType,
      email,
      llmProvider,
      modelName,
      systemPrompt,
      status
    );
    res.status(201).json(client);
  } catch (error) {
    console.error('[Admin] Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * PUT /admin/clients/:id
 * Update client
 */
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      domain,
      plan_type,
      status,
      email,
      llm_provider,
      model_name,
      system_prompt,
      widget_config,
      business_info,
      language,
    } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (plan_type !== undefined) updates.plan_type = plan_type;
    if (status !== undefined) updates.status = status;
    if (email !== undefined) updates.email = email;
    if (llm_provider !== undefined) updates.llm_provider = llm_provider;
    if (model_name !== undefined) updates.model_name = model_name;
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (widget_config !== undefined) updates.widget_config = widget_config;
    if (business_info !== undefined) updates.business_info = business_info;
    if (language !== undefined) updates.language = language;

    const client = await Client.update(req.params.id, updates);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('[Admin] Update client error:', error);
    console.error('[Admin] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update client', message: error.message });
  }
});

/**
 * DELETE /admin/clients/:id
 * Delete client (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.deactivate(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deactivated', client });
  } catch (error) {
    console.error('[Admin] Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

/**
 * POST /admin/clients/:id/api-key
 * Regenerate client API key
 */
router.post('/:id/api-key', async (req, res) => {
  try {
    const client = await Client.regenerateApiKey(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Regenerate API key error:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

/**
 * PUT /admin/clients/:id/api-key
 * Update client API key manually
 */
router.put('/:id/api-key', async (req, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key || api_key.trim().length < 10) {
      return res.status(400).json({ error: 'API key must be at least 10 characters' });
    }
    const client = await Client.updateApiKey(req.params.id, api_key.trim());
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Update API key error:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

/**
 * GET /admin/clients/:id/business-info
 * Get client business information
 */
router.get('/:id/business-info', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const defaultBusinessInfo = {
      about_business: '',
      custom_instructions: '',
      business_hours: '',
      contact_phone: '',
      contact_email: '',
      contact_address: '',
      return_policy: '',
      shipping_policy: '',
      payment_methods: '',
      faq: [],
    };

    res.json({
      client_id: client.id,
      client_name: client.name,
      business_info: client.business_info || defaultBusinessInfo,
    });
  } catch (error) {
    console.error('[Admin] Get business info error:', error);
    res.status(500).json({ error: 'Failed to get business information' });
  }
});

/**
 * PUT /admin/clients/:id/business-info
 * Update client business information
 */
router.put('/:id/business-info', async (req, res) => {
  try {
    const { business_info } = req.body;

    if (!business_info || typeof business_info !== 'object') {
      return res.status(400).json({ error: 'Invalid business_info format' });
    }

    if (business_info.faq && !Array.isArray(business_info.faq)) {
      return res.status(400).json({ error: 'FAQ must be an array' });
    }

    if (business_info.faq) {
      for (const item of business_info.faq) {
        if (!item.question || !item.answer) {
          return res.status(400).json({ error: 'Each FAQ item must have question and answer' });
        }
      }
    }

    const client = await Client.update(req.params.id, { business_info });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({
      message: 'Business information updated successfully',
      business_info: client.business_info,
    });
  } catch (error) {
    console.error('[Admin] Update business info error:', error);
    res.status(500).json({ error: 'Failed to update business information' });
  }
});

/**
 * POST /admin/clients/:id/access-code
 * Regenerate client access code for customer dashboard
 */
router.post('/:id/access-code', async (req, res) => {
  try {
    const client = await Client.regenerateAccessCode(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('[Admin] Regenerate access code error:', error);
    res.status(500).json({ error: 'Failed to regenerate access code' });
  }
});

/**
 * POST /admin/clients/:id/upgrade-plan
 * Upgrade/downgrade client plan with prorating
 */
router.post('/:id/upgrade-plan', async (req, res) => {
  try {
    const { newPlan } = req.body;

    if (!newPlan) {
      return res.status(400).json({ error: 'New plan type is required' });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const oldPlan = client.plan_type;

    if (oldPlan === newPlan) {
      return res.status(400).json({ error: 'Client is already on this plan' });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate() + 1;
    const prorateRatio = daysRemaining / daysInMonth;

    const oldPricing = BillingService.getPricingConfig(oldPlan);
    const newPricing = BillingService.getPricingConfig(newPlan);

    const unusedOldPlanAmount = oldPricing.baseCost * prorateRatio;
    const proratedNewPlanAmount = newPricing.baseCost * prorateRatio;
    const proratedDifference = proratedNewPlanAmount - unusedOldPlanAmount;

    const updatedClient = await Client.update(req.params.id, { plan_type: newPlan });

    let prorateNote = '';
    if (Math.abs(proratedDifference) > 0.01) {
      if (proratedDifference > 0) {
        prorateNote = `Prorated charge of $${proratedDifference.toFixed(2)} for ${daysRemaining} days at new rate.`;

        const billingPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        try {
          await Invoice.create({
            clientId: client.id,
            billingPeriod,
            planType: newPlan,
            baseCost: proratedDifference,
            usageCost: 0,
            totalCost: proratedDifference,
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: `Prorated charge for plan upgrade from ${oldPlan} to ${newPlan} on ${now.toISOString().split('T')[0]}`,
          });
        } catch (err) {
          console.error('[Admin] Failed to create prorated invoice:', err);
        }
      } else {
        prorateNote = `Credit of $${Math.abs(proratedDifference).toFixed(2)} applied for unused ${oldPlan} plan time.`;
      }
    }

    res.json({
      client: updatedClient,
      message: `Plan changed from ${oldPlan} to ${newPlan}`,
      effectiveDate: now.toISOString(),
      prorating: {
        daysRemaining,
        daysInMonth,
        prorateRatio: Math.round(prorateRatio * 100) / 100,
        unusedOldPlanAmount: Math.round(unusedOldPlanAmount * 100) / 100,
        proratedNewPlanAmount: Math.round(proratedNewPlanAmount * 100) / 100,
        difference: Math.round(proratedDifference * 100) / 100,
        note:
          prorateNote ||
          'No prorated charges apply (plans have same base cost or change at month start).',
      },
    });
  } catch (error) {
    console.error('[Admin] Upgrade plan error:', error);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

/**
 * GET /admin/clients/:id/stats
 * Get client statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const clientId = req.params.id;

    const convResult = await db.query('SELECT COUNT(*) FROM conversations WHERE client_id = $1', [
      clientId,
    ]);

    const msgResult = await db.query(
      `SELECT COUNT(*) FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.client_id = $1`,
      [clientId]
    );

    const toolResult = await db.query('SELECT COUNT(*) FROM tool_executions WHERE client_id = $1', [
      clientId,
    ]);

    res.json({
      conversations: parseInt(convResult.rows[0].count, 10),
      messages: parseInt(msgResult.rows[0].count, 10),
      toolExecutions: parseInt(toolResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('[Admin] Get client stats error:', error);
    res.status(500).json({ error: 'Failed to get client stats' });
  }
});

/**
 * GET /admin/clients/:id/invoices
 * Get all invoices for a specific client
 */
router.get('/:id/invoices', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const invoices = await Invoice.findByClientId(req.params.id, parseInt(limit, 10), parseInt(offset, 10));
    res.json(invoices);
  } catch (error) {
    console.error('[Admin] Get client invoices error:', error);
    res.status(500).json({ error: 'Failed to get client invoices' });
  }
});

export default router;
