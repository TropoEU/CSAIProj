import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/db.js', () => ({
  db: {
    query: vi.fn(),
  },
}));

const { db } = await import('../../../src/db.js');
const { IntegrationEndpoint } = await import('../../../src/models/IntegrationEndpoint.js');

describe('IntegrationEndpoint Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create an endpoint with all fields', async () => {
      const mockEndpoint = {
        id: 1,
        integration_id: 10,
        endpoint_name: 'get_orders',
        endpoint_url: 'https://api.example.com/orders',
        method: 'GET',
        description: 'Fetch orders from API',
      };

      db.query.mockResolvedValueOnce({ rows: [mockEndpoint] });

      const result = await IntegrationEndpoint.create(
        10,
        'get_orders',
        'https://api.example.com/orders',
        'GET',
        'Fetch orders from API'
      );

      expect(db.query).toHaveBeenCalledOnce();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO integration_endpoints'),
        [10, 'get_orders', 'https://api.example.com/orders', 'GET', 'Fetch orders from API']
      );
      expect(result).toEqual(mockEndpoint);
    });

    it('should create an endpoint with default method', async () => {
      const mockEndpoint = {
        id: 2,
        integration_id: 10,
        endpoint_name: 'list_products',
        endpoint_url: 'https://api.example.com/products',
        method: 'GET',
        description: null,
      };

      db.query.mockResolvedValueOnce({ rows: [mockEndpoint] });

      const result = await IntegrationEndpoint.create(
        10,
        'list_products',
        'https://api.example.com/products'
      );

      expect(result.method).toBe('GET');
    });

    it('should create an endpoint with POST method', async () => {
      const mockEndpoint = {
        id: 3,
        integration_id: 10,
        endpoint_name: 'create_order',
        endpoint_url: 'https://api.example.com/orders',
        method: 'POST',
        description: 'Create a new order',
      };

      db.query.mockResolvedValueOnce({ rows: [mockEndpoint] });

      const result = await IntegrationEndpoint.create(
        10,
        'create_order',
        'https://api.example.com/orders',
        'POST',
        'Create a new order'
      );

      expect(result.method).toBe('POST');
    });
  });

  describe('getByIntegration', () => {
    it('should return all endpoints for an integration', async () => {
      const mockEndpoints = [
        { id: 1, endpoint_name: 'get_orders', method: 'GET' },
        { id: 2, endpoint_name: 'create_order', method: 'POST' },
      ];
      db.query.mockResolvedValueOnce({ rows: mockEndpoints });

      const result = await IntegrationEndpoint.getByIntegration(10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE integration_id = $1'),
        [10]
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no endpoints exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await IntegrationEndpoint.getByIntegration(999);

      expect(result).toEqual([]);
    });
  });

  describe('findByName', () => {
    it('should return endpoint when found', async () => {
      const mockEndpoint = {
        id: 1,
        integration_id: 10,
        endpoint_name: 'get_orders',
      };
      db.query.mockResolvedValueOnce({ rows: [mockEndpoint] });

      const result = await IntegrationEndpoint.findByName(10, 'get_orders');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE integration_id = $1 AND endpoint_name = $2'),
        [10, 'get_orders']
      );
      expect(result).toEqual(mockEndpoint);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await IntegrationEndpoint.findByName(10, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return endpoint when found', async () => {
      const mockEndpoint = { id: 1, endpoint_name: 'get_orders' };
      db.query.mockResolvedValueOnce({ rows: [mockEndpoint] });

      const result = await IntegrationEndpoint.findById(1);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM integration_endpoints WHERE id = $1',
        [1]
      );
      expect(result).toEqual(mockEndpoint);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await IntegrationEndpoint.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update endpoint_url', async () => {
      const mockUpdated = {
        id: 1,
        endpoint_url: 'https://api.newurl.com/orders',
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await IntegrationEndpoint.update(1, {
        endpoint_url: 'https://api.newurl.com/orders',
      });

      expect(result.endpoint_url).toBe('https://api.newurl.com/orders');
    });

    it('should update method', async () => {
      const mockUpdated = {
        id: 1,
        method: 'PUT',
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await IntegrationEndpoint.update(1, { method: 'PUT' });

      expect(result.method).toBe('PUT');
    });

    it('should update description', async () => {
      const mockUpdated = {
        id: 1,
        description: 'Updated description',
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await IntegrationEndpoint.update(1, {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should update multiple fields at once', async () => {
      const mockUpdated = {
        id: 1,
        endpoint_url: 'https://api.new.com',
        method: 'PATCH',
        description: 'New description',
      };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await IntegrationEndpoint.update(1, {
        endpoint_url: 'https://api.new.com',
        method: 'PATCH',
        description: 'New description',
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should throw error when no valid fields provided', async () => {
      await expect(
        IntegrationEndpoint.update(1, { invalid_field: 'value' })
      ).rejects.toThrow('No valid fields to update');
    });

    it('should ignore invalid fields in updates', async () => {
      const mockUpdated = { id: 1, method: 'DELETE' };
      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await IntegrationEndpoint.update(1, {
        method: 'DELETE',
        invalid_field: 'ignored',
      });

      expect(result.method).toBe('DELETE');
      // Verify invalid_field wasn't included in query
      const query = db.query.mock.calls[0][0];
      expect(query).not.toContain('invalid_field');
    });
  });

  describe('delete', () => {
    it('should delete and return the endpoint', async () => {
      const mockDeleted = {
        id: 1,
        endpoint_name: 'get_orders',
      };
      db.query.mockResolvedValueOnce({ rows: [mockDeleted] });

      const result = await IntegrationEndpoint.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM integration_endpoints WHERE id = $1 RETURNING *',
        [1]
      );
      expect(result).toEqual(mockDeleted);
    });

    it('should return undefined when endpoint not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await IntegrationEndpoint.delete(999);

      expect(result).toBeUndefined();
    });
  });
});
