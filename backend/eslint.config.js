import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off', // Allow console in backend

      // Best practices
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-throw-literal': 'error',

      // Style (handled by Prettier, so minimal here)
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '**/*.test.js'],
  },
];
