import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleUrl = import.meta.url;
const require = createRequire(
  typeof moduleUrl === "string"
    ? moduleUrl
    : pathToFileURL(
        path.join(process.cwd(), "scripts", "build-android-release-local.mjs"),
      ).href,
);
const workspace =
  typeof moduleUrl === "string"
    ? path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..")
    : process.cwd();

function asRecord(value) {
  return value && typeof value === "object" ? value : null;
}

export function validateSigningCredentials(input) {
  const root = asRecord(input);
  const android = asRecord(root?.android);
  const nestedKeystore = asRecord(android?.keystore);
  const keystore = asRecord(root?.keystore);
  const source = nestedKeystore ?? keystore ?? root;
  const credentials = {
    keystorePath: source?.keystorePath,
    keystorePassword: source?.keystorePassword,
    keyAlias: source?.keyAlias,
    keyPassword: source?.keyPassword,
  };
  if (
    !Object.values(credentials).every(
      (value) => typeof value === "string" && value.length > 0,
    )
  ) {
    throw new Error("Local Android release credentials are incomplete.");
  }
  return credentials;
}

export function readSigningCredentials(credentialsPath) {
  if (!existsSync(credentialsPath)) {
    throw new Error("Local Android release credentials are unavailable.");
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(credentialsPath, "utf8"));
  } catch {
    throw new Error("Local Android release credentials are invalid.");
  }
  const credentials = validateSigningCredentials(parsed);
  const resolvedKeystorePath = path.isAbsolute(credentials.keystorePath)
    ? credentials.keystorePath
    : path.resolve(path.dirname(credentialsPath), credentials.keystorePath);
  if (!existsSync(resolvedKeystorePath)) {
    throw new Error("The configured Android release keystore is unavailable.");
  }
  return { ...credentials, keystorePath: resolvedKeystorePath };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    env: options.env ?? process.env,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Local Android release command failed: ${command}`);
  }
}

export function getBuildCommands(platform, expoCliPath) {
  return {
    prebuild: {
      command: process.execPath,
      args: [
        expoCliPath,
        "prebuild",
        "--platform",
        "android",
        "--clean",
        "--no-install",
      ],
    },
    gradle:
      platform === "win32"
        ? {
            command: process.env.ComSpec ?? "cmd.exe",
            args: [
              "/d",
              "/s",
              "/c",
              "gradlew.bat assembleRelease --no-daemon",
            ],
          }
        : {
            command: "./gradlew",
            args: ["assembleRelease", "--no-daemon"],
          },
  };
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex").toUpperCase();
}

export async function main() {
  const configuredPath = process.env.VSHOP_ANDROID_CREDENTIALS_FILE;
  if (!configuredPath) {
    throw new Error("VSHOP_ANDROID_CREDENTIALS_FILE is required.");
  }
  const credentials = readSigningCredentials(path.resolve(configuredPath));
  const buildEnvironment = {
    ...process.env,
    EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: "1",
    EXPO_UNSTABLE_TREE_SHAKING: "1",
    VSHOP_ANDROID_KEYSTORE_PATH: credentials.keystorePath,
    VSHOP_ANDROID_STORE_PASSWORD: credentials.keystorePassword,
    VSHOP_ANDROID_KEY_ALIAS: credentials.keyAlias,
    VSHOP_ANDROID_KEY_PASSWORD: credentials.keyPassword,
  };
  const commands = getBuildCommands(
    process.platform,
    require.resolve("expo/bin/cli"),
  );
  run(
    commands.prebuild.command,
    commands.prebuild.args,
    { env: buildEnvironment },
  );
  run(commands.gradle.command, commands.gradle.args, {
    cwd: path.join(workspace, "android"),
    env: buildEnvironment,
  });

  const sourceApk = path.join(
    workspace,
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "release",
    "app-release.apk",
  );
  if (!existsSync(sourceApk)) {
    throw new Error("Gradle completed without a release APK.");
  }
  const outputDirectory = path.join(workspace, ".codex-tmp", "builds");
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    "VShop-4.1.10-production-91.apk",
  );
  copyFileSync(sourceApk, outputPath);
  const metadata = statSync(outputPath);
  process.stdout.write(
    `${JSON.stringify({
      bytes: metadata.size,
      path: outputPath,
      sha256: await sha256(outputPath),
    })}\n`,
  );
}

const invokedDirectly =
  process.argv[1] &&
  typeof moduleUrl === "string" &&
  moduleUrl === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Local Android release failed."}\n`,
    );
    process.exitCode = 1;
  });
}
