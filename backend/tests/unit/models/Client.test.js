import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { Client } = await import('../../../src/models/Client.js');

describe('Client Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate API key with csai_ prefix', () => {
      const apiKey = Client.generateApiKey();

      expect(apiKey).toMatch(/^csai_[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = Client.generateApiKey();
      const key2 = Client.generateApiKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('generateAccessCode', () => {
    it('should generate access code in ABC123 format', () => {
      const code = Client.generateAccessCode();

      // 3 uppercase letters followed by 3 digits
      expect(code).toMatch(/^[A-Z]{3}[0-9]{3}$/);
    });

    it('should generate unique codes', () => {
      const code1 = Client.generateAccessCode();
      const code2 = Client.generateAccessCode();

      // While technically could be the same, probability is very low
      // Run multiple times to verify randomness
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(Client.generateAccessCode());
      }
      // Should have mostly unique codes
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('create', () => {
    it('should create a client with minimal fields', async () => {
      const mockClient = {
        id: 1,
        name: 'Test Client',
        domain: 'test.com',
        api_key: 'csai_abc123',
        plan_type: 'free',
        status: 'active',
      };

      db.query.mockResolvedValueOnce({ rows: [mockClient] });

      const result = await Client.create('Test Client', 'test.com');

      expect(db.query).toHaveBeenCalledOnce();
      expect(result).toEqual(mockClient);
    });

    it('should create a client with all fields', async () => {
      const mockClient = {
        id: 1,
        name: 'Test Client',
        domain: 'test.com',
        api_key: 'csai_abc123',
        plan_type: 'pro',
        email: 'test@test.com',
        llm_provider: 'claude',
        model_name: 'claude-3',
        system_prompt: 'Custom prompt',
        status: 'active',
        widget_config: { primaryColor: '#000' },
      };

      db.query.mockResolvedValueOnce({ rows: [mockClient] });

      const result = await Client.create(
        'Test Client',
        'test.com',
        'pro',
        'test@test.com',
        'claude',
        'claude-3',
        'Custom prompt',
        'active',
        { primaryColor: '#000' }
      );

      expect(result).toEqual(mockClient);
      // Verify widget_config is JSON stringified
      const params = db.query.mock.calls[0][1];
      expect(params).toContain(JSON.stringify({ primaryColor: '#000' }));
    });

    it('should use default values when not provided', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, plan_type: 'free', status: 'active' }],
      });

      await Client.create('Test', 'test.com');

      const params = db.query.mock.calls[0][1];
      expect(params[3]).toBe('free'); // plan_type default
      expect(params[5]).toBe('ollama'); // llm_provider default
      expect(params[8]).toBe('active'); // status default
    });
  });

  describe('findById', () => {
    it('should return client when found', async () => {
      const mockClient = { id: 1, name: 'Test Client' };
      db.query.mockResolvedValueOnce({ rows: [mockClient] });

      const result = await Client.findById(1);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM clients WHERE id = $1', [1]);
      expect(result).toEqual(mockClient);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Client.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByApiKey', () => {
    it('should return active client when found', async () => {
      const mockClient = { id: 1, api_key: 'csai_abc', status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockClient] });

      const result = await Client.findByApiKey('csai_abc');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE api_key = $1 AND status = $2',
        ['csai_abc', 'active']
      );
      expect(result).toEqual(mockClient);
    });

    it('should return null for inactive client', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Client.findByApiKey('csai_inactive');

      expect(result).toBeNull();
    });
  });

  describe('findByAccessCode', () => {
    it('should return active client when found', async () => {
      const mockClient = { id: 1, access_code: 'ABC123', status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockClient] });

      const result = await Client.findByAccessCode('ABC123');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE access_code = $1 AND status = $2',
        ['ABC123', 'active']
      );
      expect(result).toEqual(mockClient);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Client.findByAccessCode('XXX999');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all clients with default pagination', async () => {
      const mockClients = [
        { id: 1, name: 'Client 1' },
        { id: 2, name: 'Client 2' },
      ];
      db.query.mockResolvedValueOnce({ rows: mockClients });

      const result = await Client.findAll();

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM clients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [100, 0]
      );
      expect(result).toEqual(mockClients);
    });

    it('should respect custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Client.findAll(10, 5);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 5]
      );
    });
  });

  describe('update', () => {
    it('should update simple fields', async () => {
      const mockUpdated = { id: 1, name: 'Updated Name' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.update(1, { name: 'Updated Name' });

      expect(result).toEqual(mockUpdated);
    });

    it('should update multiple fields', async () => {
      const mockUpdated = { id: 1, name: 'New Name', domain: 'new.com' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.update(1, {
        name: 'New Name',
        domain: 'new.com',
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should handle JSONB fields properly', async () => {
      const mockUpdated = { id: 1, widget_config: { color: 'blue' } };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.update(1, {
        widget_config: { color: 'blue' },
      });

      // Verify JSONB field is JSON stringified
      const params = db.query.mock.calls[0][1];
      expect(params[0]).toBe(JSON.stringify({ color: 'blue' }));
      expect(result).toEqual(mockUpdated);
    });

    it('should throw error for oversized JSONB fields', async () => {
      // Create an object larger than 1MB
      const largeObject = { data: 'x'.repeat(1024 * 1024 + 1) };

      await expect(
        Client.update(1, { widget_config: largeObject })
      ).rejects.toThrow('exceeds maximum size');
    });

    it('should throw error for deeply nested JSONB fields', async () => {
      // Create deeply nested object
      let deepObject = { value: 'test' };
      for (let i = 0; i < 15; i++) {
        deepObject = { nested: deepObject };
      }

      await expect(
        Client.update(1, { widget_config: deepObject })
      ).rejects.toThrow('exceeds maximum nesting depth');
    });

    it('should throw error when no valid fields provided', async () => {
      await expect(
        Client.update(1, { invalid_field: 'value' })
      ).rejects.toThrow('No valid fields to update');
    });

    it('should update language field', async () => {
      const mockUpdated = { id: 1, language: 'he' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.update(1, { language: 'he' });

      expect(result.language).toBe('he');
    });

    it('should update escalation_config JSONB field', async () => {
      const config = { email: 'support@test.com', enabled: true };
      const mockUpdated = { id: 1, escalation_config: config };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.update(1, { escalation_config: config });

      expect(result.escalation_config).toEqual(config);
    });
  });

  describe('deactivate', () => {
    it('should set client status to inactive', async () => {
      const mockDeactivated = { id: 1, status: 'inactive' };
      db.query.mockResolvedValueOnce({ rows: [mockDeactivated] });

      const result = await Client.deactivate(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'inactive'"),
        [1]
      );
      expect(result.status).toBe('inactive');
    });
  });

  describe('delete', () => {
    it('should hard delete and return client', async () => {
      const mockDeleted = { id: 1, name: 'Deleted Client' };
      db.query.mockResolvedValueOnce({ rows: [mockDeleted] });

      const result = await Client.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM clients WHERE id = $1 RETURNING *',
        [1]
      );
      expect(result).toEqual(mockDeleted);
    });
  });

  describe('regenerateApiKey', () => {
    it('should generate new API key', async () => {
      const mockUpdated = { id: 1, api_key: 'csai_newapikey123' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.regenerateApiKey(1);

      expect(result.api_key).toMatch(/^csai_/);
      const query = db.query.mock.calls[0][0];
      expect(query).toContain('api_key = $1');
    });
  });

  describe('updateApiKey', () => {
    it('should set specific API key', async () => {
      const mockUpdated = { id: 1, api_key: 'csai_custom_key' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.updateApiKey(1, 'csai_custom_key');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('api_key = $1'),
        ['csai_custom_key', 1]
      );
      expect(result.api_key).toBe('csai_custom_key');
    });
  });

  describe('updatePromptConfig', () => {
    it('should update prompt configuration', async () => {
      const promptConfig = {
        temperature: 0.7,
        maxTokens: 2000,
      };
      const mockUpdated = { id: 1, prompt_config: promptConfig };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.updatePromptConfig(1, promptConfig);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('prompt_config = $1::jsonb'),
        [JSON.stringify(promptConfig), 1]
      );
      expect(result.prompt_config).toEqual(promptConfig);
    });
  });

  describe('getCountByPlan', () => {
    it('should return count grouped by plan type', async () => {
      const mockCounts = [
        { plan_type: 'free', count: '10' },
        { plan_type: 'pro', count: '5' },
        { plan_type: 'enterprise', count: '2' },
      ];
      db.query.mockResolvedValueOnce({ rows: mockCounts });

      const result = await Client.getCountByPlan();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY plan_type')
      );
      expect(result).toEqual(mockCounts);
    });

    it('should only count active clients', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Client.getCountByPlan();

      const query = db.query.mock.calls[0][0];
      expect(query).toContain("status = 'active'");
    });
  });

  describe('regenerateAccessCode', () => {
    it('should generate new access code', async () => {
      const mockUpdated = { id: 1, access_code: 'XYZ789' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.regenerateAccessCode(1);

      expect(result.access_code).toMatch(/^[A-Z]{3}[0-9]{3}$/);
    });

    it('should retry on unique constraint violation', async () => {
      // First attempt fails with unique violation
      const uniqueError = new Error('Unique violation');
      uniqueError.code = '23505';

      // Second attempt succeeds
      const mockUpdated = { id: 1, access_code: 'ABC456' };

      db.query
        .mockRejectedValueOnce(uniqueError)
        .mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await Client.regenerateAccessCode(1);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(result.access_code).toBe('ABC456');
    });

    it('should throw after max attempts', async () => {
      const uniqueError = new Error('Unique violation');
      uniqueError.code = '23505';

      // All 10 attempts fail
      for (let i = 0; i < 10; i++) {
        db.query.mockRejectedValueOnce(uniqueError);
      }

      await expect(Client.regenerateAccessCode(1)).rejects.toThrow(
        'Failed to generate unique access code'
      );
    });

    it('should rethrow non-unique-constraint errors', async () => {
      const otherError = new Error('Database connection error');
      otherError.code = '08001';

      db.query.mockRejectedValueOnce(otherError);

      await expect(Client.regenerateAccessCode(1)).rejects.toThrow(
        'Database connection error'
      );
    });
  });
});
