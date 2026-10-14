const base = require("./app.json");

/**
 * Release numbers come from CI. versionCode must rise on every release
 * (GitHub run number); versionName is the tag, mobile-v1.2.3 -> 1.2.3.
 */
module.exports = () => {
  const { expo } = base;
  return {
    expo: {
      ...expo,
      version: process.env.APP_VERSION || expo.version,
      android: {
        ...expo.android,
        versionCode: Number(process.env.ANDROID_VERSION_CODE) || 1,
      },
    },
  };
};
