// Crash/error reporting (#84). A no-op everywhere EXPO_PUBLIC_SENTRY_DSN isn't
// set -- Expo Go, local dev, or a build that hasn't had it wired into EAS
// secrets yet -- so every caller below is always safe to use.
//
// Setup still needed from Josh before this actually reports anything:
//   1. A Sentry project (free tier) -> its DSN, as EXPO_PUBLIC_SENTRY_DSN
//      in eas.json's per-profile `env` (or an EAS secret).
//   2. For readable (symbolicated) stack traces: SENTRY_ORG, SENTRY_PROJECT,
//      SENTRY_AUTH_TOKEN as EAS secrets -- the @sentry/react-native/expo
//      config plugin (already registered in app.json) reads these at build
//      time to upload source maps. Without them the build still succeeds;
//      stack traces just stay minified.
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    // Tag reports with the app version so a report maps to a build; paired
    // with the org/project auth above, EAS also stamps a release per build.
    release: `kowloon-mobile@${Constants.expoConfig?.version || "dev"}`,
    tracesSampleRate: 0,
  });
}

// Record a handled/recovered failure as a breadcrumb -- not a crash, but a
// near-miss worth seeing trends on (e.g. the share-router's retried nav
// race). Safe no-op when Sentry isn't initialized.
export function reportNearMiss(category, message, extra) {
  if (!dsn) return;
  Sentry.addBreadcrumb({ category, message, level: "warning", data: extra });
}

export { Sentry };
