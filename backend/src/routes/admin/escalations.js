import express from 'express';
import { Escalation } from '../../models/Escalation.js';
import { Conversation } from '../../models/Conversation.js';
import escalationService from '../../services/escalationService.js';
import { db } from '../../db.js';

const router = express.Router();

/**
 * GET /admin/escalations
 * Get all escalations (with optional filtering)
 */
router.get('/', async (req, res) => {
  try {
    const { status, client_id, limit = 50, offset = 0 } = req.query;

    let escalations;
    if (client_id) {
      escalations = await Escalation.getByClient(parseInt(client_id, 10), {
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
    } else if (status === 'pending') {
      escalations = await Escalation.getPending(parseInt(limit, 10), parseInt(offset, 10));
    } else {
      // Get all escalations across clients
      const query = `
        SELECT
          e.*,
          c.session_id,
          cl.name as client_name
        FROM escalations e
        JOIN conversations c ON e.conversation_id = c.id
        JOIN clients cl ON e.client_id = cl.id
        ${status ? 'WHERE e.status = $1' : ''}
        ORDER BY e.escalated_at DESC
        LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}
      `;
      const params = status ? [status, limit, offset] : [limit, offset];
      const result = await db.query(query, params);
      escalations = result.rows;
    }

    res.json(escalations);
  } catch (error) {
    console.error('[Admin] Get escalations error:', error);
    res.status(500).json({ error: 'Failed to get escalations' });
  }
});

/**
 * GET /admin/escalations/stats/global
 * Get global escalation statistics
 * NOTE: This must come BEFORE /:id to avoid route matching issues
 */
router.get('/stats/global', async (req, res) => {
  try {
    const stats = await escalationService.getGlobalStats();
    res.json(stats);
  } catch (error) {
    console.error('[Admin] Get escalation stats error:', error);
    res.status(500).json({ error: 'Failed to get escalation stats' });
  }
});

/**
 * GET /admin/escalations/:id
 * Get escalation details
 */
router.get('/:id', async (req, res) => {
  try {
    const escalation = await Escalation.findById(req.params.id);
    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }
    res.json(escalation);
  } catch (error) {
    console.error('[Admin] Get escalation error:', error);
    res.status(500).json({ error: 'Failed to get escalation' });
  }
});

/**
 * PUT /admin/escalations/:id/status
 * Update escalation status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes, assigned_to } = req.body;

    if (!status || !['acknowledged', 'resolved', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const escalation = await Escalation.updateStatus(req.params.id, status, {
      notes,
      assigned_to,
    });

    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    // Update conversation status if resolved/cancelled
    if (status === 'resolved' || status === 'cancelled') {
      await Conversation.updateStatus(escalation.conversation_id, 'active');
    }

    res.json(escalation);
  } catch (error) {
    console.error('[Admin] Update escalation status error:', error);
    res.status(500).json({ error: 'Failed to update escalation status' });
  }
});

/**
 * POST /admin/escalations/:id/resolve
 * Resolve an escalation
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { notes } = req.body;
    const escalation = await escalationService.resolve(req.params.id, notes);

    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(escalation);
  } catch (error) {
    console.error('[Admin] Resolve escalation error:', error);
    res.status(500).json({ error: 'Failed to resolve escalation' });
  }
});

/**
 * POST /admin/escalations/:id/cancel
 * Cancel an escalation
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const escalation = await escalationService.cancel(req.params.id);

    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(escalation);
  } catch (error) {
    console.error('[Admin] Cancel escalation error:', error);
    res.status(500).json({ error: 'Failed to cancel escalation' });
  }
});

/**
 * GET /admin/clients/:clientId/escalations/stats
 * Get escalation statistics for a specific client
 */
router.get('/clients/:clientId/escalations/stats', async (req, res) => {
  try {
    const stats = await Escalation.getStats(req.params.clientId);
    res.json(stats);
  } catch (error) {
    console.error('[Admin] Get client escalation stats error:', error);
    res.status(500).json({ error: 'Failed to get client escalation stats' });
  }
});

export default router;
