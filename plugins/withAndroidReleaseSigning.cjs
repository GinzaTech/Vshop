const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_MARKER = "VSHOP_ANDROID_KEYSTORE_PATH";

function applyReleaseSigningPlugin(contents) {
  if (contents.includes(SIGNING_MARKER)) return contents;

  const signingConfigsPattern = /(signingConfigs\s*\{)/;
  if (!signingConfigsPattern.test(contents)) {
    throw new Error("Unable to locate Android signingConfigs block.");
  }

  const withSigningConfig = contents.replace(
    signingConfigsPattern,
    `$1
        release {
            storeFile file(System.getenv("VSHOP_ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("VSHOP_ANDROID_STORE_PASSWORD")
            keyAlias System.getenv("VSHOP_ANDROID_KEY_ALIAS")
            keyPassword System.getenv("VSHOP_ANDROID_KEY_PASSWORD")
        }`,
  );
  const releaseBuildPattern =
    /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseBuildPattern.test(withSigningConfig)) {
    throw new Error("Unable to locate Android release signing assignment.");
  }

  return withSigningConfig.replace(
    releaseBuildPattern,
    "$1signingConfig signingConfigs.release",
  );
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("VShop release signing requires a Groovy app build.gradle.");
    }
    gradleConfig.modResults.contents = applyReleaseSigningPlugin(
      gradleConfig.modResults.contents,
    );
    return gradleConfig;
  });
}

module.exports = withAndroidReleaseSigning;
module.exports.applyReleaseSigningPlugin = applyReleaseSigningPlugin;
