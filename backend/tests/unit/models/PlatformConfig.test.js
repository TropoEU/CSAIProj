import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformConfig } from '../../../src/models/PlatformConfig.js';
import { db } from '../../../src/db.js';

// Mock database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

describe('PlatformConfig Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should get a config value by key', async () => {
      const mockValue = { setting: 'value' };
      db.query.mockResolvedValue({
        rows: [{ value: mockValue }],
      });

      const result = await PlatformConfig.get('test_key');
      expect(result).toEqual(mockValue);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT value FROM platform_config WHERE key = $1',
        ['test_key']
      );
    });

    it('should return null when key does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PlatformConfig.get('non_existent_key');
      expect(result).toBeNull();
    });

    it('should return null when value is null', async () => {
      db.query.mockResolvedValue({
        rows: [{ value: null }],
      });

      const result = await PlatformConfig.get('test_key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a config value', async () => {
      const key = 'test_key';
      const value = { setting: 'value' };
      const mockResult = {
        rows: [{ key, value: JSON.stringify(value) }],
      };
      db.query.mockResolvedValue(mockResult);

      const result = await PlatformConfig.set(key, value);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO platform_config'),
        [key, JSON.stringify(value)]
      );
      expect(result.key).toBe(key);
    });

    it('should update existing config on conflict', async () => {
      const key = 'existing_key';
      const newValue = { setting: 'new_value' };
      db.query.mockResolvedValue({
        rows: [{ key, value: JSON.stringify(newValue) }],
      });

      await PlatformConfig.set(key, newValue);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE');
    });

    it('should update updated_at timestamp', async () => {
      const key = 'test_key';
      const value = { setting: 'value' };
      db.query.mockResolvedValue({
        rows: [{ key, value: JSON.stringify(value) }],
      });

      await PlatformConfig.set(key, value);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('updated_at');
    });

    it('should handle complex nested objects', async () => {
      const key = 'complex_config';
      const value = {
        nested: {
          deep: {
            array: [1, 2, 3],
            value: 'test',
          },
        },
      };
      db.query.mockResolvedValue({
        rows: [{ key, value: JSON.stringify(value) }],
      });

      const result = await PlatformConfig.set(key, value);
      const queryArgs = db.query.mock.calls[0][1];
      const stringified = queryArgs[1];
      expect(typeof stringified).toBe('string');
      const parsed = JSON.parse(stringified);
      expect(parsed.nested.deep.value).toBe('test');
    });
  });

  describe('delete', () => {
    it('should delete a config value', async () => {
      const key = 'test_key';
      db.query.mockResolvedValue({
        rows: [{ key }],
      });

      const result = await PlatformConfig.delete(key);
      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM platform_config WHERE key = $1 RETURNING key',
        [key]
      );
    });

    it('should return false when key does not exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PlatformConfig.delete('non_existent_key');
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should get all config values', async () => {
      const mockRows = [
        { key: 'key1', value: { setting1: 'value1' } },
        { key: 'key2', value: { setting2: 'value2' } },
      ];
      db.query.mockResolvedValue({ rows: mockRows });

      const result = await PlatformConfig.getAll();
      expect(result).toEqual({
        key1: { setting1: 'value1' },
        key2: { setting2: 'value2' },
      });
      expect(db.query).toHaveBeenCalledWith('SELECT key, value FROM platform_config');
    });

    it('should return empty object when no configs exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PlatformConfig.getAll();
      expect(result).toEqual({});
    });
  });

  describe('Platform Email Methods', () => {
    describe('getPlatformEmail', () => {
      it('should get platform email configuration', async () => {
        const emailConfig = {
          email: 'support@example.com',
          accessToken: 'token123',
          refreshToken: 'refresh123',
        };
        db.query.mockResolvedValue({
          rows: [{ value: emailConfig }],
        });

        const result = await PlatformConfig.getPlatformEmail();
        expect(result).toEqual(emailConfig);
        expect(db.query).toHaveBeenCalledWith(
          'SELECT value FROM platform_config WHERE key = $1',
          ['platform_email']
        );
      });

      it('should return null when email not configured', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await PlatformConfig.getPlatformEmail();
        expect(result).toBeNull();
      });
    });

    describe('setPlatformEmail', () => {
      it('should set platform email configuration', async () => {
        const email = 'support@example.com';
        const accessToken = 'token123';
        const refreshToken = 'refresh123';
        const mockResult = {
          rows: [{
            key: 'platform_email',
            value: JSON.stringify({
              email,
              accessToken,
              refreshToken,
              configuredAt: expect.any(String),
            }),
          }],
        };
        db.query.mockResolvedValue(mockResult);

        const result = await PlatformConfig.setPlatformEmail(email, accessToken, refreshToken);
        expect(db.query).toHaveBeenCalled();
        const queryArgs = db.query.mock.calls[0][1];
        const config = JSON.parse(queryArgs[1]);
        expect(config.email).toBe(email);
        expect(config.accessToken).toBe(accessToken);
        expect(config.refreshToken).toBe(refreshToken);
        expect(config.configuredAt).toBeDefined();
      });
    });

    describe('updatePlatformEmailTokens', () => {
      it('should update access token', async () => {
        const existingConfig = {
          email: 'support@example.com',
          accessToken: 'old_token',
          refreshToken: 'refresh123',
        };
        const newAccessToken = 'new_token';

        db.query
          .mockResolvedValueOnce({ rows: [{ value: existingConfig }] }) // getPlatformEmail
          .mockResolvedValueOnce({ rows: [{ key: 'platform_email', value: JSON.stringify({}) }] }); // set

        const result = await PlatformConfig.updatePlatformEmailTokens(newAccessToken);
        expect(db.query).toHaveBeenCalledTimes(2);
        const setCallArgs = db.query.mock.calls[1][1];
        const updatedConfig = JSON.parse(setCallArgs[1]);
        expect(updatedConfig.accessToken).toBe(newAccessToken);
        expect(updatedConfig.refreshToken).toBe('refresh123'); // Preserved
        expect(updatedConfig.lastRefreshed).toBeDefined();
      });

      it('should update both access and refresh tokens', async () => {
        const existingConfig = {
          email: 'support@example.com',
          accessToken: 'old_token',
          refreshToken: 'old_refresh',
        };
        const newAccessToken = 'new_token';
        const newRefreshToken = 'new_refresh';

        db.query
          .mockResolvedValueOnce({ rows: [{ value: existingConfig }] })
          .mockResolvedValueOnce({ rows: [{ key: 'platform_email', value: JSON.stringify({}) }] });

        await PlatformConfig.updatePlatformEmailTokens(newAccessToken, newRefreshToken);
        const setCallArgs = db.query.mock.calls[1][1];
        const updatedConfig = JSON.parse(setCallArgs[1]);
        expect(updatedConfig.accessToken).toBe(newAccessToken);
        expect(updatedConfig.refreshToken).toBe(newRefreshToken);
      });

      it('should return null when email not configured', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await PlatformConfig.updatePlatformEmailTokens('new_token');
        expect(result).toBeNull();
        expect(db.query).toHaveBeenCalledTimes(1); // Only getPlatformEmail, no set
      });
    });

    describe('deletePlatformEmail', () => {
      it('should delete platform email configuration', async () => {
        db.query.mockResolvedValue({
          rows: [{ key: 'platform_email' }],
        });

        const result = await PlatformConfig.deletePlatformEmail();
        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          'DELETE FROM platform_config WHERE key = $1 RETURNING key',
          ['platform_email']
        );
      });
    });
  });

  describe('Prompt Configuration Methods', () => {
    describe('getDefaultPromptConfig', () => {
      it('should get default prompt config from database', async () => {
        const promptConfig = {
          reasoning_enabled: true,
          reasoning_steps: [],
        };
        db.query.mockResolvedValue({
          rows: [{ value: promptConfig }],
        });

        const result = await PlatformConfig.getDefaultPromptConfig();
        expect(result).toEqual(promptConfig);
        expect(db.query).toHaveBeenCalledWith(
          'SELECT value FROM platform_config WHERE key = $1',
          ['default_prompt_config']
        );
      });

      it('should return hardcoded defaults when config not in database', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await PlatformConfig.getDefaultPromptConfig();
        expect(result).toBeDefined();
        expect(result.reasoning_enabled).toBe(true);
        expect(result.reasoning_steps).toBeDefined();
        expect(Array.isArray(result.reasoning_steps)).toBe(true);
      });

      it('should return hardcoded defaults when config is null', async () => {
        db.query.mockResolvedValue({
          rows: [{ value: null }],
        });

        const result = await PlatformConfig.getDefaultPromptConfig();
        expect(result).toBeDefined();
        expect(result.reasoning_enabled).toBe(true);
      });
    });

    describe('setDefaultPromptConfig', () => {
      it('should set default prompt configuration', async () => {
        const promptConfig = {
          reasoning_enabled: true,
          reasoning_steps: [
            { title: 'UNDERSTAND', instruction: 'What is the customer asking?' },
          ],
          response_style: {
            tone: 'friendly',
            max_sentences: 2,
          },
        };
        db.query.mockResolvedValue({
          rows: [{
            key: 'default_prompt_config',
            value: JSON.stringify(promptConfig),
          }],
        });

        const result = await PlatformConfig.setDefaultPromptConfig(promptConfig);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO platform_config'),
          ['default_prompt_config', JSON.stringify(promptConfig)]
        );
      });

      it('should handle complex prompt config structure', async () => {
        const promptConfig = {
          reasoning_enabled: true,
          reasoning_steps: [
            { title: 'Step 1', instruction: 'Do this' },
            { title: 'Step 2', instruction: 'Do that' },
          ],
          tool_rules: ['Rule 1', 'Rule 2'],
          response_style: {
            tone: 'professional',
            formality: 'formal',
            max_sentences: 3,
          },
        };
        db.query.mockResolvedValue({
          rows: [{ key: 'default_prompt_config', value: JSON.stringify(promptConfig) }],
        });

        const result = await PlatformConfig.setDefaultPromptConfig(promptConfig);
        const queryArgs = db.query.mock.calls[0][1];
        const stored = JSON.parse(queryArgs[1]);
        expect(stored.reasoning_steps).toHaveLength(2);
        expect(stored.tool_rules).toHaveLength(2);
      });
    });

    describe('getHardcodedDefaults', () => {
      it('should return hardcoded default prompt config', () => {
        const defaults = PlatformConfig.getHardcodedDefaults();

        expect(defaults).toBeDefined();
        expect(defaults.reasoning_enabled).toBe(true);
        expect(Array.isArray(defaults.reasoning_steps)).toBe(true);
        expect(defaults.reasoning_steps.length).toBeGreaterThan(0);
        expect(defaults.reasoning_steps[0]).toHaveProperty('title');
        expect(defaults.reasoning_steps[0]).toHaveProperty('instruction');
        expect(defaults.response_style).toBeDefined();
        expect(defaults.response_style.tone).toBe('friendly');
        expect(defaults.response_style.max_sentences).toBe(2);
        expect(Array.isArray(defaults.tool_rules)).toBe(true);
        expect(defaults.tool_rules.length).toBeGreaterThan(0);
      });

      it('should have all required default fields', () => {
        const defaults = PlatformConfig.getHardcodedDefaults();

        expect(defaults).toHaveProperty('reasoning_enabled');
        expect(defaults).toHaveProperty('reasoning_steps');
        expect(defaults).toHaveProperty('response_style');
        expect(defaults).toHaveProperty('tool_rules');
        expect(defaults).toHaveProperty('custom_instructions');
        expect(defaults).toHaveProperty('greeting_enabled');
        expect(defaults).toHaveProperty('greeting_message');
      });

      it('should have valid reasoning steps structure', () => {
        const defaults = PlatformConfig.getHardcodedDefaults();

        defaults.reasoning_steps.forEach((step) => {
          expect(step).toHaveProperty('title');
          expect(step).toHaveProperty('instruction');
          expect(typeof step.title).toBe('string');
          expect(typeof step.instruction).toBe('string');
        });
      });

      it('should have valid response style structure', () => {
        const defaults = PlatformConfig.getHardcodedDefaults();

        expect(defaults.response_style).toHaveProperty('tone');
        expect(defaults.response_style).toHaveProperty('max_sentences');
        expect(defaults.response_style).toHaveProperty('formality');
        expect(typeof defaults.response_style.tone).toBe('string');
        expect(typeof defaults.response_style.max_sentences).toBe('number');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string keys', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await PlatformConfig.get('');
      expect(result).toBeNull();
    });

    it('should handle special characters in keys', async () => {
      const key = 'test_key_with-special.chars';
      db.query.mockResolvedValue({ rows: [{ value: { test: 'value' } }] });
      const result = await PlatformConfig.get(key);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT value FROM platform_config WHERE key = $1',
        [key]
      );
    });

    it('should handle very large config values', async () => {
      const largeConfig = {
        data: 'x'.repeat(10000),
        nested: {
          array: Array(1000).fill({ value: 'test' }),
        },
      };
      db.query.mockResolvedValue({
        rows: [{ key: 'large_config', value: JSON.stringify(largeConfig) }],
      });

      const result = await PlatformConfig.set('large_config', largeConfig);
      const queryArgs = db.query.mock.calls[0][1];
      const stored = JSON.parse(queryArgs[1]);
      expect(stored.data.length).toBe(10000);
      expect(stored.nested.array.length).toBe(1000);
    });

    it('should handle concurrent updates (ON CONFLICT)', async () => {
      const key = 'concurrent_key';
      const value1 = { version: 1 };
      const value2 = { version: 2 };

      db.query
        .mockResolvedValueOnce({ rows: [{ key, value: JSON.stringify(value1) }] })
        .mockResolvedValueOnce({ rows: [{ key, value: JSON.stringify(value2) }] });

      await PlatformConfig.set(key, value1);
      await PlatformConfig.set(key, value2);

      // Both calls should use ON CONFLICT
      expect(db.query).toHaveBeenCalledTimes(2);
      const query1 = db.query.mock.calls[0][0];
      const query2 = db.query.mock.calls[1][0];
      expect(query1).toContain('ON CONFLICT');
      expect(query2).toContain('ON CONFLICT');
    });
  });
});

