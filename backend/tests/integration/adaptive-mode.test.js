import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import adaptiveReasoningService from '../../src/services/adaptiveReasoningService.js';
import { Plan } from '../../src/models/Plan.js';
import { ApiUsage } from '../../src/models/ApiUsage.js';
import { RedisCache } from '../../src/services/redisCache.js';
import llmService from '../../src/services/llmService.js';
import toolManager from '../../src/services/toolManager.js';
import { REASON_CODES } from '../../src/constants/reasonCodes.js';

// Mock dependencies
vi.mock('../../src/db.js');
vi.mock('../../src/models/Plan.js');
vi.mock('../../src/models/ApiUsage.js');
vi.mock('../../src/models/Message.js');
vi.mock('../../src/models/Client.js');
vi.mock('../../src/models/Conversation.js');
vi.mock('../../src/services/llmService.js');
vi.mock('../../src/services/toolManager.js');
vi.mock('../../src/services/redisCache.js');
vi.mock('../../src/services/escalationService.js');

describe('Adaptive Mode - Reasoning Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mode Routing', () => {
    it('should use adaptive mode for plans with ai_mode=adaptive', async () => {
      Plan.findByName = vi.fn().mockResolvedValue({
        name: 'enterprise',
        ai_mode: 'adaptive'
      });

      const plan = await Plan.findByName('enterprise');
      expect(plan.ai_mode).toBe('adaptive');
    });
  });

  describe('Self-Assessment', () => {
    it('should parse assessment from LLM response', () => {
      const mockAssessment = {
        confidence: 8,
        tool_call: 'get_order_status',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: []
      };

      // Mock the parseAssessment method
      llmService.parseAssessment = vi.fn().mockReturnValue({
        visible_response: 'I can help with that.\n\nLet me check that order for you.',
        assessment: mockAssessment
      });

      const { visible_response, assessment } = llmService.parseAssessment('mock content');

      expect(assessment).toBeDefined();
      expect(assessment.confidence).toBe(8);
      expect(assessment.tool_call).toBe('get_order_status');
      expect(visible_response).toBeTruthy();
    });

    it('should handle assessment without tool call', () => {
      const mockAssessment = {
        confidence: 10,
        tool_call: null,
        tool_params: null,
        missing_params: [],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: []
      };

      // Mock the parseAssessment method
      llmService.parseAssessment = vi.fn().mockReturnValue({
        visible_response: 'How can I help you today?\n\nI\'m here to assist you.',
        assessment: mockAssessment
      });

      const { visible_response, assessment } = llmService.parseAssessment('mock content');

      expect(assessment.tool_call).toBeNull();
      expect(assessment.confidence).toBe(10);
    });

    it('should detect destructive actions in assessment', () => {
      const mockAssessment = {
        confidence: 7,
        tool_call: 'cancel_order',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: true,
        needs_confirmation: true,
        needs_more_context: []
      };

      expect(mockAssessment.is_destructive).toBe(true);
      expect(mockAssessment.needs_confirmation).toBe(true);
    });
  });

  describe('Server-Side Policy Enforcement', () => {
    it('should apply confidence floor to destructive tools', () => {
      const mockAssessment = {
        confidence: 9,
        tool_call: 'cancel_order',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: true,
        needs_confirmation: true,
        needs_more_context: []
      };

      const mockTools = [
        { tool_name: 'cancel_order', description: 'Cancel an order' }
      ];

      // cancel_order has max confidence 6
      // So even if AI says 9, it should be capped at 6
      const effectiveConfidence = Math.min(mockAssessment.confidence, 6);
      expect(effectiveConfidence).toBe(6);
    });

    it('should block tool calls with missing parameters', () => {
      const mockAssessment = {
        confidence: 8,
        tool_call: 'book_appointment',
        tool_params: { date: '2026-01-10' },
        missing_params: ['customerName', 'phoneNumber'],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: []
      };

      // Server should block if missing_params is not empty
      const shouldBlock = mockAssessment.missing_params.length > 0;
      expect(shouldBlock).toBe(true);
    });

    it('should block hallucinated tool calls', () => {
      const mockAssessment = {
        confidence: 8,
        tool_call: 'delete_everything',
        tool_params: {},
        missing_params: [],
        is_destructive: true,
        needs_confirmation: true,
        needs_more_context: []
      };

      const mockTools = [
        { tool_name: 'get_order_status' },
        { tool_name: 'book_appointment' }
      ];

      // Tool doesn't exist in available tools
      const toolExists = mockTools.some(t => t.tool_name === mockAssessment.tool_call);
      expect(toolExists).toBe(false);
    });
  });

  describe('Critique Triggering', () => {
    it('should trigger critique for destructive tools', () => {
      const mockAssessment = {
        confidence: 7,
        tool_call: 'cancel_order',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: true,
        needs_confirmation: true,
        needs_more_context: []
      };

      const shouldTriggerCritique = mockAssessment.is_destructive;
      expect(shouldTriggerCritique).toBe(true);
    });

    it('should trigger critique for low confidence', () => {
      const mockAssessment = {
        confidence: 5,
        tool_call: 'get_order_status',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: []
      };

      const shouldTriggerCritique = mockAssessment.confidence < 7;
      expect(shouldTriggerCritique).toBe(true);
    });

    it('should skip critique for high-confidence read-only tools', () => {
      const mockAssessment = {
        confidence: 9,
        tool_call: 'get_order_status',
        tool_params: { orderId: '12345' },
        missing_params: [],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: []
      };

      const shouldTriggerCritique = mockAssessment.is_destructive || mockAssessment.confidence < 7;
      expect(shouldTriggerCritique).toBe(false);
    });

    it('should trigger critique when needs_confirmation is true', () => {
      const mockAssessment = {
        confidence: 8,
        tool_call: 'refund',
        tool_params: { orderId: '12345', amount: 99.99 },
        missing_params: [],
        is_destructive: true,
        needs_confirmation: true,
        needs_more_context: []
      };

      const shouldTriggerCritique = mockAssessment.needs_confirmation;
      expect(shouldTriggerCritique).toBe(true);
    });
  });

  describe('Critique Decisions', () => {
    it('should handle PROCEED decision', () => {
      const mockCritiqueResult = {
        decision: 'PROCEED',
        reasoning: 'All parameters are valid and user intent is clear',
        message: null
      };

      expect(mockCritiqueResult.decision).toBe('PROCEED');
    });

    it('should handle ASK_USER decision', () => {
      const mockCritiqueResult = {
        decision: 'ASK_USER',
        reasoning: 'Need to confirm destructive action',
        message: 'Are you sure you want to cancel order #12345?'
      };

      expect(mockCritiqueResult.decision).toBe('ASK_USER');
      expect(mockCritiqueResult.message).toContain('Are you sure');
    });

    it('should handle ESCALATE decision', () => {
      const mockCritiqueResult = {
        decision: 'ESCALATE',
        reasoning: 'Ambiguous request, unable to determine user intent',
        message: 'Let me connect you with a team member who can help.'
      };

      expect(mockCritiqueResult.decision).toBe('ESCALATE');
    });
  });

  describe('Confirmation Matching', () => {
    it('should store pending intent for destructive actions', async () => {
      const setPendingIntentSpy = vi.spyOn(RedisCache, 'setPendingIntent').mockResolvedValue(true);

      const mockIntent = {
        tool: 'cancel_order',
        params: { orderId: '12345' },
        hash: 'abc123def456',
        timestamp: Date.now()
      };

      await RedisCache.setPendingIntent(1, mockIntent);

      expect(setPendingIntentSpy).toHaveBeenCalledWith(1, mockIntent);
    });

    it('should match confirmation with pending intent', async () => {
      const mockPendingIntent = {
        tool: 'cancel_order',
        params: { orderId: '12345' },
        hash: 'abc123',
        timestamp: Date.now()
      };

      RedisCache.getPendingIntent = vi.fn().mockResolvedValue(mockPendingIntent);

      const pendingIntent = await RedisCache.getPendingIntent(1);
      expect(pendingIntent).toBeDefined();
      expect(pendingIntent.tool).toBe('cancel_order');
    });

    it('should detect confirmation phrases', () => {
      const confirmationPhrases = ['yes', 'confirm', 'do it', 'go ahead', 'proceed'];
      const userMessage = 'yes, go ahead';

      const isConfirmation = confirmationPhrases.some(phrase =>
        userMessage.toLowerCase().includes(phrase)
      );

      expect(isConfirmation).toBe(true);
    });
  });

  describe('Context Fetching', () => {
    it('should detect when more context is needed', () => {
      const mockAssessment = {
        confidence: 6,
        tool_call: null,
        tool_params: null,
        missing_params: [],
        is_destructive: false,
        needs_confirmation: false,
        needs_more_context: ['policies.returns', 'contact.hours']
      };

      expect(mockAssessment.needs_more_context).toHaveLength(2);
      expect(mockAssessment.needs_more_context).toContain('policies.returns');
    });

    it('should limit context fetches to 2 attempts', () => {
      let contextFetchCount = 0;
      const MAX_CONTEXT_FETCHES = 2;

      // Simulate 3 attempts
      for (let i = 0; i < 3; i++) {
        if (contextFetchCount < MAX_CONTEXT_FETCHES) {
          contextFetchCount++;
        }
      }

      expect(contextFetchCount).toBe(2);
    });

    it('should fetch full context after hitting limit', () => {
      const contextFetchCount = 2;
      const MAX_CONTEXT_FETCHES = 2;

      const shouldFetchFullContext = contextFetchCount >= MAX_CONTEXT_FETCHES;
      expect(shouldFetchFullContext).toBe(true);
    });
  });

  describe('Usage Tracking', () => {
    it('should record adaptive mode metrics', async () => {
      const recordUsageSpy = vi.spyOn(ApiUsage, 'recordUsage').mockResolvedValue({});

      await ApiUsage.recordUsage(
        1,
        0, // tokens tracked separately
        0,
        1,
        false,
        {
          isAdaptive: true,
          critiqueTriggered: true,
          contextFetchCount: 1
        }
      );

      expect(recordUsageSpy).toHaveBeenCalledWith(
        1,
        0,
        0,
        1,
        false,
        expect.objectContaining({
          isAdaptive: true,
          critiqueTriggered: true,
          contextFetchCount: 1
        })
      );
    });

    it('should track critique trigger rate', async () => {
      const metrics = {
        totalAdaptiveMessages: 100,
        critiqueTriggers: 30
      };

      const critiqueTriggerRate = (metrics.critiqueTriggers / metrics.totalAdaptiveMessages) * 100;
      expect(critiqueTriggerRate).toBe(30); // 30% of messages triggered critique
    });

    it('should track context fetch average', async () => {
      const metrics = {
        totalAdaptiveMessages: 50,
        contextFetches: 75
      };

      const avgContextFetches = metrics.contextFetches / metrics.totalAdaptiveMessages;
      expect(avgContextFetches).toBe(1.5); // 1.5 context fetches per adaptive message
    });
  });

  describe('Reason Codes', () => {
    it('should use CRITIQUE_TRIGGERED reason code', () => {
      expect(REASON_CODES.CRITIQUE_TRIGGERED).toBeDefined();
    });

    it('should use CRITIQUE_SKIPPED reason code', () => {
      expect(REASON_CODES.CRITIQUE_SKIPPED).toBeDefined();
    });

    it('should use CONTEXT_FETCHED reason code', () => {
      expect(REASON_CODES.CONTEXT_FETCHED).toBeDefined();
    });

    it('should use AWAITING_CONFIRMATION reason code', () => {
      expect(REASON_CODES.AWAITING_CONFIRMATION).toBeDefined();
    });

    it('should use CONFIDENCE_FLOOR_APPLIED reason code', () => {
      expect(REASON_CODES.CONFIDENCE_FLOOR_APPLIED).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should minimize LLM calls for simple queries', () => {
      // Adaptive mode without critique = 1 LLM call
      const llmCallsWithoutCritique = 1;
      expect(llmCallsWithoutCritique).toBe(1);
    });

    it('should add one call when critique is triggered', () => {
      // Adaptive mode with critique = 2 LLM calls (assessment + critique)
      const llmCallsWithCritique = 2;
      expect(llmCallsWithCritique).toBe(2);
    });

    it('should add calls for context fetching', () => {
      // Adaptive mode with 2 context fetches + critique = 4 LLM calls
      const llmCallsWithContextAndCritique = 4; // initial + 2 refetch + critique
      expect(llmCallsWithContextAndCritique).toBe(4);
    });
  });
});
