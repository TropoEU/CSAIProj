import { describe, it, expect } from 'vitest';
import {
  getSystemPrompt,
  getEnhancedSystemPrompt,
  getContextualSystemPrompt,
  getGreeting,
  getEscalationMessage,
  getErrorMessage,
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
    it('should return English prompt for English clients', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('Test Business');
      expect(prompt).toContain('friendly customer support');
      expect(prompt).toContain('USE_TOOL:');
      expect(prompt).toContain('PARAMETERS:');
    });

    it('should return Hebrew prompt for Hebrew clients', () => {
      const prompt = getSystemPrompt(mockHebrewClient);

      expect(prompt).toContain('עסק לדוגמה');
      expect(prompt).toContain('נציג שירות לקוחות');
      expect(prompt).toContain('ענה תמיד בעברית');
    });

    it('should default to English for clients without language', () => {
      const prompt = getSystemPrompt({ name: 'Test', language: undefined });

      expect(prompt).toContain('friendly customer support');
    });

    it('should include tool result handling instructions', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('[TOOL RESULT]');
      expect(prompt).toContain('CRITICAL');
    });

    it('should include when to call tools section', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain('WHEN TO CALL TOOLS');
      expect(prompt).toContain('book table');
      expect(prompt).toContain('check order');
    });

    it('should include do not instructions', () => {
      const prompt = getSystemPrompt(mockClient);

      expect(prompt).toContain("DON'T");
      expect(prompt).toContain('Show raw JSON');
    });
  });

  describe('getEnhancedSystemPrompt', () => {
    it('should include base prompt', () => {
      const prompt = getEnhancedSystemPrompt(mockClient);

      expect(prompt).toContain('Test Business');
      expect(prompt).toContain('USE_TOOL:');
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
    it('should return English greeting for English clients', () => {
      const greeting = getGreeting(mockClient);

      expect(greeting).toBe('Hi! How can I help you today?');
    });

    it('should return Hebrew greeting for Hebrew clients', () => {
      const greeting = getGreeting(mockHebrewClient);

      expect(greeting).toBe('שלום! איך אפשר לעזור לך היום?');
    });

    it('should default to English greeting', () => {
      const greeting = getGreeting({ name: 'Test' });

      expect(greeting).toBe('Hi! How can I help you today?');
    });
  });

  describe('getEscalationMessage', () => {
    it('should return English escalation message by default', () => {
      const message = getEscalationMessage();

      expect(message).toContain('human assistance');
      expect(message).toContain('team member');
    });

    it('should return English escalation message for en', () => {
      const message = getEscalationMessage('en');

      expect(message).toContain('human assistance');
    });

    it('should return Hebrew escalation message for he', () => {
      const message = getEscalationMessage('he');

      expect(message).toContain('נציג אנושי');
      expect(message).toContain('המתן');
    });
  });

  describe('getErrorMessage', () => {
    it('should return English error message by default', () => {
      const message = getErrorMessage();

      expect(message).toContain('having trouble processing');
      expect(message).toContain('try again');
    });

    it('should return Hebrew error message for he', () => {
      const message = getErrorMessage('he');

      expect(message).toContain('מתקשה לעבד');
      expect(message).toContain('נסה שוב');
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
