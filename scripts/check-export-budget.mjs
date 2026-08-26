import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const exportDirectory = path.resolve(process.argv[2] ?? ".expo-export-ci");
const limits = {
  totalBytes: 12 * 1024 * 1024,
  javascriptBytes: 8 * 1024 * 1024,
  largestAssetBytes: 1.5 * 1024 * 1024,
};

const files = [];

const visit = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(absolutePath);
      continue;
    }
    if (!entry.isFile() || entry.name.endsWith(".map")) continue;
    const metadata = await stat(absolutePath);
    files.push({
      relativePath: path.relative(exportDirectory, absolutePath),
      size: metadata.size,
    });
  }
};

try {
  await visit(exportDirectory);
} catch (error) {
  console.error(`Unable to inspect Expo export at ${exportDirectory}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const isJavaScriptBundle = ({ relativePath }) =>
  /(?:^|[\\/])_expo[\\/]static[\\/]js[\\/]/.test(relativePath) &&
  /\.(?:hbc|js)$/.test(relativePath);
const isAsset = ({ relativePath }) =>
  /(?:^|[\\/])assets[\\/]/.test(relativePath);

const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const javascriptBytes = files
  .filter(isJavaScriptBundle)
  .reduce((sum, file) => sum + file.size, 0);
const assets = files.filter(isAsset).sort((left, right) => right.size - left.size);
const largestAsset = assets[0] ?? { relativePath: "none", size: 0 };

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Expo export budget: ${exportDirectory}`);
console.log(`  total: ${mb(totalBytes)} / ${mb(limits.totalBytes)}`);
console.log(`  JS/Hermes: ${mb(javascriptBytes)} / ${mb(limits.javascriptBytes)}`);
console.log(
  `  largest asset: ${mb(largestAsset.size)} / ${mb(limits.largestAssetBytes)} (${largestAsset.relativePath})`
);

const failures = [];
if (totalBytes > limits.totalBytes) failures.push("total export size");
if (javascriptBytes === 0) failures.push("missing Android JavaScript/Hermes bundle");
if (javascriptBytes > limits.javascriptBytes) failures.push("JavaScript/Hermes bundle size");
if (largestAsset.size > limits.largestAssetBytes) failures.push("largest asset size");

if (failures.length > 0) {
  console.error(`Export budget failed: ${failures.join(", ")}.`);
  process.exit(1);
}

