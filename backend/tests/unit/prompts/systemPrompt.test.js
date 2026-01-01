import { describe, it, expect } from 'vitest';
import {
  getSystemPrompt,
  getEnhancedSystemPrompt,
  getContextualSystemPrompt,
  getGreeting,
  getEscalationMessage,
  getErrorMessage,
  fallbackGreeting,
  toolInstructions,
} from '../../../src/prompts/systemPrompt.js';

describe('System Prompts', () => {
  const mockClient = {
    name: 'Test Business',
    language: 'en',
  };

  const mockHebrewClient = {
    name: 'עסק לדוגמה',
    language: 'he',
  };

  describe('getSystemPrompt', () => {
    it('should return prompt with guided reasoning structure', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('Test Business');
      expect(prompt).toContain('friendly customer support');
      expect(prompt).toContain('REASONING PROCESS');
      expect(prompt).toContain('Step 1: UNDERSTAND');
      expect(prompt).toContain('Step 2: CHECK CONTEXT');
      expect(prompt).toContain('Step 3: DECIDE ON ACTION');
      expect(prompt).toContain('Step 4: RESPOND');
    });

    it('should include language instruction for non-English clients', () => {
      const prompt = getSystemPrompt(mockHebrewClient);

      expect(prompt).toContain('עסק לדוגמה');
      expect(prompt).toContain('LANGUAGE REQUIREMENT');
      expect(prompt).toContain('Hebrew');
      expect(prompt).toContain('עברית');
    });

    it('should NOT include language instruction for English clients', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).not.toContain('LANGUAGE REQUIREMENT');
    });

    it('should default to English for clients without language', () => {
      const prompt = getSystemPrompt({ name: 'Test', language: undefined });

      expect(prompt).toContain('friendly customer support');
      expect(prompt).not.toContain('LANGUAGE REQUIREMENT');
    });

    it('should include tool usage rules', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('TOOL USAGE RULES');
      expect(prompt).toContain('Never make up information');
      expect(prompt).toContain('Never repeat a tool call');
    });

    it('should include tool format instructions', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('USE_TOOL:');
      expect(prompt).toContain('PARAMETERS:');
    });

    it('should include tool result handling instructions', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('AFTER RECEIVING TOOL RESULTS');
      expect(prompt).toContain('Summarize the result naturally');
    });
  });

  describe('getEnhancedSystemPrompt', () => {
    it('should include base prompt', () => {
      const prompt = getEnhancedSystemPrompt(mockClient);

      expect(prompt).toContain('Test Business');
      expect(prompt).toContain('REASONING PROCESS');
    });

    it('should include custom instructions when provided', () => {
      const clientWithInstructions = {
        ...mockClient,
        business_info: {
          custom_instructions: 'Always be extra friendly.',
        },
      };

      const prompt = getEnhancedSystemPrompt(clientWithInstructions);

      expect(prompt).toContain('Client-Specific Instructions');
      expect(prompt).toContain('Always be extra friendly');
    });

    it('should not add section when no custom instructions', () => {
      const prompt = getEnhancedSystemPrompt(mockClient);

      expect(prompt).not.toContain('Client-Specific Instructions');
    });
  });

  describe('getContextualSystemPrompt', () => {
    it('should include business description when provided', () => {
      const clientWithInfo = {
        ...mockClient,
        business_info: {
          about_business: 'We are a premium pizza restaurant.',
        },
      };

      const prompt = getContextualSystemPrompt(clientWithInfo);

      expect(prompt).toContain('About Test Business');
      expect(prompt).toContain('premium pizza restaurant');
    });

    it('should include business hours when provided', () => {
      const prompt = getContextualSystemPrompt(mockClient, [], {
        business_hours: 'Mon-Fri 9am-5pm',
      });

      expect(prompt).toContain('Business Hours');
      expect(prompt).toContain('Mon-Fri 9am-5pm');
    });

    it('should include contact information when provided', () => {
      const prompt = getContextualSystemPrompt(mockClient, [], {
        contact_phone: '555-1234',
        contact_email: 'info@test.com',
        contact_address: '123 Main St',
      });

      expect(prompt).toContain('Contact Information');
      expect(prompt).toContain('555-1234');
      expect(prompt).toContain('info@test.com');
      expect(prompt).toContain('123 Main St');
    });

    it('should include policies when provided', () => {
      const clientWithPolicies = {
        ...mockClient,
        business_info: {
          return_policy: '30 day returns',
          shipping_policy: 'Free shipping over $50',
          payment_methods: 'Visa, Mastercard, PayPal',
        },
      };

      const prompt = getContextualSystemPrompt(clientWithPolicies);

      expect(prompt).toContain('Return Policy');
      expect(prompt).toContain('30 day returns');
      expect(prompt).toContain('Shipping Policy');
      expect(prompt).toContain('Free shipping');
      expect(prompt).toContain('Payment Methods');
    });

    it('should include FAQ when provided', () => {
      const prompt = getContextualSystemPrompt(mockClient, [], {
        faq: [
          { question: 'What are your hours?', answer: '9am-5pm' },
          { question: 'Do you deliver?', answer: 'Yes, within 10 miles' },
        ],
      });

      expect(prompt).toContain('Frequently Asked Questions');
      expect(prompt).toContain('What are your hours?');
      expect(prompt).toContain('9am-5pm');
    });

    it('should merge business_info with context (context takes precedence)', () => {
      const clientWithInfo = {
        ...mockClient,
        business_info: {
          business_hours: 'Original hours',
        },
      };

      const prompt = getContextualSystemPrompt(clientWithInfo, [], {
        business_hours: 'Override hours',
      });

      expect(prompt).toContain('Override hours');
      expect(prompt).not.toContain('Original hours');
    });
  });

  describe('getGreeting', () => {
    it('should return null to let AI generate greetings', () => {
      const greeting = getGreeting(mockClient);
      expect(greeting).toBeNull();
    });

    it('should return null for Hebrew clients too', () => {
      const greeting = getGreeting(mockHebrewClient);
      expect(greeting).toBeNull();
    });
  });

  describe('fallbackGreeting', () => {
    it('should be a valid English greeting', () => {
      expect(fallbackGreeting).toBe('Hi! How can I help you today?');
    });
  });

  describe('getEscalationMessage', () => {
    it('should return English escalation message', () => {
      const message = getEscalationMessage();

      expect(message).toContain('human assistance');
      expect(message).toContain('team member');
    });
  });

  describe('getErrorMessage', () => {
    it('should return English error message', () => {
      const message = getErrorMessage();

      expect(message).toContain('having trouble processing');
      expect(message).toContain('try again');
    });
  });

  describe('toolInstructions', () => {
    it('should have instructions for all common tools', () => {
      expect(toolInstructions.get_order_status).toBeDefined();
      expect(toolInstructions.book_appointment).toBeDefined();
      expect(toolInstructions.check_inventory).toBeDefined();
      expect(toolInstructions.get_product_info).toBeDefined();
      expect(toolInstructions.send_email).toBeDefined();
    });

    it('should include relevant keywords in instructions', () => {
      expect(toolInstructions.get_order_status).toContain('order');
      expect(toolInstructions.book_appointment).toContain('appointment');
      expect(toolInstructions.check_inventory).toContain('product');
    });
  });
});
