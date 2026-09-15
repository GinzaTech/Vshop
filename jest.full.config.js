const base = require("./jest.config");

// Per-file floors protect remediated domains without hiding the UI from coverage.
// Jest subtracts these files from the global group; that remaining-app floor is
// deliberately reported separately from the full-app coverage summary.
const remediatedFiles = [
  "services/accounts/session.ts",
  "services/accounts/session-cache.ts",
  "services/accounts/interactive-auth.ts",
  "services/riot/request-scope.ts",
  "services/riot/client-config-cache.ts",
  "services/riot/mmr-cache.ts",
  "services/riot/player-name-cache.ts",
  "services/riot/loadout-cache.ts",
  "utils/app-sync.ts",
  "utils/data-sync.ts",
  "utils/startup-cache.ts",
  "utils/storage-migration.ts",
  "utils/profile-cache.ts",
  "utils/log-redaction.ts",
  "utils/flow-tracer.ts",
  "utils/flow-trace-instrumentation.ts",
  "utils/api-logger.ts",
  "hooks/useCombatStore.ts",
  "hooks/useAccountScreenData.ts",
  "hooks/useAboutScreenData.ts",
  "hooks/useContractsScreenData.ts",
  "hooks/useLeaderboardData.ts",
  "hooks/useMatchDetailsData.ts",
  "components/LoginWebView.tsx",
  "components/profile/player-stats-data.ts",
  "features/matches/**/*.ts",
  "features/combat/useCombat*.ts",
];

module.exports = {
  ...base,
  roots: ["<rootDir>"],
  // ECC/ là thư mục công cụ ngoài (không phải code app) — test suite của nó
  // dùng runner riêng và process.exit, không được jest của app quét vào.
  testPathIgnorePatterns: [
    "/node_modules/",
    "/ECC/",
    "/backup/",
    "/.codex-tmp/",
    "/rn-flow-visualizer/",
    "/valorant-api-docs/",
    "/test/",
  ],
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
      branches: 22,
      functions: 24,
      lines: 26,
      statements: 26,
    },
    ...Object.fromEntries(remediatedFiles.map((file) => [
      `./${file}`,
      { branches: 80, functions: 80, lines: 80, statements: 80 },
    ])),
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
