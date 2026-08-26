const base = require("./jest.config");

module.exports = {
  ...base,
  roots: ["<rootDir>"],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "features/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "utils/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.styles.ts",
    "!**/*.native.ts",
    "!**/*.web.ts",
    "!**/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 3.5,
      functions: 5,
      lines: 5.5,
      statements: 5,
    },
    "./features/profile/profile-loadout.ts": {
      branches: 60,
      functions: 80,
      lines: 80,
      statements: 75,
    },
    "./features/combat/session-insights.ts": {
      branches: 48,
      functions: 55,
      lines: 68,
      statements: 65,
    },
    "./services/riot/endpoints.ts": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
