import { describe, it, expect } from 'vitest';
import {
  STRONG_ENDING_PHRASES,
  WEAK_ENDING_PHRASES,
  ENDING_PHRASES,
  ACTION_CLAIM_WORDS,
  TOOL_SIMULATION_PHRASES,
  ESCALATION_TRIGGERS,
  CLARIFICATION_PHRASES,
  THRESHOLDS,
  getEscalationTriggers,
  getClarificationPhrases,
  getAllEscalationTriggers,
  getAllClarificationPhrases,
} from '../../../src/config/phrases.js';

describe('Phrases Configuration', () => {
  describe('STRONG_ENDING_PHRASES', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(STRONG_ENDING_PHRASES)).toBe(true);
      expect(STRONG_ENDING_PHRASES.length).toBeGreaterThan(0);
    });

    it('should contain common goodbye phrases', () => {
      expect(STRONG_ENDING_PHRASES).toContain('goodbye');
      expect(STRONG_ENDING_PHRASES).toContain('bye');
      expect(STRONG_ENDING_PHRASES).toContain('see you');
    });

    it('should contain completion phrases', () => {
      expect(STRONG_ENDING_PHRASES).toContain("that's all");
      expect(STRONG_ENDING_PHRASES).toContain("i'm done");
    });

    it('should be all lowercase', () => {
      STRONG_ENDING_PHRASES.forEach(phrase => {
        expect(phrase).toBe(phrase.toLowerCase());
      });
    });

    it('should not contain weak phrases like thanks', () => {
      expect(STRONG_ENDING_PHRASES).not.toContain('thanks');
      expect(STRONG_ENDING_PHRASES).not.toContain('thank you');
    });
  });

  describe('WEAK_ENDING_PHRASES', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(WEAK_ENDING_PHRASES)).toBe(true);
      expect(WEAK_ENDING_PHRASES.length).toBeGreaterThan(0);
    });

    it('should contain thank you phrases', () => {
      expect(WEAK_ENDING_PHRASES).toContain('thank you');
      expect(WEAK_ENDING_PHRASES).toContain('thanks');
    });

    it('should be all lowercase', () => {
      WEAK_ENDING_PHRASES.forEach(phrase => {
        expect(phrase).toBe(phrase.toLowerCase());
      });
    });
  });

  describe('ENDING_PHRASES', () => {
    it('should combine strong and weak phrases', () => {
      expect(ENDING_PHRASES.length).toBe(
        STRONG_ENDING_PHRASES.length + WEAK_ENDING_PHRASES.length
      );
    });

    it('should contain both strong and weak phrases', () => {
      expect(ENDING_PHRASES).toContain('goodbye'); // strong
      expect(ENDING_PHRASES).toContain('thanks'); // weak
    });
  });

  describe('ACTION_CLAIM_WORDS', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(ACTION_CLAIM_WORDS)).toBe(true);
      expect(ACTION_CLAIM_WORDS.length).toBeGreaterThan(0);
    });

    it('should contain action words', () => {
      expect(ACTION_CLAIM_WORDS).toContain('booked');
      expect(ACTION_CLAIM_WORDS).toContain('confirmed');
      expect(ACTION_CLAIM_WORDS).toContain('scheduled');
    });
  });

  describe('TOOL_SIMULATION_PHRASES', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(TOOL_SIMULATION_PHRASES)).toBe(true);
      expect(TOOL_SIMULATION_PHRASES.length).toBeGreaterThan(0);
    });

    it('should contain simulation indicators', () => {
      expect(TOOL_SIMULATION_PHRASES).toContain('checking');
      expect(TOOL_SIMULATION_PHRASES).toContain('loading');
      expect(TOOL_SIMULATION_PHRASES).toContain('processing');
    });
  });

  describe('ESCALATION_TRIGGERS', () => {
    it('should have English triggers', () => {
      expect(Array.isArray(ESCALATION_TRIGGERS.en)).toBe(true);
      expect(ESCALATION_TRIGGERS.en.length).toBeGreaterThan(0);
    });

    it('should have Hebrew triggers', () => {
      expect(Array.isArray(ESCALATION_TRIGGERS.he)).toBe(true);
      expect(ESCALATION_TRIGGERS.he.length).toBeGreaterThan(0);
    });

    it('should contain human request phrases in English', () => {
      const hasHumanPhrase = ESCALATION_TRIGGERS.en.some(phrase =>
        phrase.includes('human') ||
        phrase.includes('person') ||
        phrase.includes('someone')
      );
      expect(hasHumanPhrase).toBe(true);
    });

    it('should contain human agent phrases in Hebrew', () => {
      // "נציג אנושי" = human representative
      const hasHumanPhrase = ESCALATION_TRIGGERS.he.some(phrase =>
        phrase.includes('נציג') || phrase.includes('אדם')
      );
      expect(hasHumanPhrase).toBe(true);
    });
  });

  describe('CLARIFICATION_PHRASES', () => {
    it('should have English clarification phrases', () => {
      expect(Array.isArray(CLARIFICATION_PHRASES.en)).toBe(true);
      expect(CLARIFICATION_PHRASES.en.length).toBeGreaterThan(0);
    });

    it('should have Hebrew clarification phrases', () => {
      expect(Array.isArray(CLARIFICATION_PHRASES.he)).toBe(true);
      expect(CLARIFICATION_PHRASES.he.length).toBeGreaterThan(0);
    });

    it('should contain clarification indicators', () => {
      const hasClarify = CLARIFICATION_PHRASES.en.some(phrase =>
        phrase.includes('clarify') || phrase.includes('more')
      );
      expect(hasClarify).toBe(true);
    });
  });

  describe('THRESHOLDS', () => {
    it('should have MAX_MESSAGE_LENGTH_FOR_ENDING', () => {
      expect(THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING).toBeDefined();
      expect(typeof THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING).toBe('number');
      expect(THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING).toBeGreaterThan(0);
    });

    it('should have reasonable max message length', () => {
      // Should be enough to contain common ending phrases but not too long
      expect(THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING).toBeGreaterThan(10);
      expect(THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING).toBeLessThan(200);
    });

    it('should have escalation detection thresholds', () => {
      expect(THRESHOLDS.MIN_MESSAGES_FOR_STUCK_DETECTION).toBeDefined();
      expect(THRESHOLDS.RECENT_MESSAGES_WINDOW).toBeDefined();
      expect(THRESHOLDS.CLARIFICATION_COUNT_THRESHOLD).toBeDefined();
    });

    it('should have rate limiting defaults', () => {
      expect(THRESHOLDS.DEFAULT_RATE_LIMIT_PER_MINUTE).toBeDefined();
      expect(THRESHOLDS.DEFAULT_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(0);
    });

    it('should have cache TTL values', () => {
      expect(THRESHOLDS.CONVERSATION_CACHE_TTL).toBeDefined();
      expect(THRESHOLDS.RESPONSE_CACHE_TTL).toBeDefined();
      expect(THRESHOLDS.SESSION_LOCK_TTL).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    describe('getEscalationTriggers', () => {
      it('should return English triggers by default', () => {
        const triggers = getEscalationTriggers();
        expect(triggers).toEqual(ESCALATION_TRIGGERS.en);
      });

      it('should return English triggers for "en"', () => {
        const triggers = getEscalationTriggers('en');
        expect(triggers).toEqual(ESCALATION_TRIGGERS.en);
      });

      it('should return Hebrew triggers for "he"', () => {
        const triggers = getEscalationTriggers('he');
        expect(triggers).toEqual(ESCALATION_TRIGGERS.he);
      });

      it('should fallback to English for unknown language', () => {
        const triggers = getEscalationTriggers('fr');
        expect(triggers).toEqual(ESCALATION_TRIGGERS.en);
      });
    });

    describe('getClarificationPhrases', () => {
      it('should return English phrases by default', () => {
        const phrases = getClarificationPhrases();
        expect(phrases).toEqual(CLARIFICATION_PHRASES.en);
      });

      it('should return Hebrew phrases for "he"', () => {
        const phrases = getClarificationPhrases('he');
        expect(phrases).toEqual(CLARIFICATION_PHRASES.he);
      });
    });

    describe('getAllEscalationTriggers', () => {
      it('should return combined triggers from all languages', () => {
        const all = getAllEscalationTriggers();
        expect(all.length).toBe(
          ESCALATION_TRIGGERS.en.length + ESCALATION_TRIGGERS.he.length
        );
      });
    });

    describe('getAllClarificationPhrases', () => {
      it('should return combined phrases from all languages', () => {
        const all = getAllClarificationPhrases();
        expect(all.length).toBe(
          CLARIFICATION_PHRASES.en.length + CLARIFICATION_PHRASES.he.length
        );
      });
    });
  });

  describe('No overlapping phrases', () => {
    it('should not have phrases in both STRONG and WEAK arrays', () => {
      const overlapping = STRONG_ENDING_PHRASES.filter(phrase =>
        WEAK_ENDING_PHRASES.includes(phrase)
      );
      expect(overlapping).toEqual([]);
    });
  });

  describe('Phrase uniqueness', () => {
    it('STRONG_ENDING_PHRASES should have no duplicates', () => {
      const unique = new Set(STRONG_ENDING_PHRASES);
      expect(unique.size).toBe(STRONG_ENDING_PHRASES.length);
    });

    it('WEAK_ENDING_PHRASES should have no duplicates', () => {
      const unique = new Set(WEAK_ENDING_PHRASES);
      expect(unique.size).toBe(WEAK_ENDING_PHRASES.length);
    });

    it('English escalation triggers should have no duplicates', () => {
      const unique = new Set(ESCALATION_TRIGGERS.en);
      expect(unique.size).toBe(ESCALATION_TRIGGERS.en.length);
    });

    it('Hebrew escalation triggers should have no duplicates', () => {
      const unique = new Set(ESCALATION_TRIGGERS.he);
      expect(unique.size).toBe(ESCALATION_TRIGGERS.he.length);
    });
  });
});
