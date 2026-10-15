# jest.config.js'i byte-exact ureten gecici script.
# Backslash'lari elle saymak yerine chr(92) kullaniyoruz.
BS = chr(92)  # backslash

# JS kaynak dosyasinda regex key'lerinin VALUE'lari soyle olmali:
#   tsx : ^.+\.tsx?$          (regex: literal dot + tsx)
#   rr  : ^.+node_modules[\\/]react-router[\\/].+\.js$  (class: backslash veya slash)
#
# JS string literal'inde value'daki her bir backslash icin kaynakta iki tane gerekir:
#   tsx key raw : '^.+<BS><BS>.tsx?$'
#   rr key raw  : '^.+node_modules[<BS><BS><BS><BS>/]react-router[<BS><BS><BS><BS>/].+<BS><BS>.js$'

TSX_KEY = "'^.+" + BS + BS + ".tsx?$'"
RR_KEY = "'^.+node_modules[" + BS + BS + BS + BS + "/]react-router[" + BS + BS + BS + BS + "/].+" + BS + BS + ".js$'"
COOKIE_ES_KEY = "'^.+node_modules[" + BS + BS + BS + BS + "/]cookie-es[" + BS + BS + BS + BS + "/].+" + BS + BS + ".m?js$'"

content = """export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    %s: [
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
    %s: '<rootDir>/jest.transform.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(react-router)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '%s.(css|less|scss|sass)$': '<rootDir>/__mocks__/styles.cjs',
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
""" % (TSX_KEY, RR_KEY, BS + BS)

with open('jest.config.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('YAZILDI. Key satirlari:')
for line in content.splitlines():
    if 'tsx?$' in line or 'react-router[' in line:
        print(repr(line))
