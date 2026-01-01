import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '../../../src/models/Client.js';
import { db } from '../../../src/db.js';

// Mock database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

describe('Client Prompt Config CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePromptConfig', () => {
    it('should update client prompt config', async () => {
      const clientId = 1;
      const promptConfig = {
        reasoning_enabled: false,
        custom_instructions: 'Be extra helpful',
      };
      const mockResult = {
        rows: [{
          id: clientId,
          name: 'Test Client',
          prompt_config: promptConfig,
        }],
      };
      db.query.mockResolvedValue(mockResult);

      const result = await Client.updatePromptConfig(clientId, promptConfig);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clients SET prompt_config'),
        [JSON.stringify(promptConfig), clientId]
      );
      expect(result.prompt_config).toEqual(promptConfig);
    });

    it('should handle empty prompt config', async () => {
      const clientId = 1;
      const promptConfig = {};
      const mockResult = {
        rows: [{
          id: clientId,
          prompt_config: {},
        }],
      };
      db.query.mockResolvedValue(mockResult);

      const result = await Client.updatePromptConfig(clientId, promptConfig);
      expect(result.prompt_config).toEqual({});
    });

    it('should handle complex nested prompt config', async () => {
      const clientId = 1;
      const promptConfig = {
        reasoning_steps: [
          { title: 'UNDERSTAND', instruction: 'What is the customer asking?' },
          { title: 'RESPOND', instruction: 'Keep it brief' },
        ],
        response_style: {
          tone: 'professional',
          max_sentences: 3,
          formality: 'formal',
        },
        tool_rules: ['Rule 1', 'Rule 2'],
      };
      const mockResult = {
        rows: [{
          id: clientId,
          prompt_config: promptConfig,
        }],
      };
      db.query.mockResolvedValue(mockResult);

      const result = await Client.updatePromptConfig(clientId, promptConfig);
      expect(result.prompt_config.reasoning_steps).toHaveLength(2);
      expect(result.prompt_config.response_style.tone).toBe('professional');
    });

    it('should update updated_at timestamp', async () => {
      const clientId = 1;
      const promptConfig = { custom_instructions: 'Test' };
      db.query.mockResolvedValue({ rows: [{ id: clientId, prompt_config: promptConfig }] });

      await Client.updatePromptConfig(clientId, promptConfig);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('updated_at = NOW()');
    });
  });

  describe('Prompt Config CRUD via API routes', () => {
    // These tests would typically be integration tests, but we can test the model methods
    it('should support creating prompt config (via updatePromptConfig)', async () => {
      const clientId = 1;
      const newConfig = {
        reasoning_enabled: true,
        custom_instructions: 'New instructions',
      };
      db.query.mockResolvedValue({
        rows: [{ id: clientId, prompt_config: newConfig }],
      });

      const result = await Client.updatePromptConfig(clientId, newConfig);
      expect(result.prompt_config).toEqual(newConfig);
    });

    it('should support reading prompt config (via findById)', async () => {
      const clientId = 1;
      const promptConfig = {
        reasoning_enabled: false,
        custom_instructions: 'Existing instructions',
      };
      db.query.mockResolvedValue({
        rows: [{
          id: clientId,
          name: 'Test Client',
          prompt_config: promptConfig,
        }],
      });

      const client = await Client.findById(clientId);
      expect(client.prompt_config).toEqual(promptConfig);
    });

    it('should support updating prompt config (partial update)', async () => {
      const clientId = 1;
      // Note: updatePromptConfig replaces the entire config, it doesn't merge
      // So we test that it accepts a partial config object
      const partialUpdate = {
        custom_instructions: 'Updated instructions',
      };
      db.query.mockResolvedValue({
        rows: [{
          id: clientId,
          prompt_config: partialUpdate,
        }],
      });

      const result = await Client.updatePromptConfig(clientId, partialUpdate);
      expect(result.prompt_config.custom_instructions).toBe('Updated instructions');
      // The method replaces the config entirely, so only the provided fields exist
      expect(result.prompt_config).toEqual(partialUpdate);
    });

    it('should support deleting prompt config (via updatePromptConfig with empty object)', async () => {
      const clientId = 1;
      db.query.mockResolvedValue({
        rows: [{ id: clientId, prompt_config: {} }],
      });

      const result = await Client.updatePromptConfig(clientId, {});
      expect(result.prompt_config).toEqual({});
    });
  });

  describe('Prompt Config validation scenarios', () => {
    it('should handle null values in config', async () => {
      const clientId = 1;
      const promptConfig = {
        reasoning_enabled: null,
        custom_instructions: null,
      };
      db.query.mockResolvedValue({
        rows: [{ id: clientId, prompt_config: promptConfig }],
      });

      const result = await Client.updatePromptConfig(clientId, promptConfig);
      expect(result.prompt_config.reasoning_enabled).toBeNull();
    });

    it('should handle array values in config', async () => {
      const clientId = 1;
      const promptConfig = {
        tool_rules: ['Rule 1', 'Rule 2', 'Rule 3'],
        reasoning_steps: [
          { title: 'Step 1', instruction: 'Do this' },
          { title: 'Step 2', instruction: 'Do that' },
        ],
      };
      db.query.mockResolvedValue({
        rows: [{ id: clientId, prompt_config: promptConfig }],
      });

      const result = await Client.updatePromptConfig(clientId, promptConfig);
      expect(result.prompt_config.tool_rules).toHaveLength(3);
      expect(result.prompt_config.reasoning_steps).toHaveLength(2);
    });

    it('should preserve JSON structure when storing', async () => {
      const clientId = 1;
      const promptConfig = {
        nested: {
          deep: {
            value: 'test',
          },
        },
      };
      db.query.mockResolvedValue({
        rows: [{ id: clientId, prompt_config: promptConfig }],
      });

      await Client.updatePromptConfig(clientId, promptConfig);
      const queryArgs = db.query.mock.calls[0][1];
      const stringified = queryArgs[0];
      expect(typeof stringified).toBe('string');
      const parsed = JSON.parse(stringified);
      expect(parsed.nested.deep.value).toBe('test');
    });
  });
});

