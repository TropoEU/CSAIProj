import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory (one level up from src/config.js)
dotenv.config({ path: join(__dirname, '../.env') });

// Detect if we're running inside Docker
// Check for common Docker indicators
const isRunningInDocker = () => {
  // Check for .dockerenv file (present in Docker containers)
  if (existsSync('/.dockerenv')) {
    return true;
  }
  // Check for Docker-specific environment variables
  if (process.env.DOCKER_CONTAINER === 'true' || process.env.IN_DOCKER === 'true') {
    return true;
  }
  // Check if cgroup indicates Docker (synchronous check)
  try {
    if (existsSync('/proc/self/cgroup')) {
      const cgroup = readFileSync('/proc/self/cgroup', 'utf-8');
      if (cgroup.includes('docker')) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
};

// When running locally (outside Docker), convert Docker service names to localhost
// When running inside Docker, use the service names as-is (they resolve in Docker network)
const getHost = (dockerServiceName) => {
  if (!dockerServiceName) {
    return 'localhost';
  }

  // If host is a Docker service name and we're running locally, use localhost
  // (Docker service names only work inside Docker network)
  if ((dockerServiceName === 'postgres' || dockerServiceName === 'redis') && !isRunningInDocker()) {
    return 'localhost';
  }

  return dockerServiceName;
};

export const POSTGRES_CONFIG = {
  user: process.env.POSTGRES_USER || '',
  password: String(process.env.POSTGRES_PASSWORD || ''),
  host: getHost(process.env.POSTGRES_HOST),
  database: process.env.POSTGRES_DB || '',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
};

export const REDIS_CONFIG = {
  host: getHost(process.env.REDIS_HOST),
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Ollama configuration (runs on Windows host, accessible via localhost)
export const OLLAMA_CONFIG = {
  url: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'dolphin-llama3'
};

// n8n configuration
export const N8N_CONFIG = {
  host: process.env.N8N_HOST || 'localhost',
  port: parseInt(process.env.N8N_PORT) || 5678,
  webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:5678/'
};
