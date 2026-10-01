import { spawnSync } from "node:child_process";
import path from "node:path";

it("tracks the authored native module while ignoring prebuild and module build outputs", () => {
  const sourceFiles = [
    "modules/vshop-liquid-glass/android/build.gradle",
    "modules/vshop-liquid-glass/android/src/main/AndroidManifest.xml",
    "modules/vshop-liquid-glass/android/src/main/java/expo/modules/vshopglass/RefractionTargetView.kt",
    "modules/vshop-liquid-glass/android/src/test/java/expo/modules/vshopglass/LensLifecycleTest.kt",
  ];
  const generatedFiles = [
    "android/app/build.gradle",
    "ios/Podfile",
    "modules/vshop-liquid-glass/android/build/generated.js",
    "modules/vshop-liquid-glass/android/.gradle/state.bin",
    "responses.jsonl",
    "responses.prev.jsonl",
    "api-responses/responses.jsonl",
    "vshop.apk",
    "vshop.aab",
    "release.keystore",
    "signer.pem",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    input: [...sourceFiles, ...generatedFiles].join("\n") + "\n",
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split(/\r?\n/)).toEqual(generatedFiles);
});
