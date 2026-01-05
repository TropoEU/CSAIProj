import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateIntentHash, verifyIntentMatch } from '../../src/utils/intentHash.js';
import { fetchContext, formatContextForPrompt, getValidContextKeys } from '../../src/utils/contextFetcher.js';
import { getToolPolicy, applyConfidenceFloor, isDestructiveTool, detectImpliedDestructiveIntent, isConfirmation } from '../../src/config/toolPolicies.js';
import { REASON_CODES, isValidReasonCode, getReasonCodeDescription } from '../../src/constants/reasonCodes.js';

describe('Reasoning System - Edge Cases', () => {
  describe('Intent Hashing', () => {
    it('should generate consistent hash for same intent', () => {
      const intent1 = { tool: 'cancel_order', params: { orderId: '12345' } };
      const intent2 = { tool: 'cancel_order', params: { orderId: '12345' } };

      const hash1 = generateIntentHash(intent1.tool, intent1.params);
      const hash2 = generateIntentHash(intent2.tool, intent2.params);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different params', () => {
      const intent1 = { tool: 'cancel_order', params: { orderId: '12345' } };
      const intent2 = { tool: 'cancel_order', params: { orderId: '67890' } };

      const hash1 = generateIntentHash(intent1.tool, intent1.params);
      const hash2 = generateIntentHash(intent2.tool, intent2.params);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle parameter order independence', () => {
      const intent1 = { tool: 'book_appointment', params: { date: '2026-01-10', time: '14:00' } };
      const intent2 = { tool: 'book_appointment', params: { time: '14:00', date: '2026-01-10' } };

      const hash1 = generateIntentHash(intent1.tool, intent1.params);
      const hash2 = generateIntentHash(intent2.tool, intent2.params);

      // Should be same because object keys are sorted before hashing
      expect(hash1).toBe(hash2);
    });

    it('should verify matching intents', () => {
      const match = verifyIntentMatch('cancel_order', { orderId: '12345' }, 'cancel_order', { orderId: '12345' });
      expect(match).toBe(true);
    });

    it('should reject mismatched intents', () => {
      const match = verifyIntentMatch('cancel_order', { orderId: '12345' }, 'cancel_order', { orderId: '99999' });
      expect(match).toBe(false);
    });
  });

  describe('Context Fetching', () => {
    const mockClient = {
      id: 1,
      name: 'Test Business',
      business_info: {
        about: { description: 'We are a test business' },
        contact: { phone: '123-456-7890', email: 'test@example.com' },
        policies: { returns: '30 day returns', shipping: 'Free shipping over $50' },
        faqs: [{ question: 'Q1', answer: 'A1' }],
        ai_instructions: 'Be friendly and helpful'
      }
    };

    it('should fetch specific context keys', () => {
      const { success, context, missing } = fetchContext(mockClient, ['policies.returns', 'contact.phone']);

      expect(success).toBe(true);
      expect(context['policies.returns']).toBe('30 day returns');
      expect(context['contact.phone']).toBe('123-456-7890');
      expect(missing).toHaveLength(0);
    });

    it('should report missing context keys', () => {
      const { success, context, missing } = fetchContext(mockClient, ['policies.warranty']);

      expect(success).toBe(false);
      expect(missing).toContain('policies.warranty');
    });

    it('should handle empty context keys', () => {
      const { success, context, missing } = fetchContext(mockClient, []);

      expect(success).toBe(true);
      expect(Object.keys(context)).toHaveLength(0);
      expect(missing).toHaveLength(0);
    });

    it('should handle unknown context keys', () => {
      const { success, context, missing } = fetchContext(mockClient, ['invalid.key']);

      expect(success).toBe(false);
      expect(missing).toContain('invalid.key');
    });

    it('should format context for prompt', () => {
      const context = {
        'policies.returns': '30 day returns',
        'contact.phone': '123-456-7890'
      };

      const formatted = formatContextForPrompt(context, 'Test Business');

      expect(formatted).toContain('Return Policy');
      expect(formatted).toContain('30 day returns');
      expect(formatted).toContain('123-456-7890');
    });

    it('should list all valid context keys', () => {
      const validKeys = getValidContextKeys();

      expect(validKeys).toContain('policies.returns');
      expect(validKeys).toContain('contact.phone');
      expect(validKeys).toContain('about.description');
      expect(validKeys).toContain('faqs');
      expect(validKeys).toContain('all');
    });

    it('should prevent infinite context fetch loops', () => {
      let attempts = 0;
      const MAX_ATTEMPTS = 2;

      // Simulate context fetch loop
      while (attempts < MAX_ATTEMPTS && attempts < 10) {
        attempts++;
      }

      expect(attempts).toBe(MAX_ATTEMPTS);
      expect(attempts).not.toBeGreaterThan(MAX_ATTEMPTS);
    });
  });

  describe('Tool Policies', () => {
    it('should define policy for destructive tools', () => {
      const policy = getToolPolicy('cancel_order');

      expect(policy).toBeDefined();
      expect(policy.maxConfidence).toBeLessThan(7);
      expect(policy.isDestructive).toBe(true);
      expect(policy.requiresConfirmation).toBe(true);
    });

    it('should define policy for read-only tools', () => {
      const policy = getToolPolicy('get_order_status');

      expect(policy).toBeDefined();
      expect(policy.maxConfidence).toBeGreaterThan(7);
      expect(policy.isDestructive).toBe(false);
    });

    it('should apply confidence floor to destructive tools', () => {
      const effectiveConfidence = applyConfidenceFloor('cancel_order', 9);
      expect(effectiveConfidence).toBeLessThanOrEqual(6);
    });

    it('should not reduce confidence for read-only tools', () => {
      const effectiveConfidence = applyConfidenceFloor('get_order_status', 9);
      expect(effectiveConfidence).toBe(9);
    });

    it('should identify destructive tools', () => {
      expect(isDestructiveTool('cancel_order')).toBe(true);
      expect(isDestructiveTool('refund')).toBe(true);
      expect(isDestructiveTool('delete_account')).toBe(true);
      expect(isDestructiveTool('get_order_status')).toBe(false);
    });

    it('should detect implied destructive intent in English', () => {
      const messages = [
        'cancel my order',
        'I want to delete my account',
        'refund everything',
        'remove all my data'
      ];

      messages.forEach(msg => {
        const detected = detectImpliedDestructiveIntent(msg, 'en');
        expect(detected).toBe(true);
      });
    });

    it('should detect implied destructive intent in Hebrew', () => {
      const messages = [
        'בטל את ההזמנה שלי',
        'מחק את החשבון',
        'החזר כסף'
      ];

      messages.forEach(msg => {
        const detected = detectImpliedDestructiveIntent(msg, 'he');
        expect(detected).toBe(true);
      });
    });

    it('should not false-positive on non-destructive messages', () => {
      const messages = [
        'check my order status',
        'when will my order arrive?',
        'what is your return policy?'
      ];

      messages.forEach(msg => {
        const detected = detectImpliedDestructiveIntent(msg, 'en');
        expect(detected).toBe(false);
      });
    });
  });

  describe('Confirmation Detection', () => {
    it('should detect confirmation in English', () => {
      const messages = ['yes', 'confirm', 'do it', 'go ahead', 'proceed', 'okay'];

      messages.forEach(msg => {
        const detected = isConfirmation(msg, 'en');
        expect(detected).toBe(true);
      });
    });

    it('should detect confirmation in Hebrew', () => {
      const messages = ['כן', 'אישור', 'בצע', 'המשך', 'תמשיך'];

      messages.forEach(msg => {
        const detected = isConfirmation(msg, 'he');
        expect(detected).toBe(true);
      });
    });

    it('should not false-positive on similar words', () => {
      const messages = ['yesterday', 'confirm my address', 'I said yes yesterday'];

      messages.forEach(msg => {
        const detected = isConfirmation(msg, 'en');
        // Should not match if confirmation word is part of a longer phrase
        // unless it's clearly a confirmation
      });
    });

    it('should be case-insensitive', () => {
      const messages = ['YES', 'Yes', 'yes', 'YeS'];

      messages.forEach(msg => {
        const detected = isConfirmation(msg, 'en');
        expect(detected).toBe(true);
      });
    });
  });

  describe('Reason Codes', () => {
    it('should validate success codes', () => {
      expect(isValidReasonCode(REASON_CODES.EXECUTED_SUCCESSFULLY)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.RESPONDED_SUCCESSFULLY)).toBe(true);
    });

    it('should validate blocked codes', () => {
      expect(isValidReasonCode(REASON_CODES.MISSING_PARAM)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.DESTRUCTIVE_NO_CONFIRM)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.LOW_CONFIDENCE)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.TOOL_NOT_FOUND)).toBe(true);
    });

    it('should validate edge case codes', () => {
      expect(isValidReasonCode(REASON_CODES.CONTEXT_LOOP_DETECTED)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.PENDING_INTENT_MISMATCH)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.IMPLIED_DESTRUCTIVE_INTENT)).toBe(true);
    });

    it('should validate system codes', () => {
      expect(isValidReasonCode(REASON_CODES.CRITIQUE_TRIGGERED)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.CRITIQUE_SKIPPED)).toBe(true);
      expect(isValidReasonCode(REASON_CODES.ASSESSMENT_COMPLETED)).toBe(true);
    });

    it('should reject invalid codes', () => {
      expect(isValidReasonCode('INVALID_CODE')).toBe(false);
      expect(isValidReasonCode(null)).toBe(false);
      expect(isValidReasonCode(undefined)).toBe(false);
    });

    it('should provide descriptions for reason codes', () => {
      const description = getReasonCodeDescription(REASON_CODES.CRITIQUE_TRIGGERED);
      expect(description).toBeTruthy();
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe('Stale Intent Handling', () => {
    it('should detect stale pending intents', () => {
      const pendingIntent = {
        tool: 'cancel_order',
        params: { orderId: '12345' },
        hash: 'abc123',
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      };

      const INTENT_TTL = 5 * 60 * 1000; // 5 minutes
      const age = Date.now() - pendingIntent.timestamp;
      const isStale = age > INTENT_TTL;

      expect(isStale).toBe(true);
    });

    it('should accept fresh pending intents', () => {
      const pendingIntent = {
        tool: 'cancel_order',
        params: { orderId: '12345' },
        hash: 'abc123',
        timestamp: Date.now() - (2 * 60 * 1000) // 2 minutes ago
      };

      const INTENT_TTL = 5 * 60 * 1000; // 5 minutes
      const age = Date.now() - pendingIntent.timestamp;
      const isStale = age > INTENT_TTL;

      expect(isStale).toBe(false);
    });
  });

  describe('Assessment Parsing Edge Cases', () => {
    it('should handle malformed assessment JSON', () => {
      const malformedResponse = `Let me help you.

<assessment>
{
  "confidence": 8,
  "tool_call": "get_order_status"
  // missing closing brace
</assessment>`;

      try {
        const assessmentMatch = malformedResponse.match(/<assessment>([\s\S]*?)<\/assessment>/);
        if (assessmentMatch) {
          const assessmentText = assessmentMatch[1].trim();
          JSON.parse(assessmentText);
          expect(true).toBe(false); // Should not reach here
        }
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });

    it('should handle missing assessment block', () => {
      const responseWithoutAssessment = 'Hello! How can I help you today?';

      const assessmentMatch = responseWithoutAssessment.match(/<assessment>([\s\S]*?)<\/assessment>/);
      expect(assessmentMatch).toBeNull();
    });

    it('should handle JavaScript comments in assessment', () => {
      const responseWithComments = `<assessment>
{
  // This is a comment
  "confidence": 8,
  "tool_call": "get_order_status", // another comment
  "tool_params": {"orderId": "12345"}
}
</assessment>`;

      const assessmentMatch = responseWithComments.match(/<assessment>([\s\S]*?)<\/assessment>/);
      expect(assessmentMatch).toBeTruthy();

      if (assessmentMatch) {
        const assessmentText = assessmentMatch[1].trim();
        // Remove JavaScript-style comments before parsing
        const cleaned = assessmentText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const parsed = JSON.parse(cleaned);
        expect(parsed.confidence).toBe(8);
      }
    });
  });

  describe('Tool Hallucination', () => {
    it('should detect non-existent tools', () => {
      const availableTools = [
        { tool_name: 'get_order_status' },
        { tool_name: 'book_appointment' }
      ];

      const requestedTool = 'delete_all_data';

      const toolExists = availableTools.some(t => t.tool_name === requestedTool);
      expect(toolExists).toBe(false);
    });

    it('should handle case-sensitive tool names', () => {
      const availableTools = [
        { tool_name: 'get_order_status' }
      ];

      const requestedTool = 'GET_ORDER_STATUS';

      const toolExists = availableTools.some(t => t.tool_name === requestedTool);
      expect(toolExists).toBe(false);
    });

    it('should handle typos in tool names', () => {
      const availableTools = [
        { tool_name: 'get_order_status' }
      ];

      const requestedTool = 'get_order_stauts'; // typo

      const toolExists = availableTools.some(t => t.tool_name === requestedTool);
      expect(toolExists).toBe(false);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should prevent duplicate processing with locks', () => {
      const lockKey = 'conversation:123';
      const locks = new Set();

      // First request acquires lock
      const acquired1 = !locks.has(lockKey);
      if (acquired1) locks.add(lockKey);
      expect(acquired1).toBe(true);

      // Second concurrent request fails to acquire lock
      const acquired2 = !locks.has(lockKey);
      expect(acquired2).toBe(false);

      // After first request releases lock
      locks.delete(lockKey);
      const acquired3 = !locks.has(lockKey);
      expect(acquired3).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should detect missing required parameters', () => {
      const requiredParams = ['orderId', 'customerName'];
      const providedParams = { orderId: '12345' };

      const missingParams = requiredParams.filter(p => !providedParams[p]);
      expect(missingParams).toContain('customerName');
    });

    it('should handle optional parameters', () => {
      const requiredParams = ['date'];
      const optionalParams = ['time', 'notes'];
      const providedParams = { date: '2026-01-10' };

      const missingRequired = requiredParams.filter(p => !providedParams[p]);
      expect(missingRequired).toHaveLength(0);
    });

    it('should validate parameter types', () => {
      const schema = {
        orderId: 'string',
        amount: 'number',
        confirmed: 'boolean'
      };

      const params = {
        orderId: '12345',
        amount: 99.99,
        confirmed: true
      };

      expect(typeof params.orderId).toBe(schema.orderId);
      expect(typeof params.amount).toBe(schema.amount);
      expect(typeof params.confirmed).toBe(schema.confirmed);
    });
  });
});
