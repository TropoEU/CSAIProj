import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
    ],
    exclude: [
      'node_modules',
      'dist',
      'tests/integration/all-models.test.js',  // Manual integration test (standalone script)
      // Note: tests/models/ and tests/services/ contain standalone Node.js scripts,
      // not vitest tests. They are run via npm scripts like test:redis, test:models.
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/scripts/**',
        'src/index.js',
        '**/*.test.js',
        '**/node_modules/**',
      ],
      // Thresholds - starting low, increase as coverage improves
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
      },
    },
  },
});
