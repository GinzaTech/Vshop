/* eslint-env node */
// Deterministic packaging of the approved startup artwork, without a new drawing.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const workspace = path.resolve(__dirname, "..");
const expoRequire = createRequire(require.resolve("expo/package.json"));
const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } = expoRequire("@expo/image-utils");
const original = path.join(workspace, "assets/generated/concepts/startup/vshop-launch-mark-v1.png");
const output = path.join(workspace, "assets/generated/production/startup");
const size = 1024;
const foregroundSize = 552;
const backgroundColor = "#f4f6f9";

async function main() {
  const common = await generateImageAsync({ projectRoot: workspace }, {
    src: original, width: size, height: size, resizeMode: "contain",
    backgroundColor, removeTransparency: true,
  });
  const foreground = await generateImageAsync({ projectRoot: workspace }, {
    src: original, width: foregroundSize, height: foregroundSize,
    resizeMode: "contain", backgroundColor: "transparent",
  });
  const transparent = await generateImageBackgroundAsync({
    width: size, height: size, resizeMode: "contain", backgroundColor: "transparent",
  });
  const offset = (size - foregroundSize) / 2;
  const adaptive = await compositeImagesAsync({
    foreground: foreground.source, background: transparent, x: offset, y: offset,
  });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "vshop-app-icon-v1.png"), common.source);
  await fs.writeFile(path.join(output, "vshop-app-icon-foreground-v1.png"), adaptive);
  console.log("Prepared 1024px opaque launcher and transparent adaptive foreground from the original startup mark.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
