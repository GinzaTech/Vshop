import { spawnSync } from "node:child_process";

const allowedAdvisories = new Map([
  ["1117911", "Expo React Native CLI pins fast-xml-parser 4.x; app does not build untrusted XML."],
  ["1119441", "Expo config-plugins pins xcode/uuid 7; affected buffered UUID API is not used by VShop."],
  ["1138808", "Metro pins image-size 1.2.1 and no patched release exists."],
  ["1138809", "Metro pins image-size 1.2.1 and no patched release exists."],
]);

const pnpmEntrypoint = process.env.npm_execpath;
const command = pnpmEntrypoint ? process.execPath : "pnpm";
const args = pnpmEntrypoint
  ? [pnpmEntrypoint, "audit", "--prod", "--json"]
  : ["audit", "--prod", "--json"];
const result = spawnSync(command, args, {
  encoding: "utf8",
  shell: false,
});
const output = result.stdout?.trim();
if (!output) {
  console.error(result.error || result.stderr || "pnpm audit returned no JSON output");
  process.exit(1);
}

const audit = JSON.parse(output);
const advisories = Object.entries(audit.advisories ?? {});
const unexpected = advisories.filter(([id, advisory]) => {
  if (advisory.severity === "critical") return true;
  if (advisory.severity === "high" || advisory.severity === "moderate") {
    return !allowedAdvisories.has(id);
  }
  return false;
});

for (const [id, advisory] of advisories) {
  const rationale = allowedAdvisories.get(id) ?? "not allowlisted";
  console.log(`${advisory.severity} ${id} ${advisory.module_name}: ${rationale}`);
}

if (unexpected.length > 0) {
  console.error(`Unexpected production advisories: ${unexpected.map(([id]) => id).join(", ")}`);
  process.exit(1);
}

console.log(`Production audit policy passed with ${advisories.length} documented transitive advisories.`);
