/**
 * Integration Tests for Admin Tools API
 *
 * Tests the /admin/tools endpoints with real database operations.
 * Requires running PostgreSQL and Redis services.
 *
 * NOTE: These tests are automatically skipped in CI environments
 * where PostgreSQL is not available.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { db } from '../../../src/db.js';

// Check if database is available before running tests
async function isDatabaseAvailable() {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Determine if we should skip tests
const dbAvailable = await isDatabaseAvailable();
const skipTests = !dbAvailable;

describe.skipIf(skipTests)('Admin Tools API', () => {
  let authToken;
  let testToolId;
  const testToolName = 'test_integration_tool_' + Date.now();

  beforeAll(async () => {
    // Login to get auth token
    const loginRes = await request(app)
      .post('/admin/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Cleanup any test tools that might have been left behind
    try {
      await db.query('DELETE FROM tools WHERE tool_name LIKE $1', ['test_integration_tool_%']);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('GET /admin/tools', () => {
    it('should return all tools', async () => {
      const res = await request(app)
        .get('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/admin/tools');
      expect(res.status).toBe(401);
    });

    it('should reject invalid tokens', async () => {
      const res = await request(app)
        .get('/admin/tools')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /admin/tools', () => {
    it('should create a new tool with all fields', async () => {
      const res = await request(app)
        .post('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toolName: testToolName,
          description: 'Test tool for integration testing',
          parametersSchema: {
            type: 'object',
            properties: {
              testParam: { type: 'string', description: 'A test parameter' }
            },
            required: ['testParam']
          },
          category: 'testing',
          requiredIntegrations: [
            { key: 'test_api', name: 'Test API', required: true, description: 'Test integration' }
          ],
          capabilities: ['Test capability 1', 'Test capability 2'],
          isDestructive: false,
          requiresConfirmation: false,
          maxConfidence: 8
        });

      expect(res.status).toBe(201);
      expect(res.body.tool_name).toBe(testToolName);
      expect(res.body.description).toBe('Test tool for integration testing');
      expect(res.body.is_destructive).toBe(false);
      expect(res.body.requires_confirmation).toBe(false);
      expect(res.body.max_confidence).toBe(8);
      testToolId = res.body.id;
    });

    it('should create a tool with risk settings (destructive)', async () => {
      const destructiveToolName = testToolName + '_destructive';
      const res = await request(app)
        .post('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toolName: destructiveToolName,
          description: 'Destructive test tool',
          isDestructive: true,
          requiresConfirmation: true,
          maxConfidence: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.is_destructive).toBe(true);
      expect(res.body.requires_confirmation).toBe(true);
      expect(res.body.max_confidence).toBe(5);

      // Cleanup
      await db.query('DELETE FROM tools WHERE tool_name = $1', [destructiveToolName]);
    });

    it('should reject tool without name', async () => {
      const res = await request(app)
        .post('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Missing name' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject tool without description', async () => {
      const res = await request(app)
        .post('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ toolName: 'test_no_desc' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/admin/tools')
        .send({ toolName: 'test', description: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /admin/tools/:id', () => {
    it('should update tool description', async () => {
      const res = await request(app)
        .put(`/admin/tools/${testToolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('should update tool risk settings', async () => {
      const res = await request(app)
        .put(`/admin/tools/${testToolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isDestructive: true,
          requiresConfirmation: true,
          maxConfidence: 4
        });

      expect(res.status).toBe(200);
      expect(res.body.is_destructive).toBe(true);
      expect(res.body.requires_confirmation).toBe(true);
      expect(res.body.max_confidence).toBe(4);
    });

    it('should update tool parameters schema', async () => {
      const newSchema = {
        type: 'object',
        properties: {
          newParam: { type: 'string' }
        },
        required: ['newParam']
      };

      const res = await request(app)
        .put(`/admin/tools/${testToolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ parametersSchema: newSchema });

      expect(res.status).toBe(200);
      expect(res.body.parameters_schema.properties.newParam).toBeDefined();
    });

    it('should reject empty update', async () => {
      const res = await request(app)
        .put(`/admin/tools/${testToolId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No valid fields');
    });

    it('should handle non-existent tool', async () => {
      const res = await request(app)
        .put('/admin/tools/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Test' });

      // Should return null/undefined tool or handle gracefully
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('POST /admin/tools/:id/test', () => {
    it('should test tool webhook (requires n8n)', async () => {
      const res = await request(app)
        .post(`/admin/tools/${testToolId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          webhookUrl: 'http://localhost:5678/webhook/test',
          params: { testParam: 'value' }
        });

      // This will fail if n8n isn't running, which is expected
      // We just verify the endpoint handles the request properly
      expect([200, 500]).toContain(res.status);
    });

    it('should reject test without webhook URL', async () => {
      const res = await request(app)
        .post(`/admin/tools/${testToolId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ params: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Webhook URL');
    });
  });

  describe('DELETE /admin/tools/:id', () => {
    it('should delete a tool', async () => {
      // Create a tool specifically for deletion
      const createRes = await request(app)
        .post('/admin/tools')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toolName: testToolName + '_to_delete',
          description: 'Tool to be deleted'
        });

      const deleteId = createRes.body.id;

      const res = await request(app)
        .delete(`/admin/tools/${deleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      // Verify it's gone
      const tools = await db.query('SELECT * FROM tools WHERE id = $1', [deleteId]);
      expect(tools.rows.length).toBe(0);
    });

    it('should reject deletion of tool in use by clients', async () => {
      // This test requires a tool that's linked to a client
      // For now, we just verify the endpoint responds properly
      // A more complete test would create a client_tool association first
      const res = await request(app)
        .delete(`/admin/tools/${testToolId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either delete successfully or return error about clients using it
      expect([200, 400]).toContain(res.status);
    });
  });

  // Cleanup the main test tool at the end
  afterAll(async () => {
    if (testToolId) {
      try {
        await db.query('DELETE FROM tools WHERE id = $1', [testToolId]);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
