import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformConfig } from '../../../src/models/PlatformConfig.js';

// Mock PlatformConfig
vi.mock('../../../src/models/PlatformConfig.js', () => ({
  PlatformConfig: {
    getDefaultPromptConfig: vi.fn(),
    setDefaultPromptConfig: vi.fn(),
    getHardcodedDefaults: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
const { default: promptService } = await import('../../../src/services/promptService.js');

describe('PromptService', () => {
  const defaultConfig = {
    reasoning_enabled: true,
    reasoning_steps: [
      { title: 'UNDERSTAND', instruction: 'What is the customer asking?' },
      { title: 'RESPOND', instruction: 'Keep it brief' },
    ],
    response_style: {
      tone: 'friendly',
      max_sentences: 2,
      formality: 'casual',
    },
    tool_rules: ['Rule 1', 'Rule 2'],
    intro_template: 'You are a friendly assistant for {client_name}.',
    tone_instructions: {
      friendly: 'Be warm and approachable',
      professional: 'Be formal and courteous',
    },
    formality_instructions: {
      casual: 'Use casual language',
      formal: 'Use formal language',
    },
    tool_format_template: 'USE_TOOL: tool_name\nPARAMETERS: {"key": "value"}',
    tool_result_instruction: 'Summarize results naturally',
    custom_instructions: null,
    language_names: {
      es: 'Spanish',
      fr: 'French',
    },
    language_instruction_template: 'You MUST respond in {language_name}.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    promptService.clearCache();
    promptService.defaultConfig = null;
    PlatformConfig.getDefaultPromptConfig.mockResolvedValue(defaultConfig);
    PlatformConfig.getHardcodedDefaults.mockReturnValue(defaultConfig);
  });

  describe('initialize', () => {
    it('should load default config from database', async () => {
      await promptService.initialize();
      expect(PlatformConfig.getDefaultPromptConfig).toHaveBeenCalled();
      expect(promptService.defaultConfig).toEqual(defaultConfig);
    });

    it('should fall back to hardcoded defaults on error', async () => {
      PlatformConfig.getDefaultPromptConfig.mockRejectedValue(new Error('DB error'));
      await promptService.initialize();
      expect(PlatformConfig.getHardcodedDefaults).toHaveBeenCalled();
      expect(promptService.defaultConfig).toEqual(defaultConfig);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default config', async () => {
      const config = await promptService.getDefaultConfig();
      expect(config).toEqual(defaultConfig);
      expect(PlatformConfig.getDefaultPromptConfig).toHaveBeenCalled();
    });

    it('should initialize if config is null', async () => {
      promptService.defaultConfig = null;
      const config = await promptService.getDefaultConfig();
      expect(config).toEqual(defaultConfig);
    });
  });

  describe('getClientConfig', () => {
    it('should return default config when client has no custom config', async () => {
      const client = { id: 1, name: 'Test Client', prompt_config: {} };
      const config = await promptService.getClientConfig(client);
      expect(config).toEqual(defaultConfig);
    });

    it('should return default config when client has null prompt_config', async () => {
      const client = { id: 1, name: 'Test Client', prompt_config: null };
      const config = await promptService.getClientConfig(client);
      expect(config).toEqual(defaultConfig);
    });

    it('should merge client config with defaults', async () => {
      const client = {
        id: 1,
        name: 'Test Client',
        prompt_config: {
          response_style: {
            tone: 'professional',
            max_sentences: 3,
          },
          custom_instructions: 'Be extra helpful',
        },
      };
      const config = await promptService.getClientConfig(client);
      expect(config.response_style.tone).toBe('professional');
      expect(config.response_style.max_sentences).toBe(3);
      expect(config.response_style.formality).toBe('casual'); // From defaults
      expect(config.custom_instructions).toBe('Be extra helpful');
      expect(config.reasoning_enabled).toBe(true); // From defaults
    });

    it('should initialize if default config is null', async () => {
      promptService.defaultConfig = null;
      const client = { id: 1, name: 'Test Client', prompt_config: {} };
      await promptService.getClientConfig(client);
      expect(PlatformConfig.getDefaultPromptConfig).toHaveBeenCalled();
    });
  });

  describe('mergeConfigs', () => {
    it('should merge nested objects', () => {
      const parent = {
        a: 1,
        nested: { x: 1, y: 2 },
      };
      const child = {
        nested: { y: 3, z: 4 },
      };
      const merged = promptService.mergeConfigs(parent, child);
      expect(merged).toEqual({
        a: 1,
        nested: { x: 1, y: 3, z: 4 },
      });
    });

    it('should replace arrays entirely', () => {
      const parent = {
        items: [1, 2, 3],
      };
      const child = {
        items: [4, 5],
      };
      const merged = promptService.mergeConfigs(parent, child);
      expect(merged.items).toEqual([4, 5]);
    });

    it('should replace primitive values', () => {
      const parent = {
        value: 'old',
        number: 10,
      };
      const child = {
        value: 'new',
        number: 20,
      };
      const merged = promptService.mergeConfigs(parent, child);
      expect(merged.value).toBe('new');
      expect(merged.number).toBe(20);
    });

    it('should skip null and undefined values', () => {
      const parent = {
        value: 'keep',
      };
      const child = {
        value: null,
        other: undefined,
      };
      const merged = promptService.mergeConfigs(parent, child);
      expect(merged.value).toBe('keep');
      expect(merged.other).toBeUndefined();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build prompt with client name', async () => {
      const client = { id: 1, name: 'Pizza Shop', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('Pizza Shop');
      expect(prompt).toContain('You are a friendly assistant for Pizza Shop');
    });

    it('should include reasoning steps when enabled', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('YOUR REASONING PROCESS');
      expect(prompt).toContain('UNDERSTAND');
      expect(prompt).toContain('RESPOND');
    });

    it('should not include reasoning steps when disabled', async () => {
      const client = {
        id: 1,
        name: 'Test',
        language: 'en',
        prompt_config: { reasoning_enabled: false },
      };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).not.toContain('YOUR REASONING PROCESS');
    });

    it('should include response style instructions', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('RESPONSE STYLE');
      expect(prompt).toContain('Be warm and approachable');
      expect(prompt).toContain('Keep responses to 2 sentence(s) maximum');
    });

    it('should include tool rules', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('TOOL USAGE RULES');
      expect(prompt).toContain('Rule 1');
      expect(prompt).toContain('Rule 2');
    });

    it('should include tool format template', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('TOOL FORMAT');
      expect(prompt).toContain('USE_TOOL: tool_name');
    });

    it('should include tool result instruction', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('AFTER RECEIVING TOOL RESULTS');
      expect(prompt).toContain('Summarize results naturally');
    });

    it('should include custom instructions when provided', async () => {
      const client = {
        id: 1,
        name: 'Test',
        language: 'en',
        prompt_config: { custom_instructions: 'Always be polite' },
      };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('ADDITIONAL INSTRUCTIONS');
      expect(prompt).toContain('Always be polite');
    });

    it('should include language instruction for non-English', async () => {
      const client = { id: 1, name: 'Test', language: 'es' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).toContain('LANGUAGE REQUIREMENT');
      expect(prompt).toContain('Spanish');
      expect(prompt).toContain('You MUST respond in Spanish');
    });

    it('should not include language instruction for English', async () => {
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client);
      expect(prompt).not.toContain('LANGUAGE REQUIREMENT');
    });

    it('should use provided config instead of fetching', async () => {
      const customConfig = {
        ...defaultConfig,
        intro_template: 'Custom intro for {client_name}',
      };
      const client = { id: 1, name: 'Test', language: 'en' };
      const prompt = await promptService.buildSystemPrompt(client, customConfig);
      expect(prompt).toContain('Custom intro for Test');
      expect(PlatformConfig.getDefaultPromptConfig).not.toHaveBeenCalled();
    });
  });

  describe('getToolGuidance', () => {
    it('should return tool guidance from config', async () => {
      const guidance = await promptService.getToolGuidance();
      expect(typeof guidance).toBe('string');
    });

    it('should return default guidance if not in config', async () => {
      PlatformConfig.getDefaultPromptConfig.mockResolvedValue({});
      const guidance = await promptService.getToolGuidance();
      expect(guidance).toContain('BEFORE CALLING');
    });
  });

  describe('refreshDefaultConfig', () => {
    it('should refresh default config from database', async () => {
      const newConfig = { ...defaultConfig, reasoning_enabled: false };
      PlatformConfig.getDefaultPromptConfig.mockResolvedValue(newConfig);
      await promptService.refreshDefaultConfig();
      expect(promptService.defaultConfig).toEqual(newConfig);
    });

    it('should handle errors gracefully', async () => {
      PlatformConfig.getDefaultPromptConfig.mockRejectedValue(new Error('DB error'));
      await expect(promptService.refreshDefaultConfig()).resolves.not.toThrow();
    });
  });

  describe('updateDefaultConfig', () => {
    it('should update default config', async () => {
      const newConfig = { ...defaultConfig, reasoning_enabled: false };
      PlatformConfig.setDefaultPromptConfig.mockResolvedValue(newConfig);
      await promptService.updateDefaultConfig(newConfig);
      expect(PlatformConfig.setDefaultPromptConfig).toHaveBeenCalledWith(newConfig);
      expect(promptService.defaultConfig).toEqual(newConfig);
    });
  });

  describe('clearCache', () => {
    it('should clear client config cache', () => {
      promptService.clientConfigCache.set('client1', {});
      promptService.clientConfigCache.set('client2', {});
      expect(promptService.clientConfigCache.size).toBe(2);
      promptService.clearCache();
      expect(promptService.clientConfigCache.size).toBe(0);
    });
  });
});

