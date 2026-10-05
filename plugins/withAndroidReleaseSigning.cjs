const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_MARKER = "VSHOP_ANDROID_KEYSTORE_PATH";
const GUARD_MARKER = "VSHOP_RELEASE_SIGNING_GUARD";
const SAFE_STORE_FILE = `def vshopKeystorePath = System.getenv("${SIGNING_MARKER}")
            storeFile vshopKeystorePath ? file(vshopKeystorePath) : null`;

function withReleaseCredentialGuard(contents) {
  if (contents.includes(GUARD_MARKER)) return contents;
  return `${contents}

// ${GUARD_MARKER}: Debug may configure without production secrets; release packaging must not.
gradle.taskGraph.whenReady { graph ->
    def createsRelease = graph.allTasks.any { task ->
        task.project == project && task.name ==~ /(?i)(assemble|bundle|package|install|sign|validateSigning).*release.*/
    }
    // EAS Build supplies remote credentials through credentials.json and its
    // generated integration script. Keep the local guard fail-closed only when
    // that trusted build environment is absent.
    if (createsRelease && !System.getenv("EAS_BUILD")) {
        def missing = ["VSHOP_ANDROID_KEYSTORE_PATH", "VSHOP_ANDROID_STORE_PASSWORD", "VSHOP_ANDROID_KEY_ALIAS", "VSHOP_ANDROID_KEY_PASSWORD"].findAll { !System.getenv(it)?.trim() }
        if (!missing.isEmpty()) {
            throw new GradleException("Release signing credentials are required. Missing variables: " + missing.join(", "))
        }
    }
}
`;
}

function applyReleaseSigningPlugin(contents) {
  if (contents.includes(SIGNING_MARKER)) {
    return withReleaseCredentialGuard(contents.replace(
      'storeFile file(System.getenv("VSHOP_ANDROID_KEYSTORE_PATH"))', SAFE_STORE_FILE,
    ));
  }

  const signingConfigsPattern = /(signingConfigs\s*\{)/;
  if (!signingConfigsPattern.test(contents)) {
    throw new Error("Unable to locate Android signingConfigs block.");
  }

  const withSigningConfig = contents.replace(
    signingConfigsPattern,
    `$1
        release {
            ${SAFE_STORE_FILE}
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

  return withReleaseCredentialGuard(withSigningConfig.replace(
    releaseBuildPattern,
    "$1signingConfig signingConfigs.release",
  ));
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
