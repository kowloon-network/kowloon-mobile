const path = require("path");
// getSentryExpoConfig = Expo's getDefaultConfig + Sentry's serializer, which
// injects Debug IDs into the bundle and its source maps. preview/production
// builds upload source maps to our GlitchTip (eas.json); without matching
// Debug IDs the uploaded maps may not be matched to events.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
// The @kowloon/client package is a sibling at ../client, linked via a
// file: dependency in package.json. Metro needs to be told to watch it and
// to follow the resulting symlink.
const clientRoot = path.resolve(projectRoot, "..", "client");

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), clientRoot];

// Keep hierarchical lookup enabled so Metro can find nested deps (e.g.
// @expo/metro-runtime, which gets nested under expo-router/node_modules when
// legacy-peer-deps prevents hoisting). We just need symlink + package
// exports support for the @kowloon/client file: dep to resolve.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });
