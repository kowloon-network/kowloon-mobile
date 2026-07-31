// ShareIntentRouter — routes an inbound OS share into the composer.
//
// Uses expo-share-intent's CONTEXT (fed by <ShareIntentProvider> in the root
// layout), which is the supported way to receive the share on cold start via
// the deeplink. Mounted globally inside the provider + navigation context, so
// it catches both cold launches (share opens the app) and warm shares (app
// already running). Safe in Expo Go — the native module is optional there, so
// hasShareIntent simply stays false.
//
//   URL   -> /share?url=...   (chooser: Link post or bookmark — issue #82)
//   text  -> Note, editor seeded with the text
//   files -> Media, added as attachments

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, useRootNavigationState } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";

import { setPendingShare } from "../lib/pendingShare.js";

const URL_RE = /https?:\/\/\S+/i;

// A stable content key so a NEW share is always handled but the SAME one isn't
// re-handled — replaces the old boolean "handled" flag, which could stick true
// and silently swallow the next share (issue #81).
function shareKey(si) {
  if (!si) return "";
  if (si.webUrl) return `url:${si.webUrl}`;
  if (typeof si.text === "string" && si.text) return `text:${si.text}`;
  if (Array.isArray(si.files) && si.files.length) return `files:${si.files.map((f) => f.path).join("|")}`;
  return "";
}

// Build the navigation target from a share payload; stashes text/files for the
// composer to consume, returns the route to navigate to (or null).
function targetFor(shareIntent) {
  const textMatch =
    typeof shareIntent.text === "string" ? shareIntent.text.match(URL_RE) : null;
  const url = shareIntent.webUrl || (textMatch ? textMatch[0] : null);
  // A shared URL goes to the chooser (Link post vs. bookmark).
  if (url) return `/share?url=${encodeURIComponent(url)}`;
  if (Array.isArray(shareIntent.files) && shareIntent.files.length) {
    setPendingShare({
      kind: "files",
      files: shareIntent.files.map((f) => ({
        uri: f.path,
        name: f.fileName,
        mimeType: f.mimeType,
      })),
    });
    return "/compose?fromShare=1";
  }
  if (shareIntent.text) {
    setPendingShare({ kind: "text", text: shareIntent.text });
    return "/compose?fromShare=1";
  }
  return null;
}

export function ShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  // On a cold-start share the handler can fire before the navigator mounts —
  // navigating then throws "Attempted to navigate before mounting the Root
  // Layout". Gate on the root nav state having a key AND defer to the next tick.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const lastKey = useRef(null);

  // Handle a pending share from anywhere (any screen) — the fix for #81 is that
  // this no longer depends on a boolean that could stick; it keys off content
  // and always routes a fresh share regardless of the current route.
  useEffect(() => {
    if (!navReady || !hasShareIntent || !shareIntent) return;
    const key = shareKey(shareIntent);
    if (!key || key === lastKey.current) return;
    const target = targetFor(shareIntent);
    lastKey.current = key;
    if (!target) {
      resetShareIntent();
      return;
    }
    const t = setTimeout(() => {
      router.navigate(target);
      resetShareIntent();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navReady, hasShareIntent, shareIntent]);

  // Warm shares can arrive as the app returns to the foreground without the
  // context effect re-firing on some devices/routes; re-poke it on 'active'.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || !hasShareIntent || !shareIntent || !navReady) return;
      const key = shareKey(shareIntent);
      if (!key || key === lastKey.current) return;
      const target = targetFor(shareIntent);
      lastKey.current = key;
      if (!target) return resetShareIntent();
      setTimeout(() => {
        router.navigate(target);
        resetShareIntent();
      }, 0);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, shareIntent, navReady]);

  return null;
}
