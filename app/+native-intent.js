// Rewrites links the OS opens the app with, before Expo Router routes them.
//
// iOS: the Kowloon share extension hands a share over by opening
// kowloon://dataUrl=<key>. That isn't a screen, so without this Expo Router
// sent it to +not-found -- which only redirects once per session, so a second
// share left you on a blank spinner. The share itself is read by
// expo-share-intent and shown by ShareSheet; the link only needs to not
// navigate anywhere (or, on a cold start, go to the normal entry screen).

export function redirectSystemPath({ path, initial }) {
  try {
    if (String(path || "").includes("dataUrl=")) return initial ? "/" : null;
    return path;
  } catch {
    return initial ? "/" : null;
  }
}
