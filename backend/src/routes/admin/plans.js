import express from 'express';
import { HTTP_STATUS } from '../../config/constants.js';
import { Plan } from '../../models/Plan.js';
import { clearPlanCache } from '../../config/planLimits.js';

const router = express.Router();

/**
 * GET /admin/plans
 * Get all plans
 */
router.get('/', async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const plans = await Plan.findAll(activeOnly === 'true');

    // Add client count to each plan
    const plansWithCount = await Promise.all(
      plans.map(async (plan) => ({
        ...plan,
        clients_count: await Plan.getClientsCount(plan.id),
      }))
    );

    res.json(plansWithCount);
  } catch (error) {
    console.error('[Admin] Get plans error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get plans' });
  }
});

/**
 * GET /admin/plans/:id
 * Get a specific plan by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Plan not found' });
    }

    plan.clients_count = await Plan.getClientsCount(plan.id);
    res.json(plan);
  } catch (error) {
    console.error('[Admin] Get plan error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get plan' });
  }
});

/**
 * POST /admin/plans
 * Create a new plan
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      conversationsPerMonth,
      messagesPerMonth,
      tokensPerMonth,
      toolCallsPerMonth,
      integrationsEnabled,
      costLimitUsd,
      features,
      baseCost,
      usageMultiplier,
      isDefault,
      isActive,
      sortOrder,
    } = req.body;

    if (!name || !displayName) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Name and display name are required' });
    }

    // Check if plan name already exists
    const existing = await Plan.findByName(name);
    if (existing) {
      return res.status(HTTP_STATUS.CONFLICT).json({ error: 'A plan with this name already exists' });
    }

    const plan = await Plan.create({
      name,
      displayName,
      description,
      conversationsPerMonth,
      messagesPerMonth,
      tokensPerMonth,
      toolCallsPerMonth,
      integrationsEnabled,
      costLimitUsd,
      features,
      baseCost,
      usageMultiplier,
      isDefault,
      isActive,
      sortOrder,
    });

    // Clear the plan cache so changes take effect immediately
    clearPlanCache();

    res.status(HTTP_STATUS.CREATED).json(plan);
  } catch (error) {
    console.error('[Admin] Create plan error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to create plan' });
  }
});

/**
 * PUT /admin/plans/:id
 * Update a plan
 */
router.put('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Plan not found' });
    }

    // If changing name, check it doesn't conflict
    if (req.body.name && req.body.name.toLowerCase() !== plan.name.toLowerCase()) {
      const existing = await Plan.findByName(req.body.name);
      if (existing) {
        return res.status(HTTP_STATUS.CONFLICT).json({ error: 'A plan with this name already exists' });
      }
    }

    const updatedPlan = await Plan.update(req.params.id, req.body);

    // Clear the plan cache so changes take effect immediately
    clearPlanCache();

    res.json(updatedPlan);
  } catch (error) {
    console.error('[Admin] Update plan error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to update plan' });
  }
});

/**
 * DELETE /admin/plans/:id
 * Delete a plan
 */
router.delete('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Plan not found' });
    }

    // Prevent deleting default plan
    if (plan.is_default) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Cannot delete the default plan' });
    }

    await Plan.delete(req.params.id);

    // Clear the plan cache
    clearPlanCache();

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('[Admin] Delete plan error:', error);
    if (error.message.includes('clients are currently using')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: error.message });
    }
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to delete plan' });
  }
});

/**
 * POST /admin/plans/:id/set-default
 * Set a plan as the default
 */
router.post('/:id/set-default', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Plan not found' });
    }

    const updatedPlan = await Plan.update(req.params.id, { isDefault: true });

    // Clear the plan cache
    clearPlanCache();

    res.json(updatedPlan);
  } catch (error) {
    console.error('[Admin] Set default plan error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to set default plan' });
  }
});

/**
 * POST /admin/plans/refresh-cache
 * Force refresh the plan cache
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    clearPlanCache();
    res.json({ message: 'Plan cache cleared successfully' });
  } catch (error) {
    console.error('[Admin] Refresh cache error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to refresh cache' });
  }
});

export default router;
