import express from 'express';
import cors from 'cors';
import axios from 'axios';
import toolRoutes from './routes/tools.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customer.js';
import mockApiRoutes from './routes/mockApi.js';
import emailRoutes from './routes/email.js';
import { redisClient } from './redis.js';
import { db } from './db.js';
import conversationService from './services/conversationService.js';
import { emailMonitor } from './services/emailMonitor.js';
import n8nService from './services/n8nService.js';

// Note: dotenv is loaded in config.js, no need to load it here

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
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
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
      const devPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      ];

      if (devPatterns.some(pattern => pattern.test(origin))) {
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

//health check for services
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
        validateStatus: (status) => status < 500
      });
      n8nStatus = response.status < 400 ? 'n8n: OK' : `n8n: DEGRADED (HTTP ${response.status})`;
    } catch (error) {
      n8nStatus = `n8n: ERROR (${error.message})`;
    }
    
    res.type('text/plain').send(`${redisStatus}\n${postgresStatus}\n${n8nStatus}`);
  } catch (error) {
    res.status(500).type('text/plain').send(`Health check failed: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);

  // Check n8n connectivity on startup
  const n8nHealth = await n8nService.checkHealth();
  if (n8nHealth.available) {
    console.log(`n8n Connected (version: ${n8nHealth.version})`);
  } else {
    console.warn(`n8n Connection Warning: ${n8nHealth.error}`);
  }

  // Start scheduled tasks
  startScheduledTasks();
});

/**
 * Start scheduled background tasks
 */
function startScheduledTasks() {
  // Auto-end inactive conversations
  // Runs every 5 minutes, ends conversations inactive for 15+ minutes (configurable)
  const INACTIVITY_TIMEOUT_MINUTES = parseInt(process.env.CONVERSATION_INACTIVITY_TIMEOUT_MINUTES || '15');
  const CHECK_INTERVAL_MS = parseInt(process.env.CONVERSATION_AUTO_END_CHECK_INTERVAL_MS || '300000'); // 5 minutes default

  console.log(`[Scheduler] Starting auto-end task: checking every ${CHECK_INTERVAL_MS / 1000}s, ending conversations inactive for ${INACTIVITY_TIMEOUT_MINUTES}+ minutes`);

  // Run immediately on startup, then on interval
  runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES);

  setInterval(() => {
    runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES).catch(err => {
      console.error('[Scheduler] Unhandled error in auto-end task:', err);
    });
  }, CHECK_INTERVAL_MS);

  // Start email monitor for multi-channel AI support
  emailMonitor.start();
}

/**
 * Run the auto-end inactive conversations task
 */
async function runAutoEndTask(inactivityMinutes) {
  try {
    const result = await conversationService.autoEndInactiveConversations(inactivityMinutes);
    if (result.ended > 0) {
      console.log(`[Scheduler] Auto-ended ${result.ended} inactive conversation(s)`);
    }
  } catch (error) {
    console.error('[Scheduler] Error in auto-end task:', error);
  }
}
