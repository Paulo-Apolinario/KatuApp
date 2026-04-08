const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const app = androidManifest.manifest.application?.[0];

    if (app) {
      app.$ = app.$ || {};
      app.$["android:usesCleartextTraffic"] = "true";
    }

    return config;
  });
};