/* eslint-env jest, node */

const braces = require("braces");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyBracesAdvisory, verifyBracesPackage } = require("../scripts/lib/braces-security.cjs");

const rejection = "braces: maximum nesting depth exceeded";
const patterns = [
  "{".repeat(4_000) + "a,b" + "}".repeat(4_000),
  "(".repeat(4_000) + "a" + ")".repeat(4_000),
  "{(".repeat(2_000) + "a,b" + ")}".repeat(2_000),
  "{".repeat(4_000) + "a",
];

describe("braces dependency nesting protection", () => {
  test.each(["parse", "compile", "expand", "stringify"])("bounds %s on deeply nested input", (method) => {
    for (const pattern of patterns) {
      expect(() => braces[method](pattern)).toThrow(rejection);
    }
  });

  test.each(["compile", "expand", "stringify"])("bounds %s on supplied and cyclic ASTs", (method) => {
    let node = { type: "text", value: "a", nodes: [] };
    for (let index = 0; index < 4_000; index++) {
      node = { type: "root", nodes: [node] };
    }
    expect(() => braces[method](node)).toThrow(rejection);
    const cyclic = { type: "root", nodes: [] };
    cyclic.nodes.push(cyclic);
    expect(() => braces[method](cyclic)).toThrow(rejection);
  });

  test("preserves normal alternatives, ranges, escaping, quotes and brackets", () => {
    expect(braces.expand("a/{b,c}/{1..3}"))
      .toEqual(["a/b/1", "a/b/2", "a/b/3", "a/c/1", "a/c/2", "a/c/3"]);
    expect(braces.compile("a/{b,c}")).toBe("a/(b|c)");
    for (const pattern of ["\\{a,b\\}", '"{a,b}"', "[{a,b}]"]) {
      expect(braces.expand(pattern)).toEqual([pattern.replace(/[\\"]/g, "")]);
    }
    const boundary = "(".repeat(127) + "a" + ")".repeat(127);
    expect(braces.stringify(boundary)).toBe(boundary);
    expect(() => braces.parse("(".repeat(128) + "a")).toThrow(rejection);
  });

  test("rejects a cyclic parent chain without hanging", () => {
    const result = spawnSync(process.execPath, ["-e", `
      const braces = require(${JSON.stringify(require.resolve("braces"))});
      const node = { type: 'paren', nodes: [] };
      node.parent = node;
      try { braces.expand(node); process.exitCode = 1; }
      catch (error) { console.log(error.message); }
    `], { encoding: "utf8", timeout: 2_000, windowsHide: true });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(rejection);
  });
});

describe("production audit verifies the applied braces mitigation", () => {
  const advisory = {
    github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
    module_name: "braces",
    severity: "high",
    findings: [{ version: "3.0.3", paths: [".>micromatch>braces"] }],
  };

  test("accepts the reviewed patch and its transitive consumer", () => {
    expect(verifyBracesPackage(path.dirname(require.resolve("braces")))).toBe(true);
    expect(verifyBracesAdvisory(advisory)).toBe(true);
  });

  test("rejects an altered installed copy", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "braces-audit-test-"));
    try {
      fs.cpSync(path.dirname(require.resolve("braces")), root, { recursive: true });
      expect(verifyBracesPackage(root)).toBe(true);
      fs.appendFileSync(path.join(root, "lib/parse.js"), "\n// altered\n");
      expect(verifyBracesPackage(root)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    { github_advisory_id: "unrelated" },
    { severity: "critical" },
    { findings: [] },
    { findings: [{ version: "3.0.2", paths: [".>micromatch>braces"] }] },
    { findings: [{ version: "3.0.3", paths: [".>missing-package>braces"] }] },
    { findings: [{ version: "3.0.3", paths: [".>../braces"] }] },
  ])("fails closed on unverified advisory %#", (change) => {
    expect(verifyBracesAdvisory({ ...advisory, ...change })).toBe(false);
  });
});
