module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.(js|ts)',
    '**/__tests__/**/*.test.(js|ts)',
    '**/?(*.)+(spec|test).(js|ts)'
  ],
  collectCoverageFrom: [
    'src/**/*.(js|ts)',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!src/generated/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {}],
    '^.+\\.js$': ['ts-jest', {}]
  }
};