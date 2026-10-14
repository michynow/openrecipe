const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Sign `release` builds with a keystore taken from the environment at Gradle
 * time (CI: GitHub secrets). Without ANDROID_KEYSTORE_PATH the Expo default
 * (debug key) stays, so local builds need nothing.
 */

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes("ANDROID_KEYSTORE_PATH")) return c;

    // Keep the generated debug config; add ours right after its block.
    const debugBlock = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\}\s*)\}/;
    if (!debugBlock.test(g)) throw new Error("with-release-signing: signingConfigs block not found");
    g = g.replace(debugBlock, (_, head) =>
      head +
      `    if (System.getenv("ANDROID_KEYSTORE_PATH")) {
            release {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }`,
    );

    // The release buildType's `signingConfig signingConfigs.debug` -> release when present.
    const relType = /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!relType.test(g)) throw new Error("with-release-signing: release signingConfig not found");
    g = g.replace(
      relType,
      '$1signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug',
    );
    c.modResults.contents = g;
    return c;
  });
