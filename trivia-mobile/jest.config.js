/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./jest.setup.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    moduleNameMapper: {
        '^react-native$': '<rootDir>/test/mocks/react-native.ts',
        '^expo-constants$': '<rootDir>/test/mocks/expo-constants.ts',
        '^expo/virtual/env$': '<rootDir>/test/mocks/expo-virtual-env.ts',
    },
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(expo(nent)?|@expo|@react-navigation|@sentry|@tanstack|@trivia/shared))',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
