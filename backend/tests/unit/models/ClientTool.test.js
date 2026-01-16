import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { ClientTool } = await import('../../../src/models/ClientTool.js');

describe('ClientTool Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enable', () => {
    it('should enable a tool for a client with webhook URL', async () => {
      const mockClientTool = {
        id: 1,
        client_id: 1,
        tool_id: 10,
        enabled: true,
        n8n_webhook_url: 'http://localhost:5678/webhook/test',
        integration_mapping: {},
      };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      const result = await ClientTool.enable(1, 10, 'http://localhost:5678/webhook/test');

      expect(db.query).toHaveBeenCalledOnce();
      expect(result).toEqual(mockClientTool);
    });

    it('should enable a tool with integration mapping as object', async () => {
      const integrationMapping = { order_api: 5, email_api: 8 };
      const mockClientTool = {
        id: 1,
        client_id: 1,
        tool_id: 10,
        integration_mapping: integrationMapping,
      };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      const result = await ClientTool.enable(
        1,
        10,
        'http://localhost:5678/webhook/test',
        integrationMapping
      );

      // Verify integration_mapping is JSON stringified
      const params = db.query.mock.calls[0][1];
      expect(params[3]).toBe(JSON.stringify(integrationMapping));
      expect(result).toEqual(mockClientTool);
    });

    it('should enable a tool with integration mapping as string', async () => {
      const integrationMapping = '{"order_api": 5}';
      const mockClientTool = {
        id: 1,
        integration_mapping: { order_api: 5 },
      };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      await ClientTool.enable(
        1,
        10,
        'http://localhost:5678/webhook/test',
        integrationMapping
      );

      const params = db.query.mock.calls[0][1];
      expect(params[3]).toBe(integrationMapping);
    });

    it('should use empty object for null integration mapping', async () => {
      const mockClientTool = { id: 1, integration_mapping: {} };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      await ClientTool.enable(1, 10, 'http://localhost:5678/webhook/test', null);

      const params = db.query.mock.calls[0][1];
      expect(params[3]).toBe('{}');
    });

    it('should handle custom config', async () => {
      const customConfig = { timeout: 30000 };
      const mockClientTool = { id: 1, custom_config: customConfig };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      await ClientTool.enable(1, 10, 'http://localhost:5678/webhook/test', null, customConfig);

      const params = db.query.mock.calls[0][1];
      expect(params[4]).toEqual(customConfig);
    });
  });

  describe('disable', () => {
    it('should disable a tool for a client', async () => {
      const mockClientTool = { id: 1, client_id: 1, tool_id: 10, enabled: false };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      const result = await ClientTool.disable(1, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('enabled = false'),
        [1, 10]
      );
      expect(result.enabled).toBe(false);
    });
  });

  describe('getEnabledTools', () => {
    it('should return all enabled tools for a client', async () => {
      const mockTools = [
        { id: 1, tool_name: 'tool_a', enabled: true },
        { id: 2, tool_name: 'tool_b', enabled: true },
      ];

      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await ClientTool.getEnabledTools(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ct.enabled = true'),
        [1]
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no tools enabled', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ClientTool.getEnabledTools(999);

      expect(result).toEqual([]);
    });

    it('should include tool details from join', async () => {
      const mockTools = [
        {
          id: 1,
          tool_name: 'get_order_status',
          description: 'Get order status',
          parameters_schema: { type: 'object' },
          category: 'orders',
          required_integrations: [{ key: 'order_api' }],
          capabilities: ['track orders'],
          is_destructive: false,
          requires_confirmation: false,
          max_confidence: 7,
        },
      ];

      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await ClientTool.getEnabledTools(1);

      expect(result[0].tool_name).toBe('get_order_status');
      expect(result[0].is_destructive).toBe(false);
    });
  });

  describe('getAllTools', () => {
    it('should return all tools for a client (enabled and disabled)', async () => {
      const mockTools = [
        { id: 1, tool_name: 'tool_a', enabled: true },
        { id: 2, tool_name: 'tool_b', enabled: false },
      ];

      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await ClientTool.getAllTools(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ct.client_id = $1'),
        [1]
      );
      // Should not filter by enabled
      const query = db.query.mock.calls[0][0];
      expect(query).not.toContain('enabled = true');
      expect(result).toHaveLength(2);
    });
  });

  describe('find', () => {
    it('should find specific client-tool relationship', async () => {
      const mockClientTool = {
        id: 1,
        client_id: 1,
        tool_id: 10,
        tool_name: 'test_tool',
      };

      db.query.mockResolvedValueOnce({ rows: [mockClientTool] });

      const result = await ClientTool.find(1, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ct.client_id = $1 AND ct.tool_id = $2'),
        [1, 10]
      );
      expect(result).toEqual(mockClientTool);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ClientTool.find(1, 999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update webhook URL', async () => {
      const mockUpdated = {
        id: 1,
        n8n_webhook_url: 'http://new-url/webhook/test',
      };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await ClientTool.update(1, 10, {
        n8n_webhook_url: 'http://new-url/webhook/test',
      });

      expect(result.n8n_webhook_url).toBe('http://new-url/webhook/test');
    });

    it('should update enabled status', async () => {
      const mockUpdated = { id: 1, enabled: false };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await ClientTool.update(1, 10, { enabled: false });

      expect(result.enabled).toBe(false);
    });

    it('should update integration_mapping as object', async () => {
      const newMapping = { new_api: 15 };
      const mockUpdated = { id: 1, integration_mapping: newMapping };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await ClientTool.update(1, 10, { integration_mapping: newMapping });

      // Verify JSONB is properly stringified
      const params = db.query.mock.calls[0][1];
      expect(params[0]).toBe(JSON.stringify(newMapping));
      expect(result).toEqual(mockUpdated);
    });

    it('should update integration_mapping as string', async () => {
      const mappingStr = '{"api_key": 20}';
      const mockUpdated = { id: 1 };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      await ClientTool.update(1, 10, { integration_mapping: mappingStr });

      const params = db.query.mock.calls[0][1];
      expect(params[0]).toBe(mappingStr);
    });

    it('should update multiple fields', async () => {
      const mockUpdated = {
        id: 1,
        n8n_webhook_url: 'http://new-url',
        enabled: true,
      };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await ClientTool.update(1, 10, {
        n8n_webhook_url: 'http://new-url',
        enabled: true,
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should throw error when no valid fields provided', async () => {
      await expect(
        ClientTool.update(1, 10, { invalid_field: 'value' })
      ).rejects.toThrow('No valid fields to update');
    });
  });

  describe('delete', () => {
    it('should delete client-tool by client_id and tool_id', async () => {
      const mockDeleted = { id: 1, client_id: 1, tool_id: 10 };

      db.query.mockResolvedValueOnce({ rows: [mockDeleted] });

      const result = await ClientTool.delete(1, 10);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM client_tools WHERE client_id = $1 AND tool_id = $2 RETURNING *',
        [1, 10]
      );
      expect(result).toEqual(mockDeleted);
    });
  });

  describe('deleteById', () => {
    it('should delete client-tool by id', async () => {
      const mockDeleted = { id: 5, client_id: 1, tool_id: 10 };

      db.query.mockResolvedValueOnce({ rows: [mockDeleted] });

      const result = await ClientTool.deleteById(5);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM client_tools WHERE id = $1 RETURNING *',
        [5]
      );
      expect(result).toEqual(mockDeleted);
    });
  });

  describe('getClientsUsingTool', () => {
    it('should return all clients using a tool', async () => {
      const mockClients = [
        { client_id: 1, client_name: 'Client A', domain: 'a.com' },
        { client_id: 2, client_name: 'Client B', domain: 'b.com' },
      ];

      db.query.mockResolvedValueOnce({ rows: mockClients });

      const result = await ClientTool.getClientsUsingTool(10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ct.tool_id = $1 AND ct.enabled = true'),
        [10]
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no clients use the tool', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ClientTool.getClientsUsingTool(999);

      expect(result).toEqual([]);
    });

    it('should include client details from join', async () => {
      const mockClients = [
        { client_id: 1, client_name: 'Test Client', domain: 'test.com' },
      ];

      db.query.mockResolvedValueOnce({ rows: mockClients });

      const result = await ClientTool.getClientsUsingTool(10);

      expect(result[0].client_name).toBe('Test Client');
      expect(result[0].domain).toBe('test.com');
    });
  });
});
