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
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
