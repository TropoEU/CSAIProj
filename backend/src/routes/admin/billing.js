import express from 'express';
import { Invoice } from '../../models/Invoice.js';
import { Client } from '../../models/Client.js';
import { BillingService } from '../../services/billingService.js';
import { HTTP_STATUS } from '../../config/constants.js';

const router = express.Router();

/**
 * GET /admin/clients/:id/invoices
 * Get all invoices for a specific client
 */
router.get('/clients/:id/invoices', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const invoices = await Invoice.findByClientId(
      req.params.id,
      parseInt(limit, 10),
      parseInt(offset, 10)
    );
    res.json(invoices);
  } catch (error) {
    console.error('[Admin] Get client invoices error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get client invoices' });
  }
});

/**
 * GET /admin/billing/invoices
 * Get all invoices with optional filters
 */
router.get('/invoices', async (req, res) => {
  try {
    const { status, clientId, billingPeriod, limit = 100, offset = 0 } = req.query;

    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (clientId && clientId !== 'all') filters.clientId = parseInt(clientId, 10);
    if (billingPeriod) filters.billingPeriod = billingPeriod;

    const invoices = await Invoice.findAll(filters, parseInt(limit, 10), parseInt(offset, 10));
    res.json(invoices);
  } catch (error) {
    console.error('[Admin] Get invoices error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get invoices' });
  }
});

/**
 * GET /admin/billing/invoices/:id
 * Get invoice details by ID
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Invoice not found' });
    }

    const client = await Client.findById(invoice.client_id);
    invoice.client_name = client?.name;
    invoice.client_domain = client?.domain;

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Get invoice error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get invoice' });
  }
});

/**
 * POST /admin/billing/generate
 * Generate invoice(s) for a billing period
 */
router.post('/generate', async (req, res) => {
  try {
    const { clientId, billingPeriod, force = false } = req.body;

    if (!billingPeriod) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: 'Billing period is required (YYYY-MM format)' });
    }

    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: 'Invalid billing period format. Use YYYY-MM' });
    }

    if (clientId) {
      const result = await BillingService.generateInvoice(clientId, billingPeriod, force);
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      const results = await BillingService.generateInvoicesForAllClients(billingPeriod);
      res.status(HTTP_STATUS.CREATED).json({
        message: 'Invoice generation completed',
        results,
      });
    }
  } catch (error) {
    console.error('[Admin] Generate invoice error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to generate invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/mark-paid
 * Mark invoice as paid manually
 */
router.post('/invoices/:id/mark-paid', async (req, res) => {
  try {
    const { paymentMethod, notes } = req.body;

    const invoice = await BillingService.markInvoiceAsPaidManually(req.params.id, {
      paymentMethod: paymentMethod || 'manual',
      notes: notes || 'Marked as paid manually via admin dashboard',
    });

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Mark invoice as paid error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to mark invoice as paid', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/cancel
 * Cancel an invoice
 */
router.post('/invoices/:id/cancel', async (req, res) => {
  try {
    const { notes } = req.body;
    const invoice = await Invoice.cancel(req.params.id, notes);

    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('[Admin] Cancel invoice error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to cancel invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/invoices/:id/charge
 * Charge invoice via payment provider (placeholder)
 */
router.post('/invoices/:id/charge', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invoice is already paid' });
    }

    const paymentIntent = await BillingService.createPaymentIntent(
      invoice.id,
      invoice.total_cost,
      'USD'
    );

    res.json({
      message: 'Payment intent created (placeholder)',
      paymentIntent,
      note: 'Payment provider integration not yet implemented. Use mark-paid for manual payments.',
    });
  } catch (error) {
    console.error('[Admin] Charge invoice error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to charge invoice', message: error.message });
  }
});

/**
 * POST /admin/billing/webhook
 * Handle webhook from payment providers (placeholder)
 */
router.post('/webhook', async (req, res) => {
  try {
    const { provider = 'stripe' } = req.query;
    const result = await BillingService.handleWebhook(provider, req.body);
    res.json(result);
  } catch (error) {
    console.error('[Admin] Billing webhook error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Webhook processing failed', message: error.message });
  }
});

/**
 * GET /admin/billing/revenue
 * Get revenue analytics and summary
 */
router.get('/revenue', async (req, res) => {
  try {
    const { startDate, endDate, status, months = 12 } = req.query;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status && status !== 'all') filters.status = status;

    const [summary, monthlyRevenue, revenueByPlan, outstanding] = await Promise.all([
      BillingService.getRevenueSummary(filters),
      BillingService.getMonthlyRevenue(parseInt(months, 10)),
      BillingService.getRevenueByPlan(),
      BillingService.getOutstandingPayments(),
    ]);

    res.json({
      summary,
      monthlyRevenue,
      revenueByPlan,
      outstanding,
    });
  } catch (error) {
    console.error('[Admin] Get revenue analytics error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to get revenue analytics' });
  }
});

/**
 * GET /admin/billing/outstanding
 * Get outstanding invoices (pending or overdue)
 */
router.get('/outstanding', async (req, res) => {
  try {
    const outstanding = await BillingService.getOutstandingPayments();
    res.json(outstanding);
  } catch (error) {
    console.error('[Admin] Get outstanding invoices error:', error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to get outstanding invoices' });
  }
});

export default router;
