// ShareIntentRouter — routes an inbound OS share into the composer.
//
// Uses expo-share-intent's CONTEXT (fed by <ShareIntentProvider> in the root
// layout), which is the supported way to receive the share on cold start via
// the deeplink. Mounted globally inside the provider + navigation + Redux
// context, so it catches cold launches (share opens the app) and warm shares
// (app already running). Safe in Expo Go — the native module is optional there,
// so hasShareIntent simply stays false.
//
//   URL   -> /share?url=...   (chooser: Link post or bookmark — issue #82)
//   text  -> Note, editor seeded with the text
//   files -> Media, added as attachments
//
// Reliability (a share is delivery-once, never dropped, never replayed):
//   * We only consume/reset a share AFTER a confirmed-successful navigate — a
//     failed nav is retried, not silently thrown away (the old code reset even
//     when navigate threw, dropping the share).
//   * Delivery waits for BOTH the navigator (root nav key) AND account
//     hydration, so a share never lands on a screen that bounces to /welcome.
//   * A persisted content key dedupes Android's recents-replay across cold
//     starts; it's cleared on a clean launch so re-sharing works later.

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, useRootNavigationState } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useSelector } from "react-redux";

import { setPendingShare } from "../lib/pendingShare.js";
import {
  getLastConsumedShare,
  setLastConsumedShare,
  clearLastConsumedShare,
} from "../lib/shareDedupe.js";
import { selectAccountsStatus } from "../state/accountsSlice.js";

const URL_RE = /https?:\/\/\S+/i;

// A stable content key so a NEW share is always handled but the SAME one isn't
// re-handled.
function shareKey(si) {
  if (!si) return "";
  if (si.webUrl) return `url:${si.webUrl}`;
  if (typeof si.text === "string" && si.text) return `text:${si.text}`;
  if (Array.isArray(si.files) && si.files.length)
    return `files:${si.files.map((f) => f.path).join("|")}`;
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
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const accountsStatus = useSelector(selectAccountsStatus);
  const hydrated = accountsStatus === "ready" || accountsStatus === "error";

  // Latest values behind a ref so the (stable) AppState listener never sees
  // stale data and doesn't need to re-subscribe.
  const dataRef = useRef(null);
  dataRef.current = { hasShareIntent, shareIntent, resetShareIntent, navReady, hydrated };

  const lastConsumedRef = useRef(null); // persisted key of the last delivered share
  const deliveringRef = useRef(false); // a navigate is scheduled/in-flight
  const clearTimerRef = useRef(null); // pending clean-launch marker clear

  const handleShare = useRef(null);
  handleShare.current = () => {
    try {
      const d = dataRef.current || {};
      if (!d.navReady) return;

      // Clean launch (no share present): after a short settle delay, clear the
      // dedupe marker so re-sharing the same URL later works. The delay guards
      // against the brief no-share window on a cold-start share; if a share
      // arrives we cancel the clear below.
      if (!d.hasShareIntent || !d.shareIntent) {
        if (!clearTimerRef.current) {
          clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            if (dataRef.current && !dataRef.current.hasShareIntent) {
              lastConsumedRef.current = null;
              clearLastConsumedShare();
            }
          }, 1200);
        }
        return;
      }
      // A share is present — cancel any pending clean-launch clear.
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      let key = "";
      try { key = shareKey(d.shareIntent); } catch { key = ""; }
      if (!key) { try { d.resetShareIntent?.(); } catch {} return; }

      // Replay of an already-delivered share (Android recents re-fires the
      // launch intent). Drop it.
      if (key === lastConsumedRef.current) {
        try { d.resetShareIntent?.(); } catch {}
        return;
      }

      // Wait for accounts to finish hydrating so we never route into a screen
      // that bounces to /welcome. The effect re-runs when hydration completes.
      if (!d.hydrated) return;

      // One delivery scheduled/in-flight at a time.
      if (deliveringRef.current) return;

      let target = null;
      try { target = targetFor(d.shareIntent); } catch { target = null; }
      if (!target) { try { d.resetShareIntent?.(); } catch {} return; }

      // DEFER the navigate to the next tick. A synchronous navigate right as the
      // navigator mounts on a cold-start share silently no-ops (no throw), which
      // then consumed the share and did nothing — the regression. Consume/reset
      // ONLY after the navigate actually runs; if it throws, clear the in-flight
      // flag and let the next trigger retry (never reset a share we didn't route).
      deliveringRef.current = true;
      setTimeout(() => {
        let ok = false;
        try { router.navigate(target); ok = true; } catch { ok = false; }
        if (ok) {
          lastConsumedRef.current = key;
          setLastConsumedShare(key);
          try { d.resetShareIntent?.(); } catch {}
        }
        deliveringRef.current = false;
      }, 0);
    } catch {
      /* never let a share crash the app */
    }
  };

  // Load the persisted replay marker — NON-blocking (a share never waits on it).
  // Don't clobber a marker a delivery may have already set while we were loading.
  useEffect(() => {
    let cancelled = false;
    getLastConsumedShare().then((k) => {
      if (!cancelled && lastConsumedRef.current == null) lastConsumedRef.current = k;
    });
    return () => { cancelled = true; };
  }, []);

  // Fires whenever the share context changes (warm share), the navigator becomes
  // ready (cold start), or accounts finish hydrating.
  useEffect(() => {
    handleShare.current?.();
  }, [navReady, hasShareIntent, shareIntent, hydrated]);

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
