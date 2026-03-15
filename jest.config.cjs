/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: [],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.server.json',
    }],
  },
  moduleNameMapper: {
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
};
