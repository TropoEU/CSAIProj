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
import { LIMITS } from '../config/constants.js';

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

// Create write stream for better performance
// Using append mode with autoClose disabled for persistent stream
let logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', autoClose: false });

// Handle stream errors
logStream.on('error', (err) => {
  console.error('Log stream error:', err.message);
  // Try to recreate stream (close old one first to prevent resource leak)
  try {
    const oldStream = logStream;
    // Wait for stream to finish closing before creating new one
    oldStream.end(() => {
      try {
        logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', autoClose: false });
      } catch (recreateErr) {
        console.error('Failed to recreate log stream:', recreateErr.message);
      }
    });
  } catch (endErr) {
    console.error('Failed to close old log stream:', endErr.message);
  }
});

// Graceful shutdown - close stream on process exit
process.on('exit', () => {
  try {
    logStream.end();
  } catch {
    // Ignore errors during shutdown
  }
});

process.on('SIGINT', () => {
  try {
    logStream.end();
  } catch {
    // Ignore errors during shutdown
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  try {
    logStream.end();
  } catch {
    // Ignore errors during shutdown
  }
  process.exit(0);
});

/**
 * Sanitize log input to prevent log injection attacks
 * Removes control characters, newlines, and other dangerous characters
 */
function sanitizeLogInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  // Remove control characters, newlines, tabs, and other dangerous characters
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

/**
 * JSON.stringify replacer function that handles circular references
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Format log entry for file output
 */
function formatLogEntry(level, module, message, data) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level: level.toUpperCase(),
    module: sanitizeLogInput(module),
    message: sanitizeLogInput(message),
    ...(data !== undefined && { data }),
  };

  try {
    return JSON.stringify(entry, getCircularReplacer());
  } catch {
    // Fallback if stringify still fails
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      module: sanitizeLogInput(module),
      message: sanitizeLogInput(message),
      data: '[Unstringifiable]',
    });
  }
}

/**
 * Format log entry for console output
 */
function formatConsoleOutput(level, module, message, data) {
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
  const sanitizedModule = sanitizeLogInput(module);
  const sanitizedMessage = sanitizeLogInput(message);
  const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${sanitizedModule}]`;

  if (data === undefined) {
    return `${prefix} ${sanitizedMessage}`;
  }

  // Format data for console (truncate if too long)
  let dataStr;
  if (data instanceof Error) {
    dataStr = sanitizeLogInput(data.stack || data.message);
  } else if (typeof data === 'object') {
    try {
      dataStr = JSON.stringify(data, getCircularReplacer());
      if (dataStr.length > LIMITS.MAX_LOG_LENGTH) {
        dataStr = dataStr.substring(0, LIMITS.MAX_LOG_LENGTH) + '...';
      }
    } catch {
      dataStr = '[Unstringifiable]';
    }
  } else {
    dataStr = sanitizeLogInput(String(data));
  }

  return `${prefix} ${sanitizedMessage} ${dataStr}`;
}

/**
 * Write to log file using write stream (better performance)
 */
function writeToFile(entry) {
  try {
    const success = logStream.write(entry + '\n');

    // If buffer is full, wait for drain event (backpressure handling)
    if (!success) {
      logStream.once('drain', () => {
        // Buffer cleared, ready for more writes
      });
    }
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
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
        // Close current stream, truncate file, and create new stream
        const oldStream = logStream;
        oldStream.end(() => {
          try {
            fs.writeFileSync(LOG_FILE, '');
            logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', autoClose: false });
          } catch (err) {
            console.error('Failed to recreate log stream after clear:', err);
          }
        });
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  },
};
