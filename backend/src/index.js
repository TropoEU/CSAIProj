import express from "express";
import cors from "cors";
import axios from "axios";
import toolRoutes from "./routes/tools.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import customerRoutes from "./routes/customer.js";
import mockApiRoutes from "./routes/mockApi.js";
import emailRoutes from "./routes/email.js";
import { redisClient } from "./redis.js";
import { db } from "./db.js";
import conversationService from "./services/conversationService.js";
import { emailMonitor } from "./services/emailMonitor.js";

// Note: dotenv is loaded in config.js, no need to load it here

const app = express();

// Enable CORS for all origins (can be restricted to specific origins in production)
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
}));

app.use(express.json());
app.use("/tools", toolRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/api/customer", customerRoutes); // Customer portal API
app.use("/api/email", emailRoutes); // Email channel management & OAuth
app.use("/mock-api", mockApiRoutes); // Mock client APIs for testing

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
      const n8nUrl = process.env.WEBHOOK_URL || `http://${process.env.N8N_HOST || 'localhost'}:${process.env.N8N_PORT || 5678}`;
      const response = await axios.get(`${n8nUrl.replace(/\/$/, '')}/healthz`, {
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
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  
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
    runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES);
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
