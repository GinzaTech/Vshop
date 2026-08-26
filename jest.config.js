/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.[jt]s?(x)"],
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "utils/session-events.ts",
    "services/riot/endpoints.ts",
    "utils/saved-accounts.ts",
    "utils/riot-auth-navigation.ts",
    "utils/storage-migration.ts",
    "utils/xmpp-buffer.ts",
    "utils/gallery-filter.ts",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/backup/",
    "/.codex-tmp/",
    "/rn-flow-visualizer/",
    "/valorant-api-docs/",
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
