import express from "express";
import axios from "axios";
import toolRoutes from "./routes/tools.js";
import chatRoutes from "./routes/chat.js";
import { redisClient } from "./redis.js";
import { db } from "./db.js";

// Note: dotenv is loaded in config.js, no need to load it here

const app = express();
app.use(express.json());
app.use("/tools", toolRoutes);
app.use("/chat", chatRoutes);

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
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
