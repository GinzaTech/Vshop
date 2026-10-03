/* eslint-env node */

"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

// Reviewed files from patches/braces@3.0.3.patch. An unpatched copy must fail audit.
const patchedFiles = Object.freeze({
  "lib/parse.js": "e13a4ca9fba5213b79f1d1cad985421f3e79835ea4366db8fcb77c5db254ebc1",
  "lib/compile.js": "88cf20f18b59c9b2741c2d9b0f0ac6b2967d8e174667edf817133ca57d76809e",
  "lib/expand.js": "e97988bb229dd87e94db3f3f285a2143eaee216b412a1c7169d770eef640bb37",
  "lib/stringify.js": "a3b8b5e7567ff9bfdbe155479fbdd92d5a924c3919adf05316f8f0c4f6330332",
  "lib/utils.js": "3d32330cb587297e83bf8bb6c1c915cc493b284e4cb810184173d7d2520ce7d7",
});

function verifyBracesPackage(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return pkg.name === "braces" && pkg.version === "3.0.3" &&
      Object.entries(patchedFiles).every(([file, expected]) =>
        createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") === expected);
  } catch {
    return false;
  }
}

function verifyBracesAdvisory(advisory) {
  if (advisory?.github_advisory_id !== "GHSA-vfj7-8cjw-p6xm" ||
      advisory.module_name !== "braces" || advisory.severity !== "high" ||
      !Array.isArray(advisory.findings) || advisory.findings.length === 0) {
    return false;
  }
  try {
    return advisory.findings.every((finding) => finding.version === "3.0.3" &&
      Array.isArray(finding.paths) && finding.paths.length > 0 &&
      finding.paths.every((dependencyPath) => {
        const packages = dependencyPath.split(">");
        if (packages.shift() !== "." || packages.at(-1) !== "braces" ||
            packages.some((name) => !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))) {
          return false;
        }
        let loader = createRequire(path.resolve(__dirname, "../../package.json"));
        let entry;
        for (const name of packages) {
          // Some tooling packages export subpaths only, without a main entry.
          try {
            entry = loader.resolve(`${name}/package.json`);
          } catch {
            entry = loader.resolve(name);
          }
          loader = createRequire(entry);
        }
        return verifyBracesPackage(path.dirname(entry));
      }));
  } catch {
    return false;
  }
}

module.exports = { verifyBracesAdvisory, verifyBracesPackage };
