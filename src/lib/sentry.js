// Crash/error reporting (#84). Reports go to OUR OWN GlitchTip instance at
// errors.kowloon.network -- not to sentry.io. GlitchTip speaks Sentry's API,
// so the @sentry/react-native SDK works unchanged; only the DSN host differs.
// Chosen over hosted Sentry because Josh wants as few third-party
// dependencies as possible, and over self-hosted Sentry because that needs
// 16GB RAM vs GlitchTip's ~334MB. See the glitchtip memory for the setup.
//
// Still a no-op anywhere EXPO_PUBLIC_SENTRY_DSN isn't set -- Expo Go and
// local dev -- so every caller below is always safe to use. The DSN is set
// per-profile in eas.json; it is a publishable key (it ships inside the app
// binary by design), not a secret.
//
// Source maps are NOT uploaded: SENTRY_DISABLE_AUTO_UPLOAD=true is set in
// eas.json because the config plugin's gradle step shells out to sentry-cli
// and broke the Android build. Consequence: JS stack traces arrive minified.
// Fixing that needs a GlitchTip auth token + SENTRY_URL pointed at our host.
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    // Tag reports with the app version so a report maps back to a build.
    release: `kowloon-mobile@${Constants.expoConfig?.version || "dev"}`,
    tracesSampleRate: 0,
    // Kowloon's whole pitch is privacy, and one pilot community is a
    // reproductive-rights group -- don't ship user content to the error
    // store. Default is already false; pinned explicitly so a future SDK
    // default change can't quietly start sending PII.
    sendDefaultPii: false,
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
