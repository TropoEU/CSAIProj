import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'tests/integration/all-models.test.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
