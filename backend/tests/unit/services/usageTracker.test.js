import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { UsageTracker } = await import('../../../src/services/usageTracker.js');

describe('UsageTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDateFilter', () => {
    it('should return correct filter for day', () => {
      const filter = UsageTracker.getDateFilter('day');
      expect(filter).toBe('CURRENT_DATE');
    });

    it('should return correct filter for week', () => {
      const filter = UsageTracker.getDateFilter('week');
      expect(filter).toContain('7 days');
    });

    it('should return correct filter for month', () => {
      const filter = UsageTracker.getDateFilter('month');
      expect(filter).toContain('month');
    });

    it('should default to month for unknown period', () => {
      const filter = UsageTracker.getDateFilter('unknown');
      expect(filter).toContain('month');
    });
  });

  describe('getCurrentUsage', () => {
    it('should return usage for messages metric', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: '500' }] });

      const result = await UsageTracker.getCurrentUsage(5, 'messages', 'month');

      expect(db.query).toHaveBeenCalled();
      expect(result).toBe(500);
    });

    it('should return usage for tokens metric', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: '75000' }] });

      const result = await UsageTracker.getCurrentUsage(5, 'tokens', 'month');

      expect(result).toBe(75000);
    });

    it('should return 0 for null result', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: null }] });

      const result = await UsageTracker.getCurrentUsage(5, 'messages', 'month');

      expect(result).toBe(0);
    });
  });

  describe('getUsageHistory', () => {
    it('should return usage history array', async () => {
      const mockHistory = [
        { period: '2024-01', value: '1000' },
        { period: '2024-02', value: '1500' },
      ];

      db.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await UsageTracker.getUsageHistory(5, 'messages', 12);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('period');
      expect(result[0]).toHaveProperty('value');
    });

    it('should parse values as floats', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ period: '2024-01', value: '1234.56' }],
      });

      const result = await UsageTracker.getUsageHistory(5, 'cost', 6);

      expect(result[0].value).toBe(1234.56);
    });
  });

  describe('getUsageSummary', () => {
    it('should return comprehensive usage summary', async () => {
      const mockSummary = {
        conversations: '100',
        messages: '500',
        tokens_input: '25000',
        tokens_output: '12500',
        tokens_total: '37500',
        tool_calls: '50',
        cost: '15.50',
        active_days: '20',
      };

      db.query.mockResolvedValueOnce({ rows: [mockSummary] });

      const result = await UsageTracker.getUsageSummary(5, 'month');

      expect(result.conversations).toBe(100);
      expect(result.messages).toBe(500);
      expect(result.tokens.input).toBe(25000);
      expect(result.tokens.output).toBe(12500);
      expect(result.tokens.total).toBe(37500);
      expect(result.toolCalls).toBe(50);
      expect(result.cost).toBe(15.5);
      expect(result.activeDays).toBe(20);
      expect(result.period).toBe('month');
    });

    it('should return zeros for empty usage', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            conversations: null,
            messages: null,
            tokens_input: null,
            tokens_output: null,
            tokens_total: null,
            tool_calls: null,
            cost: null,
            active_days: null,
          },
        ],
      });

      const result = await UsageTracker.getUsageSummary(999, 'month');

      expect(result.conversations).toBe(0);
      expect(result.messages).toBe(0);
      expect(result.tokens.total).toBe(0);
    });
  });

  describe('getToolUsageBreakdown', () => {
    it('should return tool usage statistics', async () => {
      const mockToolStats = [
        { tool_name: 'get_order_status', count: '50', avg_time: '250.5', success_rate: '96.0' },
        { tool_name: 'book_appointment', count: '30', avg_time: '500.3', success_rate: '93.3' },
      ];

      db.query.mockResolvedValueOnce({ rows: mockToolStats });

      const result = await UsageTracker.getToolUsageBreakdown(5, 'month');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('toolName', 'get_order_status');
      expect(result[0]).toHaveProperty('count', 50);
      expect(result[0]).toHaveProperty('avgTime');
      expect(result[0]).toHaveProperty('successRate');
    });
  });

  describe('compareUsage', () => {
    it('should compare usage between periods', async () => {
      // First call for current period
      db.query.mockResolvedValueOnce({ rows: [{ value: '1000' }] });
      // Second call for previous period
      db.query.mockResolvedValueOnce({ rows: [{ value: '800' }] });

      const result = await UsageTracker.compareUsage(5, 'messages', 'month', 'last_month');

      expect(result.current).toBe(1000);
      expect(result.previous).toBe(800);
      expect(result.change).toBe(200);
      expect(result.trend).toBe('up');
    });

    it('should detect downward trend', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: '500' }] });
      db.query.mockResolvedValueOnce({ rows: [{ value: '800' }] });

      const result = await UsageTracker.compareUsage(5, 'messages', 'month', 'last_month');

      expect(result.trend).toBe('down');
    });

    it('should detect stable trend', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: '500' }] });
      db.query.mockResolvedValueOnce({ rows: [{ value: '500' }] });

      const result = await UsageTracker.compareUsage(5, 'messages', 'month', 'last_month');

      expect(result.trend).toBe('stable');
      expect(result.change).toBe(0);
    });

    it('should handle zero previous value', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ value: '100' }] });
      db.query.mockResolvedValueOnce({ rows: [{ value: '0' }] });

      const result = await UsageTracker.compareUsage(5, 'messages', 'month', 'last_month');

      expect(result.percentChange).toBe(100);
    });
  });

  describe('getDailyUsage', () => {
    it('should return daily usage breakdown', async () => {
      const mockDaily = [
        {
          date: new Date('2024-01-15'),
          conversations: '10',
          messages: '50',
          tokens: '5000',
          tool_calls: '5',
          cost: '1.50',
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockDaily });

      const result = await UsageTracker.getDailyUsage(5);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('date', '2024-01-15');
      expect(result[0]).toHaveProperty('conversations', 10);
      expect(result[0]).toHaveProperty('messages', 50);
    });
  });

  describe('getUsageAlerts', () => {
    it('should return no alerts when under limits', async () => {
      const mockSummary = {
        conversations: '50',
        messages: '200',
        tokens_input: '10000',
        tokens_output: '5000',
        tokens_total: '15000',
        tool_calls: '10',
        cost: '5.00',
        active_days: '10',
      };

      db.query.mockResolvedValueOnce({ rows: [mockSummary] });

      const limits = {
        conversationsPerMonth: 1000,
        messagesPerMonth: 5000,
        tokensPerMonth: 100000,
      };

      const alerts = await UsageTracker.getUsageAlerts(5, limits);

      expect(alerts).toHaveLength(0);
    });

    it('should return warning when approaching limit', async () => {
      const mockSummary = {
        conversations: '850',
        messages: '200',
        tokens_input: '10000',
        tokens_output: '5000',
        tokens_total: '15000',
        tool_calls: '10',
        cost: '5.00',
        active_days: '10',
      };

      db.query.mockResolvedValueOnce({ rows: [mockSummary] });

      const limits = {
        conversationsPerMonth: 1000,
      };

      const alerts = await UsageTracker.getUsageAlerts(5, limits, 0.8);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].level).toBe('warning');
    });

    it('should return critical when over limit', async () => {
      const mockSummary = {
        conversations: '1100',
        messages: '200',
        tokens_input: '10000',
        tokens_output: '5000',
        tokens_total: '15000',
        tool_calls: '10',
        cost: '5.00',
        active_days: '10',
      };

      db.query.mockResolvedValueOnce({ rows: [mockSummary] });

      const limits = {
        conversationsPerMonth: 1000,
      };

      const alerts = await UsageTracker.getUsageAlerts(5, limits);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].level).toBe('critical');
    });

    it('should skip null limits (unlimited)', async () => {
      const mockSummary = {
        conversations: '10000',
        messages: '50000',
        tokens_input: '1000000',
        tokens_output: '500000',
        tokens_total: '1500000',
        tool_calls: '1000',
        cost: '500.00',
        active_days: '30',
      };

      db.query.mockResolvedValueOnce({ rows: [mockSummary] });

      const limits = {
        conversationsPerMonth: null,
        messagesPerMonth: null,
      };

      const alerts = await UsageTracker.getUsageAlerts(5, limits);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('getTopClients', () => {
    it('should return top clients by metric', async () => {
      const mockClients = [
        { id: 1, name: 'Client A', domain: 'a.com', plan_type: 'pro', value: '150.00' },
        { id: 2, name: 'Client B', domain: 'b.com', plan_type: 'starter', value: '75.00' },
      ];

      db.query.mockResolvedValueOnce({ rows: mockClients });

      const result = await UsageTracker.getTopClients('cost', 10, 'month');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('clientId', 1);
      expect(result[0]).toHaveProperty('clientName', 'Client A');
      expect(result[0]).toHaveProperty('value', 150);
    });
  });

  describe('exportUsageCSV', () => {
    it('should return CSV formatted data', async () => {
      const mockData = [
        {
          date: new Date('2024-01-15'),
          conversation_count: 10,
          message_count: 50,
          tokens_input: 5000,
          tokens_output: 2500,
          tool_calls_count: 5,
          cost_estimate: 1.5,
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockData });

      const csv = await UsageTracker.exportUsageCSV(5, '2024-01-01', '2024-01-31');

      expect(csv).toContain('Date,Conversations,Messages');
      expect(csv).toContain('2024-01-15');
    });
  });
});
