import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = path.join(workspace, ".codex-tmp");
const metroOptimizationEnv = {
  EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: "1",
  EXPO_UNSTABLE_TREE_SHAKING: "1",
};

const runNode = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, {
    cwd: workspace,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ...metroOptimizationEnv, CI: "1" },
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`Android verification failed (${signal ?? code})`));
  });
});

await mkdir(temporaryRoot, { recursive: true });
const output = await mkdtemp(path.join(temporaryRoot, "android-check-"));
try {
  await runNode([require.resolve("expo/bin/cli"), "export", "--platform", "android", "--output-dir", output]);
  await runNode([path.join(workspace, "scripts", "check-export-budget.mjs"), output]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  // Only the unique directory created by this run may be removed.
  if (path.dirname(path.resolve(output)) !== temporaryRoot || !path.basename(output).startsWith("android-check-")) {
    throw new Error("Unexpected export cleanup target");
  }
  await rm(output, { recursive: true, force: true });
}
