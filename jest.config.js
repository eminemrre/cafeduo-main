export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
    // react-router 8 ESM-only'dir; jest.transform.js onu CJS'e cevirir
    // (import.meta.hot temizlenir, ts-jest commonjs ciktisi uretir).
    '^.+node_modules[\\\\/]react-router[\\\\/].+\\.js$': '<rootDir>/jest.transform.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(react-router)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styles.cjs',
    // cookie-es ESM-only (.mjs) — jest CJS pipeline'inda yuklenemez; react-router'in
    // server-runtime'inda kullanilir ve testlerde cagrilmaz, minimal stub yeterli.
    '^cookie-es$': '<rootDir>/__mocks__/cookie-es.cjs',
    '^framer-motion$': '<rootDir>/__mocks__/framer-motion.js',
  },
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  coverageThreshold: {
    global: {
      lines: 72,
      statements: 71,
      branches: 60,
      functions: 68,
    },
  },
  // CI coverage rozeti coverage-summary.json okur; json-summary olmadan 0 cikar.
  coverageReporters: ['json', 'json-summary', 'text', 'lcov', 'clover'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'backend/services/**/*.js',
    'backend/controllers/**/*.js',
    'backend/handlers/**/*.js',
    'backend/repositories/**/*.js',
    'backend/middleware/**/*.js',
    'backend/utils/**/*.js',
    '!**/*.d.ts',
    '!**/*.legacy.js',
    // WebGL/PixiJS overlay dosyalari jsdom'da test edilemez (her testte mock'lanir)
    '!lib/pixi/**',
    '!components/games/*StageCanvas*',
    '!components/games/ChessBoardOverlay.tsx',
    // Sadece re-export yapan barrel dosyasi
    '!backend/handlers/game/index.js',
  ],
};
