export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  setupFilesAfterEnv: [],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/**/*.js',
    '!src/modules/**/*.routes.js',
    '!src/modules/**/*.controller.js'
  ]
};
