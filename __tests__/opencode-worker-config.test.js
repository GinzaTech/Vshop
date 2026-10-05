/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Codex to OpenCode configuration", () => {
  test("keeps local OpenCode agent files outside Git", () => {
    const ignore = read(".gitignore");
    expect(ignore).toContain("/.opencode/agents/");
    expect(ignore).not.toContain("!/.opencode/agents/");
  });

  test("excludes local agent and handoff skill from EAS uploads", () => {
    const ignore = read(".easignore");
    expect(ignore).toContain(".opencode/agents/");
    expect(ignore).toContain("skills/codex-opencode-handoff/");
  });

  test("exposes the guarded runner and focused test scripts", () => {
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.scripts["worker:opencode"])
      .toBe("node scripts/run-opencode-worker.cjs");
    expect(packageJson.scripts["test:opencode-worker"])
      .toContain("jest.opencode-worker.config.js");
  });

  test("keeps ignored local tool packages out of Jest module discovery", () => {
    const jestConfig = require("../jest.config.js");
    expect(jestConfig.modulePathIgnorePatterns).toEqual(expect.arrayContaining([
      "<rootDir>/ECC/",
      "<rootDir>/rn-flow-visualizer/",
      "<rootDir>/\\.opencode/",
      "<rootDir>/skills/codex-opencode-handoff/",
    ]));
  });
});
