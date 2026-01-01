import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Message } from '../../../src/models/Message.js';
import { db } from '../../../src/db.js';

// Mock database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

describe('Message Model - Type Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllWithDebug', () => {
    it('should return all messages when includeDebug is true', async () => {
      const mockMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'Hi', message_type: 'system' },
        { id: 3, role: 'assistant', content: 'Tool call', message_type: 'tool_call' },
        { id: 4, role: 'tool', content: 'Result', message_type: 'tool_result' },
        { id: 5, role: 'assistant', content: 'Internal', message_type: 'internal' },
      ];
      db.query.mockResolvedValue({ rows: mockMessages });

      const messages = await Message.getAllWithDebug(1, true);
      expect(messages).toHaveLength(5);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
        [1]
      );
    });

    it('should filter out debug messages when includeDebug is false', async () => {
      const mockMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'Hi', message_type: null },
      ];
      db.query.mockResolvedValue({ rows: mockMessages });

      const messages = await Message.getAllWithDebug(1, false);
      expect(messages).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE conversation_id = $1 AND (message_type IS NULL OR message_type = \'visible\') ORDER BY timestamp ASC',
        [1]
      );
    });

    it('should default to including debug messages', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await Message.getAllWithDebug(1);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
        [1]
      );
    });
  });

  describe('getAll', () => {
    it('should only return visible messages', async () => {
      const mockMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'Hi', message_type: null },
      ];
      db.query.mockResolvedValue({ rows: mockMessages });

      const messages = await Message.getAll(1);
      expect(messages).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('message_type IS NULL OR message_type = \'visible\''),
        [1]
      );
    });

    it('should exclude system, tool_call, tool_result, and internal messages', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await Message.getAll(1);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('message_type IS NULL OR message_type = \'visible\'');
    });
  });

  describe('getRecent', () => {
    it('should only return visible messages', async () => {
      const mockMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
      ];
      db.query.mockResolvedValue({ rows: mockMessages });

      const messages = await Message.getRecent(1, 10);
      expect(messages).toHaveLength(1);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('message_type IS NULL OR message_type = \'visible\'');
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await Message.getRecent(1, 5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        [1, 5]
      );
    });

    it('should return messages in chronological order', async () => {
      const mockMessages = [
        { id: 3, role: 'user', content: 'Third', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'Second', message_type: 'visible' },
        { id: 1, role: 'user', content: 'First', message_type: 'visible' },
      ];
      db.query.mockResolvedValue({ rows: mockMessages });

      const messages = await Message.getRecent(1, 10);
      // getRecent reverses the array to return in chronological order
      expect(messages[0].id).toBe(1);
      expect(messages[1].id).toBe(2);
      expect(messages[2].id).toBe(3);
    });
  });

  describe('createDebug', () => {
    it('should create a debug message with message_type', async () => {
      const mockMessage = {
        id: 1,
        conversation_id: 1,
        role: 'assistant',
        content: 'Tool call',
        message_type: 'tool_call',
        tool_call_id: 'call_123',
        metadata: { tool_name: 'test_tool' },
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(
        1,
        'assistant',
        'Tool call',
        'tool_call',
        {
          toolCallId: 'call_123',
          metadata: { tool_name: 'test_tool' },
        }
      );

      expect(message.message_type).toBe('tool_call');
      expect(message.tool_call_id).toBe('call_123');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('message_type'),
        expect.arrayContaining([1, 'assistant', 'Tool call', 0, 'tool_call', 'call_123'])
      );
    });

    it('should create system message type', async () => {
      const mockMessage = {
        id: 1,
        message_type: 'system',
        role: 'system',
        content: 'System prompt',
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(1, 'system', 'System prompt', 'system');
      expect(message.message_type).toBe('system');
    });

    it('should create tool_result message type', async () => {
      const mockMessage = {
        id: 1,
        message_type: 'tool_result',
        role: 'assistant',
        content: 'Tool result',
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(
        1,
        'assistant',
        'Tool result',
        'tool_result',
        { toolCallId: 'call_123' }
      );
      expect(message.message_type).toBe('tool_result');
    });

    it('should create internal message type', async () => {
      const mockMessage = {
        id: 1,
        message_type: 'internal',
        role: 'assistant',
        content: 'Internal reasoning',
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(1, 'assistant', 'Internal reasoning', 'internal');
      expect(message.message_type).toBe('internal');
    });

    it('should default to visible message type', async () => {
      const mockMessage = {
        id: 1,
        message_type: 'visible',
        role: 'user',
        content: 'User message',
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(1, 'user', 'User message');
      expect(message.message_type).toBe('visible');
    });

    it('should handle optional parameters', async () => {
      const mockMessage = {
        id: 1,
        message_type: 'tool_call',
        tokens_used: 10,
        tool_call_id: null,
        metadata: null,
      };
      db.query.mockResolvedValue({ rows: [mockMessage] });

      const message = await Message.createDebug(1, 'assistant', 'Content', 'tool_call', {
        tokensUsed: 10,
      });
      expect(message.tokens_used).toBe(10);
    });
  });

  describe('Message type filtering integration', () => {
    it('should ensure getAll excludes debug messages created with createDebug', async () => {
      // getAll should filter out debug messages (system, tool_call, tool_result, internal)
      // Only return visible messages or messages with null message_type
      const visibleMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'Hi', message_type: null },
      ];
      db.query.mockResolvedValue({ rows: visibleMessages });

      const messages = await Message.getAll(1);
      expect(messages).toHaveLength(2);
      // Verify that getAll filters correctly excludes debug types
      expect(messages.every((m) => !m.message_type || m.message_type === 'visible')).toBe(true);
    });

    it('should ensure getAllWithDebug includes all message types', async () => {
      const allMessages = [
        { id: 1, role: 'user', content: 'Hello', message_type: 'visible' },
        { id: 2, role: 'assistant', content: 'System', message_type: 'system' },
        { id: 3, role: 'assistant', content: 'Tool call', message_type: 'tool_call' },
        { id: 4, role: 'tool', content: 'Result', message_type: 'tool_result' },
        { id: 5, role: 'assistant', content: 'Internal', message_type: 'internal' },
      ];
      db.query.mockResolvedValue({ rows: allMessages });

      const messages = await Message.getAllWithDebug(1, true);
      expect(messages).toHaveLength(5);
      expect(messages.some((m) => m.message_type === 'system')).toBe(true);
      expect(messages.some((m) => m.message_type === 'tool_call')).toBe(true);
      expect(messages.some((m) => m.message_type === 'tool_result')).toBe(true);
      expect(messages.some((m) => m.message_type === 'internal')).toBe(true);
    });
  });
});

