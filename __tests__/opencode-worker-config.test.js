/* eslint-env jest, node */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Codex to OpenCode configuration", () => {
  test("keeps the OpenCode worker non-delegating and credential isolated", () => {
    const agent = read(".opencode/agents/codex-worker.md");
    expect(agent).toMatch(/mode:\s*primary/);
    expect(agent).toMatch(/task:\s*deny/);
    expect(agent).toMatch(/external_directory:\s*deny/);
    expect(agent).toMatch(/webfetch:\s*deny/);
    expect(agent).toMatch(/websearch:\s*deny/);
    expect(agent).toMatch(/Do not commit, push, merge, release/i);
    expect(agent).toMatch(/NOT VERIFIED/);
    expect(agent).not.toMatch(/^model:/m);
  });

  test("requires worktree isolation, full review and bounded repairs", () => {
    const skill = read("skills/codex-opencode-handoff/SKILL.md");
    expect(skill).toMatch(/^---\r?\nname: codex-opencode-handoff/m);
    expect(skill).toMatch(/managed worktree/i);
    expect(skill).toMatch(/Never\s+run the worker in the main checkout/i);
    expect(skill).toMatch(/read the complete diff/i);
    expect(skill).toMatch(/maximum of two repair rounds/i);
    expect(skill).toMatch(/MODEL_NOT_AVAILABLE/);
    expect(skill).toMatch(/`?PASS_TO_REVIEW`?\s+is not completion/i);
    expect(skill).toMatch(/Do not push,\s+merge,\s+release, or publish/i);
  });

  test("exposes the guarded runner and focused test scripts", () => {
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.scripts["worker:opencode"])
      .toBe("node scripts/run-opencode-worker.cjs");
    expect(packageJson.scripts["test:opencode-worker"])
      .toContain("jest.opencode-worker.config.js");
  });
});
