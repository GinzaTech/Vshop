import { join } from "node:path";

const packageJson = require("../package.json");
const appJson = require("../app.json");

describe("local Android release signing", () => {
  it("bumps the local native release metadata", () => {
    expect(packageJson.version).toBe("4.1.10");
    expect(appJson.expo.version).toBe("4.1.10");
    expect(appJson.expo.android.versionCode).toBe(91);
    expect(appJson.expo.ios.buildNumber).toBe("43");
  });

  it("generates release signing without a debug fallback", () => {
    const { applyReleaseSigningPlugin } = require(
      "../plugins/withAndroidReleaseSigning.cjs",
    );
    const fixture = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

    const gradle = applyReleaseSigningPlugin(fixture);

    expect(gradle).toContain(
      'storeFile vshopKeystorePath ? file(vshopKeystorePath) : null',
    );
    expect(gradle).toContain("signingConfig signingConfigs.release");
    const releaseBuild = gradle.match(
      /buildTypes\s*\{[\s\S]*?\brelease\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1];
    expect(releaseBuild).toContain("signingConfig signingConfigs.release");
    expect(releaseBuild).not.toContain("signingConfigs.debug");
    expect(applyReleaseSigningPlugin(gradle)).toBe(gradle);
    expect(gradle).toContain("gradle.taskGraph.whenReady");
    expect(gradle).toContain("Release signing credentials are required");
    expect(gradle).toContain("task.project == project");
  });

  it("upgrades the old eager signing block so debug configuration does not evaluate file(null)", () => {
    const { applyReleaseSigningPlugin } = require("../plugins/withAndroidReleaseSigning.cjs");
    const previous = 'android { signingConfigs { release { storeFile file(System.getenv("VSHOP_ANDROID_KEYSTORE_PATH")) } } buildTypes { release { signingConfig signingConfigs.release } } }';
    const upgraded = applyReleaseSigningPlugin(previous);
    expect(upgraded).not.toContain('file(System.getenv("VSHOP_ANDROID_KEYSTORE_PATH"))');
    expect(upgraded).toContain("storeFile vshopKeystorePath ? file(vshopKeystorePath) : null");
    expect(upgraded).toContain("Release signing credentials are required");
    expect(upgraded).not.toContain("signingConfigs.debug");
    expect(applyReleaseSigningPlugin(upgraded)).toBe(upgraded);
  });

  it("fails closed before Gradle when credentials are unavailable", () => {
    const { readSigningCredentials } = require(
      "../scripts/build-android-release-local.mjs",
    );
    const missing = join(process.cwd(), ".codex-tmp", "missing-signing.json");

    expect(() => readSigningCredentials(missing)).toThrow(
      "Local Android release credentials are unavailable.",
    );
  });

  it("does not include secret values in invalid credential errors", () => {
    const { validateSigningCredentials } = require(
      "../scripts/build-android-release-local.mjs",
    );
    const sensitiveMarker = "redaction-sentinel-value";

    expect(() =>
      validateSigningCredentials({ keystorePassword: sensitiveMarker }),
    ).toThrow("Local Android release credentials are incomplete.");
    try {
      validateSigningCredentials({ keystorePassword: sensitiveMarker });
    } catch (error) {
      expect(String(error)).not.toContain(sensitiveMarker);
    }
  });

  it("uses Windows-native launchers without passing signing secrets as arguments", () => {
    const { getBuildCommands } = require(
      "../scripts/build-android-release-local.mjs",
    );

    const commands = getBuildCommands("win32", "C:\\tools\\expo-cli.js");

    expect(commands.prebuild).toEqual({
      command: process.execPath,
      args: [
        "C:\\tools\\expo-cli.js",
        "prebuild",
        "--platform",
        "android",
        "--clean",
        "--no-install",
      ],
    });
    expect(commands.gradle.command.toLowerCase()).toMatch(/cmd(?:\.exe)?$/);
    expect(commands.gradle.args).toEqual([
      "/d",
      "/s",
      "/c",
      "gradlew.bat assembleRelease --no-daemon",
    ]);
    expect(JSON.stringify(commands)).not.toContain("PASSWORD");
  });
});
