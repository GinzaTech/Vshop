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
    "features/profile/profile-loadout.ts",
    "features/combat/session-insights.ts",
    "services/riot/storefront-parser.ts",
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
      branches: 55,
      functions: 70,
      lines: 72,
      statements: 70,
    },
  },
};
