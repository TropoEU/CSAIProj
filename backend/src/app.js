/**
 * Express Application Setup
 *
 * This file configures the Express app without starting the server.
 * Used by both the main server (index.js) and integration tests.
 */

import express from 'express';
import cors from 'cors';
import { HTTP_STATUS } from './config/constants.js';
import toolRoutes from './routes/tools.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customer.js';
import mockApiRoutes from './routes/mockApi.js';
import emailRoutes from './routes/email.js';
import { redisClient } from './redis.js';
import { db } from './db.js';
import axios from 'axios';

const app = express();

// CORS configuration - restrictive in production, permissive in development
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In production, use whitelist from environment
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : null;

    if (allowedOrigins) {
      // Production mode: strict whitelist
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development mode: allow localhost and common dev ports
      const devPatterns = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

      if (devPatterns.some((pattern) => pattern.test(origin))) {
        callback(null, true);
      } else {
        // Still allow in dev for flexibility, but log warning
        console.warn(`[CORS] Allowing unrecognized origin in dev mode: ${origin}`);
        callback(null, true);
      }
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use('/tools', toolRoutes);
app.use('/chat', chatRoutes);
app.use('/admin', adminRoutes);
app.use('/api/customer', customerRoutes); // Customer portal API
app.use('/api/email', emailRoutes); // Email channel management & OAuth
app.use('/mock-api', mockApiRoutes); // Mock client APIs for testing

// Health check for services
app.get('/health', async (req, res) => {
  try {
    // Check Redis
    let redisStatus = 'error';
    try {
      const redisPing = await redisClient.ping();
      redisStatus = `Redis: OK (${redisPing})`;
    } catch (error) {
      redisStatus = `Redis: ERROR (${error.message})`;
    }

    // Check PostgreSQL
    let postgresStatus = 'error';
    try {
      await db.query('SELECT 1');
      postgresStatus = 'PostgreSQL: OK';
    } catch (error) {
      postgresStatus = `PostgreSQL: ERROR (${error.message})`;
    }

    // Check n8n
    let n8nStatus = 'error';
    try {
      const n8nUrl = `${process.env.N8N_PROTOCOL || 'http'}://${process.env.N8N_HOST || 'localhost'}:${process.env.N8N_PORT || 5678}`;
      const response = await axios.get(`${n8nUrl}/healthz`, {
        timeout: 2000,
        validateStatus: (status) => status < 500,
      });
      n8nStatus = response.status < 400 ? 'n8n: OK' : `n8n: DEGRADED (HTTP ${response.status})`;
    } catch (error) {
      n8nStatus = `n8n: ERROR (${error.message})`;
    }

    res.type('text/plain').send(`${redisStatus}\n${postgresStatus}\n${n8nStatus}`);
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .type('text/plain')
      .send(`Health check failed: ${error.message}`);
  }
});

export default app;
