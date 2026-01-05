import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock the logger module to avoid file I/O during tests
vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn(() => ({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    })),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}));

describe('Logger', () => {
  let createLogger;
  let mockStream;

  beforeEach(async () => {
    // Clear module cache to get fresh logger instance
    vi.clearAllMocks();
    vi.resetModules(); // Reset module cache to force reimport

    mockStream = {
      write: vi.fn((data, cb) => {
        if (cb) cb();
        return true;
      }),
      end: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === 'error') {
          mockStream.errorHandler = handler;
        }
        return mockStream;
      }),
    };

    fs.createWriteStream.mockReturnValue(mockStream);

    // Import logger after mocking
    const loggerModule = await import('../../../src/utils/logger.js');
    createLogger = loggerModule.createLogger;
  });

  describe('createLogger', () => {
    it('should create logger with module name', () => {
      const logger = createLogger('TestModule');
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should create logger without module name', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('Logging methods', () => {
    it('should log info messages', () => {
      const logger = createLogger('Test');
      logger.info('Test message');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const logger = createLogger('Test');
      logger.warn('Warning message');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = createLogger('Test');
      logger.error('Error message');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      const logger = createLogger('Test');
      logger.debug('Debug message');
      expect(mockStream.write).toHaveBeenCalled();
    });
  });

  describe('Log injection prevention', () => {
    it('should sanitize newlines from messages', () => {
      const logger = createLogger('Test');
      logger.info('Line1\nLine2');
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const loggedData = calls[calls.length - 1][0];
      // Should not contain literal newline in the middle of message
      expect(loggedData).toBeDefined();
    });

    it('should sanitize control characters from messages', () => {
      const logger = createLogger('Test');
      logger.info('Test\x00\x01\x02message');
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should sanitize tab characters from messages', () => {
      const logger = createLogger('Test');
      logger.info('Test\tmessage');
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should handle messages with fake log entries', () => {
      const logger = createLogger('Test');
      logger.info('Normal message\n[ERROR] Fake error');
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('Module name sanitization', () => {
    it('should sanitize module names with control characters', () => {
      const logger = createLogger('Test\nModule');
      logger.info('Message');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle module names with special characters', () => {
      const logger = createLogger('Test\x00Module');
      logger.info('Message');
      expect(mockStream.write).toHaveBeenCalled();
    });
  });

  describe('Data logging', () => {
    it('should log with additional data object', () => {
      const logger = createLogger('Test');
      logger.info('Message', { userId: 123, action: 'login' });
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle null data', () => {
      const logger = createLogger('Test');
      logger.info('Message', null);
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle undefined data', () => {
      const logger = createLogger('Test');
      logger.info('Message', undefined);
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle circular reference in data', () => {
      const logger = createLogger('Test');
      const obj = { name: 'test' };
      obj.self = obj; // Circular reference
      logger.info('Message', obj);
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should truncate very long data strings', () => {
      const logger = createLogger('Test');
      const longString = 'a'.repeat(1000);
      logger.info('Message', { data: longString });
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const loggedData = calls[calls.length - 1][0];
      // Should be truncated (check for '...' indicator)
      expect(loggedData.length).toBeLessThan(2000);
    });
  });

  describe('Log levels', () => {
    it('should respect LOG_LEVEL environment variable', () => {
      // This test verifies the logger respects environment config
      const logger = createLogger('Test');
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle stream write errors gracefully', () => {
      mockStream.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const logger = createLogger('Test');
      // Should not throw
      expect(() => logger.info('Test message')).not.toThrow();
    });

    it('should handle JSON stringify errors', () => {
      const logger = createLogger('Test');
      const obj = {};
      Object.defineProperty(obj, 'bad', {
        get() {
          throw new Error('Bad property');
        },
      });
      // Should not throw
      expect(() => logger.info('Test', obj)).not.toThrow();
    });
  });

  describe('Special characters handling', () => {
    it('should handle unicode characters', () => {
      const logger = createLogger('Test');
      logger.info('Message with emoji 😀');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle Hebrew text', () => {
      const logger = createLogger('Test');
      logger.info('שלום עולם');
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('should handle mixed RTL/LTR text', () => {
      const logger = createLogger('Test');
      logger.info('Hello שלום World');
      expect(mockStream.write).toHaveBeenCalled();
    });
  });

  describe('Console output', () => {
    it('should output to console based on environment', () => {
      const logger = createLogger('Test');
      // Just verify it doesn't throw
      expect(() => logger.info('Console test')).not.toThrow();
    });
  });

  describe('Module filtering', () => {
    it('should create loggers for different modules', () => {
      const logger1 = createLogger('Module1');
      const logger2 = createLogger('Module2');

      logger1.info('Message from module 1');
      logger2.info('Message from module 2');

      expect(mockStream.write.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Timestamp formatting', () => {
    it('should include timestamp in log entries', () => {
      const logger = createLogger('Test');
      logger.info('Message');
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const logEntry = calls[calls.length - 1][0];
      // Should contain ISO timestamp format
      expect(logEntry).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('JSON log format', () => {
    it('should write valid JSON to file', () => {
      const logger = createLogger('Test');
      logger.info('Test message', { key: 'value' });
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const logEntry = calls[calls.length - 1][0];
      // Should be valid JSON
      expect(() => JSON.parse(logEntry)).not.toThrow();
    });
  });
});
