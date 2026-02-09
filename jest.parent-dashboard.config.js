/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/app/screens',
    '<rootDir>/components/messaging',
    '<rootDir>/components/dashboard/parent',
    '<rootDir>/components/dashboard/shared',
    '<rootDir>/components/super-admin/voice-orb',
    '<rootDir>/domains/k12/hooks',
    '<rootDir>/domains/k12/components',
    '<rootDir>/domains/k12/__tests__',
    '<rootDir>/hooks',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '\\.native$': '<rootDir>/__mocks__/react-native.js',
    '(.*)/crossPlatform$': '$1/crossPlatform.native.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
};
