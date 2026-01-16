import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../../src/models/Conversation.js', () => ({
  Conversation: {
    create: vi.fn(),
    findById: vi.fn(),
    findBySession: vi.fn(),
    findByClientId: vi.fn(),
    findByUserIdentifier: vi.fn(),
    findInactive: vi.fn(),
    end: vi.fn(),
    updateStats: vi.fn(),
  },
}));

vi.mock('../../../src/models/Message.js', () => ({
  Message: {
    create: vi.fn(),
    createDebug: vi.fn(),
    findByConversationId: vi.fn(),
    getRecent: vi.fn(),
    getAll: vi.fn(),
    count: vi.fn(),
    getTotalTokens: vi.fn(),
  },
}));

vi.mock('../../../src/models/Plan.js', () => ({
  Plan: {
    findByName: vi.fn(),
  },
}));

vi.mock('../../../src/models/ApiUsage.js', () => ({
  ApiUsage: {
    recordUsage: vi.fn(),
  },
}));

vi.mock('../../../src/services/redisCache.js', () => ({
  RedisCache: {
    getConversationContext: vi.fn(),
    setConversationContext: vi.fn(),
    updateConversationContext: vi.fn(),
    deleteConversationContext: vi.fn(),
  },
}));

vi.mock('../../../src/services/toolManager.js', () => ({
  default: {
    getClientTools: vi.fn(),
  },
}));

vi.mock('../../../src/services/adaptiveReasoningService.js', () => ({
  default: {
    processAdaptiveMessage: vi.fn(),
  },
}));

vi.mock('../../../src/services/standardReasoningService.js', () => ({
  default: {
    processStandardMessage: vi.fn(),
    recordUsageAndFinalize: vi.fn(),
  },
}));

vi.mock('../../../src/prompts/systemPrompt.js', () => ({
  getContextualSystemPrompt: vi.fn().mockReturnValue('System prompt'),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { Conversation } = await import('../../../src/models/Conversation.js');
const { Message } = await import('../../../src/models/Message.js');
const { Plan } = await import('../../../src/models/Plan.js');
const { RedisCache } = await import('../../../src/services/redisCache.js');
const toolManager = (await import('../../../src/services/toolManager.js')).default;
const adaptiveReasoningService = (await import('../../../src/services/adaptiveReasoningService.js')).default;
const standardReasoningService = (await import('../../../src/services/standardReasoningService.js')).default;
const conversationService = (await import('../../../src/services/conversationService.js')).default;

describe('ConversationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockConversation = { id: 1, client_id: 1, session_id: 'session-1' };
      Conversation.create.mockResolvedValueOnce(mockConversation);

      const result = await conversationService.createConversation(1, 'session-1', 'user@test.com');

      expect(Conversation.create).toHaveBeenCalledWith(1, 'session-1', 'user@test.com', null, null);
      expect(result).toEqual(mockConversation);
    });

    it('should pass LLM provider and model', async () => {
      const mockConversation = { id: 1 };
      Conversation.create.mockResolvedValueOnce(mockConversation);

      await conversationService.createConversation(1, 'session-1', null, 'groq', 'llama-3');

      expect(Conversation.create).toHaveBeenCalledWith(1, 'session-1', null, 'groq', 'llama-3');
    });
  });

  describe('getOrCreateConversation', () => {
    it('should return existing conversation', async () => {
      const mockConversation = { id: 1, session_id: 'session-1', ended_at: null };
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);

      const result = await conversationService.getOrCreateConversation(1, 'session-1');

      expect(result).toEqual(mockConversation);
      expect(Conversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if session ended', async () => {
      const endedConversation = { id: 1, ended_at: new Date() };
      const newConversation = { id: 2 };
      Conversation.findBySession.mockResolvedValueOnce(endedConversation);
      Conversation.create.mockResolvedValueOnce(newConversation);

      const result = await conversationService.getOrCreateConversation(1, 'session-1');

      expect(result).toEqual(newConversation);
      expect(Conversation.create).toHaveBeenCalled();
    });

    it('should create new conversation if none exists', async () => {
      const newConversation = { id: 1 };
      Conversation.findBySession.mockResolvedValueOnce(null);
      Conversation.create.mockResolvedValueOnce(newConversation);

      const result = await conversationService.getOrCreateConversation(1, 'session-1');

      expect(result).toEqual(newConversation);
    });
  });

  describe('getConversationById', () => {
    it('should return conversation with messages', async () => {
      const mockConversation = { id: 1 };
      const mockMessages = [{ id: 1, content: 'Hello' }];
      Conversation.findById.mockResolvedValueOnce(mockConversation);
      Message.findByConversationId.mockResolvedValueOnce(mockMessages);

      const result = await conversationService.getConversationById(1);

      expect(result).toEqual({ ...mockConversation, messages: mockMessages });
    });

    it('should throw error if conversation not found', async () => {
      Conversation.findById.mockResolvedValueOnce(null);

      await expect(conversationService.getConversationById(999)).rejects.toThrow('not found');
    });
  });

  describe('getClientConversations', () => {
    it('should return conversations for client', async () => {
      const mockConversations = [{ id: 1 }, { id: 2 }];
      Conversation.findByClientId.mockResolvedValueOnce(mockConversations);

      const result = await conversationService.getClientConversations(1, 10, 0);

      expect(Conversation.findByClientId).toHaveBeenCalledWith(1, 10, 0);
      expect(result).toEqual(mockConversations);
    });
  });

  describe('searchConversationsByUser', () => {
    it('should search by user identifier', async () => {
      const mockConversations = [{ id: 1, user_identifier: 'user@test.com' }];
      Conversation.findByUserIdentifier.mockResolvedValueOnce(mockConversations);

      const result = await conversationService.searchConversationsByUser(1, 'user@test.com');

      expect(Conversation.findByUserIdentifier).toHaveBeenCalledWith(1, 'user@test.com');
      expect(result).toEqual(mockConversations);
    });
  });

  describe('endConversation', () => {
    it('should end conversation and clear cache', async () => {
      const mockConversation = { id: 1 };
      const updatedConversation = { id: 1, ended_at: new Date() };
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);
      Conversation.end.mockResolvedValueOnce(updatedConversation);

      const result = await conversationService.endConversation('session-1');

      expect(Conversation.end).toHaveBeenCalledWith(1);
      expect(RedisCache.deleteConversationContext).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(updatedConversation);
    });

    it('should throw error if conversation not found', async () => {
      Conversation.findBySession.mockResolvedValueOnce(null);

      await expect(conversationService.endConversation('invalid')).rejects.toThrow('not found');
    });
  });

  describe('autoEndInactiveConversations', () => {
    it('should end all inactive conversations', async () => {
      const inactiveConversations = [
        { id: 1, session_id: 's1' },
        { id: 2, session_id: 's2' },
      ];
      Conversation.findInactive.mockResolvedValueOnce(inactiveConversations);
      Conversation.end.mockResolvedValue({});

      const result = await conversationService.autoEndInactiveConversations(15);

      expect(Conversation.findInactive).toHaveBeenCalledWith(15);
      expect(Conversation.end).toHaveBeenCalledTimes(2);
      expect(RedisCache.deleteConversationContext).toHaveBeenCalledTimes(2);
      expect(result.ended).toBe(2);
    });

    it('should return empty result when no inactive conversations', async () => {
      Conversation.findInactive.mockResolvedValueOnce([]);

      const result = await conversationService.autoEndInactiveConversations();

      expect(result).toEqual({ ended: 0, conversations: [] });
    });
  });

  describe('addMessage', () => {
    it('should create message and update stats', async () => {
      const mockMessage = { id: 1, content: 'Hello' };
      Message.create.mockResolvedValueOnce(mockMessage);
      Message.count.mockResolvedValueOnce(5);
      Message.getTotalTokens.mockResolvedValueOnce(100);

      const result = await conversationService.addMessage(1, 'user', 'Hello', 10);

      expect(Message.create).toHaveBeenCalledWith(1, 'user', 'Hello', 10);
      expect(Conversation.updateStats).toHaveBeenCalledWith(1, 5, 100);
      expect(result).toEqual(mockMessage);
    });
  });

  describe('addDebugMessage', () => {
    it('should create debug message', async () => {
      const mockMessage = { id: 1 };
      Message.createDebug.mockResolvedValueOnce(mockMessage);

      const result = await conversationService.addDebugMessage(1, 'system', 'Debug info', 'tool_call');

      expect(Message.createDebug).toHaveBeenCalledWith(1, 'system', 'Debug info', 'tool_call', {});
      expect(result).toEqual(mockMessage);
    });

    it('should return null on error', async () => {
      Message.createDebug.mockRejectedValueOnce(new Error('DB error'));

      const result = await conversationService.addDebugMessage(1, 'system', 'Debug', 'error');

      expect(result).toBeNull();
    });
  });

  describe('getConversationHistory', () => {
    it('should get all messages without limit', async () => {
      const mockMessages = [{ id: 1 }, { id: 2 }];
      Message.getAll.mockResolvedValueOnce(mockMessages);

      const result = await conversationService.getConversationHistory(1);

      expect(Message.getAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockMessages);
    });

    it('should get recent messages with limit', async () => {
      const mockMessages = [{ id: 2 }];
      Message.getRecent.mockResolvedValueOnce(mockMessages);

      const result = await conversationService.getConversationHistory(1, 5);

      expect(Message.getRecent).toHaveBeenCalledWith(1, 5);
      expect(result).toEqual(mockMessages);
    });
  });

  describe('manageContextWindow', () => {
    it('should return messages unchanged if under limit', () => {
      const messages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];

      const result = conversationService.manageContextWindow(messages);

      expect(result).toEqual(messages);
    });

    it('should truncate old messages keeping system prompt', () => {
      const messages = Array(15).fill(null).map((_, i) => ({
        role: i === 0 ? 'system' : (i % 2 === 0 ? 'user' : 'assistant'),
        content: `Message ${i}`,
      }));

      const result = conversationService.manageContextWindow(messages);

      expect(result.length).toBe(conversationService.maxContextMessages);
      expect(result[0].role).toBe('system');
    });
  });

  describe('detectConversationEnd', () => {
    it('should detect goodbye phrases', () => {
      expect(conversationService.detectConversationEnd('bye')).toBe(true);
      expect(conversationService.detectConversationEnd('goodbye')).toBe(true);
      expect(conversationService.detectConversationEnd('thanks, bye!')).toBe(true);
    });

    it('should detect weak ending phrases on exact match only', () => {
      // Weak phrases only end on exact match
      expect(conversationService.detectConversationEnd('thank you')).toBe(true);
      expect(conversationService.detectConversationEnd('thanks')).toBe(true);
      expect(conversationService.detectConversationEnd('thanks!')).toBe(true);
      // Weak phrases combined with other text don't trigger
      expect(conversationService.detectConversationEnd("that's all, thanks")).toBe(false);
    });

    it('should not detect non-ending phrases', () => {
      expect(conversationService.detectConversationEnd('hello')).toBe(false);
      expect(conversationService.detectConversationEnd('what is my order status?')).toBe(false);
      expect(conversationService.detectConversationEnd('can you help me?')).toBe(false);
    });

    it('should handle null/undefined input', () => {
      expect(conversationService.detectConversationEnd(null)).toBe(false);
      expect(conversationService.detectConversationEnd(undefined)).toBe(false);
      expect(conversationService.detectConversationEnd('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(conversationService.detectConversationEnd('BYE')).toBe(true);
      expect(conversationService.detectConversationEnd('THANK YOU')).toBe(true);
      expect(conversationService.detectConversationEnd('GoodBye')).toBe(true);
    });
  });

  describe('getConversationContext', () => {
    const mockClient = { id: 1, name: 'Test Client' };
    const mockTools = [{ name: 'test_tool' }];

    it('should return cached context if available', async () => {
      const cachedContext = {
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'Hello' },
        ],
      };
      RedisCache.getConversationContext.mockResolvedValueOnce(cachedContext);

      const result = await conversationService.getConversationContext(
        'session-1',
        mockClient,
        mockTools
      );

      expect(result).toEqual(cachedContext.messages);
    });

    it('should exclude system prompt when requested', async () => {
      const cachedContext = {
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'Hello' },
        ],
      };
      RedisCache.getConversationContext.mockResolvedValueOnce(cachedContext);

      const result = await conversationService.getConversationContext(
        'session-1',
        mockClient,
        mockTools,
        false
      );

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('should build context from database if not cached', async () => {
      const mockConversation = { id: 1 };
      const mockMessages = [
        { role: 'user', content: 'Hello', metadata: null },
        { role: 'assistant', content: 'Hi!', metadata: null },
      ];

      RedisCache.getConversationContext.mockResolvedValueOnce(null);
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);
      Message.getAll.mockResolvedValueOnce(mockMessages);

      const result = await conversationService.getConversationContext(
        'session-1',
        mockClient,
        mockTools
      );

      expect(result[0].role).toBe('system');
      expect(result).toHaveLength(3); // system + 2 messages
      expect(RedisCache.setConversationContext).toHaveBeenCalled();
    });

    it('should return only system prompt for new conversation', async () => {
      RedisCache.getConversationContext.mockResolvedValueOnce(null);
      Conversation.findBySession.mockResolvedValueOnce(null);

      const result = await conversationService.getConversationContext(
        'new-session',
        mockClient,
        mockTools
      );

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('system');
    });
  });

  describe('updateConversationContext', () => {
    it('should update Redis cache', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      await conversationService.updateConversationContext('session-1', 1, messages);

      expect(RedisCache.updateConversationContext).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          conversationId: 1,
          messages,
        })
      );
    });
  });

  describe('processMessage', () => {
    const mockClient = { id: 1, name: 'Test', plan_type: 'unlimited' };

    it('should handle conversation end detection', async () => {
      const mockConversation = { id: 1 };
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);

      const result = await conversationService.processMessage(mockClient, 'session-1', 'bye');

      expect(result.conversationEnded).toBe(true);
      expect(Conversation.end).toHaveBeenCalled();
    });

    it('should use adaptive mode for adaptive plan', async () => {
      const mockConversation = { id: 1 };
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);
      Plan.findByName.mockResolvedValueOnce({ ai_mode: 'adaptive' });
      adaptiveReasoningService.processAdaptiveMessage.mockResolvedValueOnce({
        response: 'Adaptive response',
        tool_executed: false,
      });

      const result = await conversationService.processMessage(
        mockClient,
        'session-1',
        'Hello',
        { skipUserMessageSave: true }
      );

      expect(adaptiveReasoningService.processAdaptiveMessage).toHaveBeenCalled();
      expect(result.mode).toBe('adaptive');
    });

    it('should use standard mode for standard plan', async () => {
      const mockConversation = { id: 1 };
      Conversation.findBySession.mockResolvedValueOnce(mockConversation);
      Plan.findByName.mockResolvedValueOnce({ ai_mode: 'standard' });
      toolManager.getClientTools.mockResolvedValueOnce([]);
      RedisCache.getConversationContext.mockResolvedValueOnce({
        messages: [{ role: 'system', content: 'System' }],
      });
      standardReasoningService.processStandardMessage.mockResolvedValueOnce({
        response: 'Standard response',
      });
      standardReasoningService.recordUsageAndFinalize.mockResolvedValueOnce({
        response: 'Final response',
      });

      await conversationService.processMessage(
        mockClient,
        'session-1',
        'Hello',
        { skipUserMessageSave: true }
      );

      expect(standardReasoningService.processStandardMessage).toHaveBeenCalled();
    });

    it('should create new conversation if none exists', async () => {
      Conversation.findBySession.mockResolvedValueOnce(null);
      Conversation.create.mockResolvedValueOnce({ id: 1 });
      Plan.findByName.mockResolvedValueOnce({ ai_mode: 'standard' });
      toolManager.getClientTools.mockResolvedValueOnce([]);
      RedisCache.getConversationContext.mockResolvedValueOnce(null);
      Conversation.findBySession.mockResolvedValueOnce(null);
      standardReasoningService.processStandardMessage.mockResolvedValueOnce({});
      standardReasoningService.recordUsageAndFinalize.mockResolvedValueOnce({
        response: 'Response',
      });

      await conversationService.processMessage(
        mockClient,
        'new-session',
        'Hello',
        { skipUserMessageSave: true }
      );

      expect(Conversation.create).toHaveBeenCalled();
    });
  });
});
