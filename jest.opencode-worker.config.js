/* eslint-env node */

const base = require("./jest.config");

module.exports = {
  ...base,
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/opencode-worker-*.test.js"],
  collectCoverageFrom: [
    "scripts/lib/opencode-worker-policy.cjs",
    "scripts/lib/opencode-worker-runtime.cjs",
    "scripts/run-opencode-worker.cjs",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
