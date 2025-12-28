import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock('../../../src/models/Client.js', () => ({
  Client: {
    findById: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock('../../../src/models/Invoice.js', () => ({
  Invoice: {
    create: vi.fn(),
    findById: vi.fn(),
    findByClientAndPeriod: vi.fn(),
    delete: vi.fn(),
    markAsPaid: vi.fn(),
    update: vi.fn(),
    getRevenueAnalytics: vi.fn(),
    getRevenueByMonth: vi.fn(),
    getRevenueByPlan: vi.fn(),
    getOutstanding: vi.fn(),
    markOverdueInvoices: vi.fn(),
  },
}));

vi.mock('../../../src/models/Plan.js', () => ({
  Plan: {
    findByName: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { Client } = await import('../../../src/models/Client.js');
const { Invoice } = await import('../../../src/models/Invoice.js');
const { Plan } = await import('../../../src/models/Plan.js');
const { BillingService } = await import('../../../src/services/billingService.js');

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FALLBACK_PRICING', () => {
    it('should have pricing for all plan types', () => {
      expect(BillingService.FALLBACK_PRICING).toHaveProperty('unlimited');
      expect(BillingService.FALLBACK_PRICING).toHaveProperty('free');
      expect(BillingService.FALLBACK_PRICING).toHaveProperty('starter');
      expect(BillingService.FALLBACK_PRICING).toHaveProperty('pro');
      expect(BillingService.FALLBACK_PRICING).toHaveProperty('enterprise');
    });

    it('should have required pricing fields', () => {
      const pricing = BillingService.FALLBACK_PRICING.pro;
      expect(pricing).toHaveProperty('baseCost');
      expect(pricing).toHaveProperty('costPerThousandTokens');
      expect(pricing).toHaveProperty('costPerMessage');
      expect(pricing).toHaveProperty('costPerToolCall');
    });
  });

  describe('getPricingConfig', () => {
    it('should return pricing for known plan type', () => {
      const pricing = BillingService.getPricingConfig('pro');

      expect(pricing).toHaveProperty('baseCost');
      expect(pricing.baseCost).toBe(99.99);
    });

    it('should return free pricing for unknown plan type', () => {
      const pricing = BillingService.getPricingConfig('unknown');

      expect(pricing).toEqual(BillingService.FALLBACK_PRICING.free);
    });
  });

  describe('getPricingConfigAsync', () => {
    it('should fetch pricing from database when available', async () => {
      const mockPlan = {
        name: 'pro',
        pricing: {
          baseCost: 149.99,
          usageMultiplier: 0.01,
          costPerMessage: 0.002,
          costPerToolCall: 0.05,
        },
      };

      Plan.findByName.mockResolvedValueOnce(mockPlan);

      const pricing = await BillingService.getPricingConfigAsync('pro');

      expect(pricing.baseCost).toBe(149.99);
      expect(pricing.costPerThousandTokens).toBe(0.01);
    });

    it('should fallback to hardcoded pricing on database error', async () => {
      Plan.findByName.mockRejectedValueOnce(new Error('Database error'));

      const pricing = await BillingService.getPricingConfigAsync('pro');

      expect(pricing).toEqual(BillingService.FALLBACK_PRICING.pro);
    });

    it('should fallback to hardcoded pricing when plan not found', async () => {
      Plan.findByName.mockResolvedValueOnce(null);

      const pricing = await BillingService.getPricingConfigAsync('pro');

      expect(pricing).toEqual(BillingService.FALLBACK_PRICING.pro);
    });
  });

  describe('calculateUsageCost', () => {
    it('should calculate cost based on usage and plan', () => {
      const usage = {
        total_tokens_input: '50000',
        total_tokens_output: '25000',
        total_messages: '100',
        total_tool_calls: '20',
      };

      const cost = BillingService.calculateUsageCost(usage, 'pro');

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 for free plan', () => {
      const usage = {
        total_tokens_input: '50000',
        total_tokens_output: '25000',
        total_messages: '100',
        total_tool_calls: '20',
      };

      const cost = BillingService.calculateUsageCost(usage, 'free');

      expect(cost).toBe(0);
    });

    it('should handle zero usage', () => {
      const usage = {
        total_tokens_input: '0',
        total_tokens_output: '0',
        total_messages: '0',
        total_tool_calls: '0',
      };

      const cost = BillingService.calculateUsageCost(usage, 'pro');

      expect(cost).toBe(0);
    });

    it('should handle null values in usage', () => {
      const usage = {
        total_tokens_input: null,
        total_tokens_output: null,
        total_messages: null,
        total_tool_calls: null,
      };

      const cost = BillingService.calculateUsageCost(usage, 'pro');

      expect(cost).toBe(0);
    });
  });

  describe('getUsageForPeriod', () => {
    it('should return aggregated usage data', async () => {
      const mockUsage = {
        total_conversations: '100',
        total_messages: '500',
        total_tokens_input: '50000',
        total_tokens_output: '25000',
        total_tool_calls: '50',
        total_cost_estimate: '15.50',
      };

      db.query.mockResolvedValueOnce({ rows: [mockUsage] });

      const usage = await BillingService.getUsageForPeriod(1, '2024-01-01', '2024-01-31');

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, '2024-01-01', '2024-01-31']);
      expect(usage).toEqual(mockUsage);
    });
  });

  describe('generateInvoice', () => {
    it('should generate invoice for client', async () => {
      const mockClient = {
        id: 1,
        name: 'Test Client',
        plan_type: 'pro',
      };

      const mockUsage = {
        total_conversations: '100',
        total_messages: '500',
        total_tokens_input: '50000',
        total_tokens_output: '25000',
        total_tool_calls: '50',
        total_cost_estimate: '15.50',
      };

      const mockInvoice = {
        id: 1,
        client_id: 1,
        total_cost: 115.49,
        status: 'pending',
      };

      Invoice.findByClientAndPeriod.mockResolvedValueOnce(null);
      Client.findById.mockResolvedValueOnce(mockClient);
      db.query.mockResolvedValueOnce({ rows: [mockUsage] });
      Plan.findByName.mockResolvedValueOnce(null); // Use fallback pricing
      Invoice.create.mockResolvedValueOnce(mockInvoice);

      const result = await BillingService.generateInvoice(1, '2024-01');

      expect(Invoice.create).toHaveBeenCalled();
      expect(result).toHaveProperty('invoice');
      expect(result).toHaveProperty('usage');
    });

    it('should throw error if invoice already exists', async () => {
      Invoice.findByClientAndPeriod.mockResolvedValueOnce({ id: 1 });

      await expect(BillingService.generateInvoice(1, '2024-01')).rejects.toThrow('already exists');
    });

    it('should throw error for non-existent client', async () => {
      Invoice.findByClientAndPeriod.mockResolvedValueOnce(null);
      Client.findById.mockResolvedValueOnce(null);

      await expect(BillingService.generateInvoice(999, '2024-01')).rejects.toThrow('not found');
    });

    it('should force regeneration when force=true', async () => {
      const mockClient = { id: 1, name: 'Test', plan_type: 'pro' };
      const mockUsage = {
        total_conversations: '0',
        total_messages: '0',
        total_tokens_input: '0',
        total_tokens_output: '0',
        total_tool_calls: '0',
      };
      const existingInvoice = { id: 1 };
      const newInvoice = { id: 2 };

      Invoice.findByClientAndPeriod.mockResolvedValueOnce(existingInvoice);
      Client.findById.mockResolvedValueOnce(mockClient);
      db.query.mockResolvedValueOnce({ rows: [mockUsage] });
      Plan.findByName.mockResolvedValueOnce(null);
      Invoice.delete.mockResolvedValueOnce({});
      Invoice.create.mockResolvedValueOnce(newInvoice);

      const result = await BillingService.generateInvoice(1, '2024-01', true);

      expect(Invoice.delete).toHaveBeenCalledWith(1);
      expect(result.invoice).toEqual(newInvoice);
    });
  });

  describe('createPaymentIntent', () => {
    it('should return mock payment intent', async () => {
      const intent = await BillingService.createPaymentIntent(1, 100.00, 'USD');

      expect(intent).toHaveProperty('id');
      expect(intent.id).toContain('pi_mock_');
      expect(intent.amount).toBe(100.00);
      expect(intent.currency).toBe('USD');
      expect(intent.provider).toBe('mock');
    });
  });

  describe('processPayment', () => {
    it('should mark invoice as paid', async () => {
      const mockInvoice = { id: 1, status: 'paid' };
      Invoice.markAsPaid.mockResolvedValueOnce(mockInvoice);

      const result = await BillingService.processPayment(1, 'pi_123', 'manual');

      expect(Invoice.markAsPaid).toHaveBeenCalledWith(1, expect.objectContaining({
        payment_provider: 'manual',
      }));
      expect(result.status).toBe('paid');
    });
  });

  describe('markInvoiceAsPaidManually', () => {
    it('should mark pending invoice as paid', async () => {
      Invoice.findById.mockResolvedValueOnce({ id: 1, status: 'pending' });
      Invoice.markAsPaid.mockResolvedValueOnce({ id: 1, status: 'paid' });

      const result = await BillingService.markInvoiceAsPaidManually(1, {
        paymentMethod: 'bank_transfer',
        notes: 'Wire transfer received',
      });

      expect(result.status).toBe('paid');
    });

    it('should throw error for non-existent invoice', async () => {
      Invoice.findById.mockResolvedValueOnce(null);

      await expect(BillingService.markInvoiceAsPaidManually(999)).rejects.toThrow('not found');
    });

    it('should throw error for already paid invoice', async () => {
      Invoice.findById.mockResolvedValueOnce({ id: 1, status: 'paid' });

      await expect(BillingService.markInvoiceAsPaidManually(1)).rejects.toThrow('already paid');
    });
  });

  describe('refundPayment', () => {
    it('should refund paid invoice', async () => {
      Invoice.findById.mockResolvedValueOnce({
        id: 1,
        status: 'paid',
        total_cost: 100.00,
      });
      Invoice.update.mockResolvedValueOnce({ id: 1, status: 'refunded' });

      const result = await BillingService.refundPayment(1);

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(100.00);
    });

    it('should throw error for non-existent invoice', async () => {
      Invoice.findById.mockResolvedValueOnce(null);

      await expect(BillingService.refundPayment(999)).rejects.toThrow('not found');
    });

    it('should throw error for non-paid invoice', async () => {
      Invoice.findById.mockResolvedValueOnce({ id: 1, status: 'pending' });

      await expect(BillingService.refundPayment(1)).rejects.toThrow('only refund paid');
    });
  });

  describe('getOutstandingPayments', () => {
    it('should return outstanding payments summary', async () => {
      const mockOutstanding = [
        { id: 1, status: 'pending', total_cost: '100.00' },
        { id: 2, status: 'overdue', total_cost: '150.00' },
      ];

      Invoice.getOutstanding.mockResolvedValueOnce(mockOutstanding);

      const result = await BillingService.getOutstandingPayments();

      expect(result.total_count).toBe(2);
      expect(result.total_amount).toBe(250);
      expect(result.pending_count).toBe(1);
      expect(result.overdue_count).toBe(1);
    });
  });

  describe('getRevenueSummary', () => {
    it('should return revenue analytics', async () => {
      const mockAnalytics = { total: 5000, paid: 4500, pending: 500 };
      Invoice.getRevenueAnalytics.mockResolvedValueOnce(mockAnalytics);

      const result = await BillingService.getRevenueSummary({});

      expect(Invoice.getRevenueAnalytics).toHaveBeenCalled();
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('getMonthlyRevenue', () => {
    it('should return monthly revenue breakdown', async () => {
      const mockMonthly = [
        { month: '2024-01', revenue: 1000 },
        { month: '2024-02', revenue: 1200 },
      ];
      Invoice.getRevenueByMonth.mockResolvedValueOnce(mockMonthly);

      const result = await BillingService.getMonthlyRevenue(12);

      expect(Invoice.getRevenueByMonth).toHaveBeenCalledWith(12);
      expect(result).toEqual(mockMonthly);
    });
  });

  describe('handleWebhook', () => {
    it('should return placeholder response', async () => {
      const result = await BillingService.handleWebhook('stripe', {});

      expect(result.received).toBe(true);
      expect(result.processed).toBe(false);
    });
  });

  describe('generateInvoicesForAllClients', () => {
    it('should generate invoices for active clients', async () => {
      const mockClients = [
        { id: 1, name: 'Client A', status: 'active', plan_type: 'pro' },
        { id: 2, name: 'Client B', status: 'active', plan_type: 'starter' },
        { id: 3, name: 'Client C', status: 'inactive', plan_type: 'pro' },
      ];

      Client.findAll.mockResolvedValueOnce(mockClients);

      // Mock for first active client
      Invoice.findByClientAndPeriod.mockResolvedValueOnce(null);
      Client.findById.mockResolvedValueOnce(mockClients[0]);
      db.query.mockResolvedValueOnce({ rows: [{}] });
      Plan.findByName.mockResolvedValueOnce(null);
      Invoice.create.mockResolvedValueOnce({ id: 1 });

      // Mock for second active client
      Invoice.findByClientAndPeriod.mockResolvedValueOnce(null);
      Client.findById.mockResolvedValueOnce(mockClients[1]);
      db.query.mockResolvedValueOnce({ rows: [{}] });
      Plan.findByName.mockResolvedValueOnce(null);
      Invoice.create.mockResolvedValueOnce({ id: 2 });

      const results = await BillingService.generateInvoicesForAllClients('2024-01');

      // Only 2 active clients should be processed
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
