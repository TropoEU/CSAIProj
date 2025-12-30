/**
 * TODO: REFACTOR - Enhance this logger to replace console.log/error/warn throughout codebase
 *
 * Current state: Basic file logger that also outputs to console
 *
 * Needed improvements:
 * 1. Add log levels (debug, info, warn, error) with configurable minimum level
 * 2. Add structured logging with consistent format
 * 3. Replace all console.log/error/warn calls in services with this logger
 * 4. Add log rotation or size limits for production
 * 5. Consider integration with external logging service (e.g., Datadog, Logtail)
 *
 * Files with excessive console logging to migrate:
 * - conversationService.js (40+ statements)
 * - n8nService.js
 * - llmService.js
 * - chatController.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, '../../logs/debug.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = {
  log: (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
    
    // Also log to console
    console.log(message, data || '');
    
    // Write to file
    try {
      fs.appendFileSync(LOG_FILE, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  },
  
  clear: () => {
    try {
      if (fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
};

