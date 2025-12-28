import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { Escalation } = await import('../../../src/models/Escalation.js');

describe('Escalation Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create an escalation with required fields', async () => {
      const mockEscalation = {
        id: 1,
        conversation_id: 10,
        client_id: 5,
        reason: 'user_requested',
        status: 'pending',
        escalated_at: new Date(),
      };

      db.query.mockResolvedValueOnce({ rows: [mockEscalation] });

      const result = await Escalation.create(10, 5, 'user_requested');

      expect(db.query).toHaveBeenCalledOnce();
      expect(result).toEqual(mockEscalation);
    });

    it('should create an escalation with optional fields', async () => {
      const mockEscalation = {
        id: 1,
        conversation_id: 10,
        client_id: 5,
        reason: 'ai_stuck',
        trigger_message_id: 100,
        assigned_to: 'John',
        notes: 'Test notes',
        status: 'pending',
      };

      db.query.mockResolvedValueOnce({ rows: [mockEscalation] });

      const result = await Escalation.create(10, 5, 'ai_stuck', 100, {
        assigned_to: 'John',
        notes: 'Test notes',
      });

      expect(result.assigned_to).toBe('John');
      expect(result.notes).toBe('Test notes');
    });
  });

  describe('findById', () => {
    it('should return escalation when found', async () => {
      const mockEscalation = { id: 1, reason: 'user_requested' };
      db.query.mockResolvedValueOnce({ rows: [mockEscalation] });

      const result = await Escalation.findById(1);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM escalations WHERE id = $1',
        [1]
      );
      expect(result).toEqual(mockEscalation);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Escalation.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByConversation', () => {
    it('should return the most recent escalation for a conversation', async () => {
      const mockEscalation = { id: 2, conversation_id: 10 };
      db.query.mockResolvedValueOnce({ rows: [mockEscalation] });

      const result = await Escalation.findByConversation(10);

      expect(result).toEqual(mockEscalation);
    });
  });

  describe('getByClient', () => {
    it('should return all escalations for a client', async () => {
      const mockEscalations = [
        { id: 1, client_id: 5 },
        { id: 2, client_id: 5 },
      ];
      db.query.mockResolvedValueOnce({ rows: mockEscalations });

      const result = await Escalation.getByClient(5);

      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      const mockEscalations = [{ id: 1, status: 'pending' }];
      db.query.mockResolvedValueOnce({ rows: mockEscalations });

      const result = await Escalation.getByClient(5, { status: 'pending' });

      expect(result).toHaveLength(1);
      // Verify the query includes status filter
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('e.status = $');
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Escalation.getByClient(5, { limit: 10, offset: 5 });

      const params = db.query.mock.calls[0][1];
      expect(params).toContain(10);
      expect(params).toContain(5);
    });
  });

  describe('updateStatus', () => {
    it('should update status to acknowledged with timestamp', async () => {
      const mockUpdated = {
        id: 1,
        status: 'acknowledged',
        acknowledged_at: new Date(),
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Escalation.updateStatus(1, 'acknowledged');

      expect(result.status).toBe('acknowledged');
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('acknowledged_at = NOW()');
    });

    it('should update status to resolved with timestamp', async () => {
      const mockUpdated = {
        id: 1,
        status: 'resolved',
        resolved_at: new Date(),
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Escalation.updateStatus(1, 'resolved');

      expect(result.status).toBe('resolved');
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('resolved_at = NOW()');
    });

    it('should include notes when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, notes: 'Resolution notes' }] });

      await Escalation.updateStatus(1, 'resolved', { notes: 'Resolution notes' });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('notes = $');
    });
  });

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      const mockStats = {
        total_escalations: '10',
        pending_count: '3',
        acknowledged_count: '2',
        resolved_count: '5',
        user_requested_count: '4',
        ai_stuck_count: '3',
        low_confidence_count: '3',
        avg_resolution_time_seconds: '3600',
      };
      db.query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await Escalation.getStats(5);

      expect(result.total_escalations).toBe('10');
      expect(result.pending_count).toBe('3');
    });
  });

  describe('hasActiveEscalation', () => {
    it('should return true when active escalation exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await Escalation.hasActiveEscalation(10);

      expect(result).toBe(true);
    });

    it('should return false when no active escalation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Escalation.hasActiveEscalation(10);

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete and return the escalation', async () => {
      const mockDeleted = { id: 1, reason: 'user_requested' };
      db.query.mockResolvedValueOnce({ rows: [mockDeleted] });

      const result = await Escalation.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM escalations WHERE id = $1 RETURNING *',
        [1]
      );
      expect(result).toEqual(mockDeleted);
    });
  });
});
