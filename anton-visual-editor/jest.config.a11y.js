module.exports = {
  displayName: 'Accessibility Tests',
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: [
    '**/__tests__/accessibility/**/*.test.[jt]s?(x)',
    '**/tests/accessibility/**/*.test.[jt]s?(x)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.a11y.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    }],
  },
  coverageDirectory: 'coverage/accessibility',
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    '!src/components/**/*.stories.tsx',
    '!src/components/**/*.test.{ts,tsx}',
  ],
};