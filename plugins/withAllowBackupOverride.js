// Config plugin: make our android:allowBackup="false" win the manifest merge.
//
// app.json sets android.allowBackup = false so Android device backups don't
// include app storage (session data). A transitive native dependency of
// react-native-compressor (com.github.kaushik-naik:TAndroidLame) declares
// android:allowBackup="true" in its own manifest, and Gradle's manifest
// merger refuses to build when two manifests disagree. tools:replace tells the
// merger to keep the app's value.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withAllowBackupOverride(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";

    const app = manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$["android:allowBackup"] = "false";
      const existing = (app.$["tools:replace"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!existing.includes("android:allowBackup")) existing.push("android:allowBackup");
      app.$["tools:replace"] = existing.join(",");
    }
    return cfg;
  });
};
