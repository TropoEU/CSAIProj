/**
 * Enhanced Logger with log levels and structured output
 *
 * Usage:
 *   import { createLogger } from '../utils/logger.js';
 *   const log = createLogger('ServiceName');
 *   log.info('Something happened', { data: 123 });
 *   log.error('Error occurred', error);
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels in order of severity
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment (default: debug in dev, info in prod)
const getMinLevel = () => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
};

const MIN_LEVEL = getMinLevel();

// Log file path
const LOG_FILE = path.join(__dirname, '../../logs/app.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Format log entry for file output
 */
function formatLogEntry(level, module, message, data) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level: level.toUpperCase(),
    module,
    message,
    ...(data !== undefined && { data }),
  };
  return JSON.stringify(entry);
}

/**
 * Format log entry for console output
 */
function formatConsoleOutput(level, module, message, data) {
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
  const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${module}]`;

  if (data === undefined) {
    return `${prefix} ${message}`;
  }

  // Format data for console (truncate if too long)
  let dataStr;
  if (data instanceof Error) {
    dataStr = data.stack || data.message;
  } else if (typeof data === 'object') {
    dataStr = JSON.stringify(data);
    if (dataStr.length > 500) {
      dataStr = dataStr.substring(0, 500) + '...';
    }
  } else {
    dataStr = String(data);
  }

  return `${prefix} ${message} ${dataStr}`;
}

/**
 * Write to log file (async, non-blocking)
 */
function writeToFile(entry) {
  fs.appendFile(LOG_FILE, entry + '\n', (err) => {
    if (err) {
      console.error('Failed to write to log file:', err.message);
    }
  });
}

/**
 * Core log function
 */
function logMessage(level, module, message, data) {
  const levelValue = LOG_LEVELS[level];

  // Skip if below minimum level
  if (levelValue < MIN_LEVEL) {
    return;
  }

  // Console output with colors
  const consoleOutput = formatConsoleOutput(level, module, message, data);
  switch (level) {
    case 'debug':
      console.debug('\x1b[90m%s\x1b[0m', consoleOutput); // Gray
      break;
    case 'info':
      console.log(consoleOutput);
      break;
    case 'warn':
      console.warn('\x1b[33m%s\x1b[0m', consoleOutput); // Yellow
      break;
    case 'error':
      console.error('\x1b[31m%s\x1b[0m', consoleOutput); // Red
      break;
    default:
      console.log(consoleOutput);
  }

  // File output (structured JSON)
  const fileEntry = formatLogEntry(level, module, message, data);
  writeToFile(fileEntry);
}

/**
 * Create a logger instance for a specific module
 *
 * @param {string} moduleName - Name of the module (e.g., 'Conversation', 'n8n', 'LLM')
 * @returns {object} Logger with debug, info, warn, error methods
 */
export function createLogger(moduleName) {
  return {
    debug: (message, data) => logMessage('debug', moduleName, message, data),
    info: (message, data) => logMessage('info', moduleName, message, data),
    warn: (message, data) => logMessage('warn', moduleName, message, data),
    error: (message, data) => logMessage('error', moduleName, message, data),

    // Convenience method for tool execution logging
    tool: (toolName, action, data) => {
      logMessage('info', moduleName, `Tool ${toolName}: ${action}`, data);
    },
  };
}

/**
 * Legacy logger for backwards compatibility
 * @deprecated Use createLogger() instead
 */
export const logger = {
  log: (message, data = null) => {
    logMessage('info', 'App', message, data);
  },

  debug: (message, data = null) => {
    logMessage('debug', 'App', message, data);
  },

  warn: (message, data = null) => {
    logMessage('warn', 'App', message, data);
  },

  error: (message, data = null) => {
    logMessage('error', 'App', message, data);
  },

  clear: () => {
    try {
      if (fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  },
};
