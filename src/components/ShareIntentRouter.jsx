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

  // Latest values behind a ref so the (stable) AppState listener never sees
  // stale data and doesn't need to re-subscribe.
  const dataRef = useRef(null);
  dataRef.current = { hasShareIntent, shareIntent, resetShareIntent, navReady };

  // Single, fully crash-guarded handler. EVERY step that can throw is wrapped —
  // an uncaught throw in the deferred nav was crashing the app on share (#81).
  // Content-keyed dedupe means both triggers (context effect + AppState) can
  // call it and only the first routes a given share.
  const handleShare = useRef(null);
  handleShare.current = () => {
    try {
      const d = dataRef.current || {};
      if (!d.navReady || !d.hasShareIntent || !d.shareIntent) return;
      let key = "";
      try { key = shareKey(d.shareIntent); } catch { key = ""; }
      if (!key || key === lastKey.current) return;
      lastKey.current = key;
      let target = null;
      try { target = targetFor(d.shareIntent); } catch { target = null; }
      if (!target) {
        try { d.resetShareIntent?.(); } catch {}
        return;
      }
      setTimeout(() => {
        try { router.navigate(target); } catch {}
        try { d.resetShareIntent?.(); } catch {}
      }, 0);
    } catch {
      /* never let a share crash the app */
    }
  };

  // Fires whenever the share context changes (warm share on any screen) or the
  // navigator becomes ready (cold start).
  useEffect(() => {
    handleShare.current?.();
  }, [navReady, hasShareIntent, shareIntent]);

  // Belt-and-suspenders: some devices deliver a warm share as the app returns
  // to the foreground without the context effect re-firing.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") handleShare.current?.();
    });
    return () => sub.remove();
  }, []);

  return null;
}
