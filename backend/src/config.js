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

// Determine the appropriate host for services
// - In production/cloud (Railway, etc.): use env vars directly
// - In Docker: use Docker service names
// - Local development: use localhost
const getHost = (envHost, dockerServiceName) => {
  // If explicit host is provided and it's NOT a Docker service name, use it directly
  // (This handles Railway/cloud deployments with real hostnames)
  if (envHost && envHost !== dockerServiceName) {
    return envHost;
  }

  // If running in Docker/container environment, use Docker service name
  if (isRunningInDocker()) {
    return dockerServiceName || 'localhost';
  }

  // Local development - always use localhost
  // (envHost might be 'postgres' or 'redis' from .env, but those don't work outside Docker)
  return 'localhost';
};

export const POSTGRES_CONFIG = {
  user: process.env.POSTGRES_USER || '',
  password: String(process.env.POSTGRES_PASSWORD || ''),
  host: getHost(process.env.POSTGRES_HOST, 'postgres'),
  database: process.env.POSTGRES_DB || '',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
};

export const REDIS_CONFIG = {
  host: getHost(process.env.REDIS_HOST, 'redis'),
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// Ollama configuration (runs on Windows host, accessible via localhost)
export const OLLAMA_CONFIG = {
  url: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'dolphin-llama3'
};

// n8n configuration - build URL from components
const n8nHost = process.env.N8N_HOST || 'localhost';
const n8nPort = process.env.N8N_PORT || '5678';
const n8nProtocol = process.env.N8N_PROTOCOL || 'http';

export const N8N_CONFIG = {
  host: n8nHost,
  port: parseInt(n8nPort, 10),
  protocol: n8nProtocol,
  baseUrl: `${n8nProtocol}://${n8nHost}:${n8nPort}/`
};

/**
 * Validate required environment variables on startup
 * Logs warnings for missing critical variables
 */
export function validateEnvironment() {
  const required = [
    { name: 'POSTGRES_USER', value: process.env.POSTGRES_USER },
    { name: 'POSTGRES_PASSWORD', value: process.env.POSTGRES_PASSWORD },
    { name: 'POSTGRES_DB', value: process.env.POSTGRES_DB },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
  ];

  const recommended = [
    { name: 'OLLAMA_URL', value: process.env.OLLAMA_URL },
    { name: 'N8N_HOST', value: process.env.N8N_HOST },
  ];

  const missingRequired = required.filter(v => !v.value);
  const missingRecommended = recommended.filter(v => !v.value);

  if (missingRequired.length > 0) {
    console.error('[Config] CRITICAL: Missing required environment variables:');
    missingRequired.forEach(v => console.error(`  - ${v.name}`));
    console.error('[Config] The application may not function correctly.');
  }

  if (missingRecommended.length > 0) {
    console.warn('[Config] Warning: Missing recommended environment variables:');
    missingRecommended.forEach(v => console.warn(`  - ${v.name} (using default)`));
  }

  return missingRequired.length === 0;
}

// Run validation on import
validateEnvironment();
