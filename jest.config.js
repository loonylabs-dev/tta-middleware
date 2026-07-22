/**
 * Jest Configuration for TTA Middleware
 *
 * Following the same patterns as @loonylabs/tti-middleware
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file locations
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
  ],

  // TypeScript transformation
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/index.ts',
    // Exclude provider implementations that require integration tests (real API calls)
    // These are tested via:
    //   - TTA_INTEGRATION_TESTS=true npm run test:integration
    //   - npm run test:manual:elevenlabs-sfx
    //   - npm run test:manual:google-lyria
    //   - npm run test:manual:stability-ai-sfx
    '!src/middleware/services/tta/providers/elevenlabs-provider.ts',
    '!src/middleware/services/tta/providers/google-lyria-provider.ts',
    '!src/middleware/services/tta/providers/stability-ai-provider.ts',
    // Debug utils rely on filesystem I/O - tested via manual tests
    '!src/middleware/services/tta/utils/debug-tta.utils.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Setup files (load .env for integration tests)
  setupFiles: ['<rootDir>/tests/setup.ts'],

  // Test timeout (useful for async operations)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
};
